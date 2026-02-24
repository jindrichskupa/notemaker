//! Encryption module using age crate for secure encryption of blocks and files.
//!
//! Supports three authentication methods:
//! - Password-based encryption (scrypt key derivation)
//! - Identity file-based encryption (X25519 keys)
//! - Multi-recipient encryption (multiple X25519 public keys)

use std::io::{Read, Write};
use std::path::Path;
use std::sync::RwLock;
use thiserror::Error;
use keyring::Entry;

const KEYCHAIN_SERVICE: &str = "com.notemaker.encryption";
const KEYCHAIN_PASSWORD_KEY: &str = "encryption_password";
const KEYCHAIN_IDENTITY_KEY: &str = "encryption_identity_path";

/// Encryption errors
#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid password")]
    InvalidPassword,

    #[error("Identity file not found: {0}")]
    IdentityFileNotFound(String),

    #[error("Invalid identity file: {0}")]
    InvalidIdentityFile(String),

    #[error("Invalid public key: {0}")]
    InvalidPublicKey(String),

    #[error("Session not unlocked")]
    SessionLocked,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("No matching key found")]
    NoMatchingKey,

    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("No recipients configured")]
    NoRecipients,
}

/// Encryption method configuration
#[derive(Debug, Clone, PartialEq)]
pub enum EncryptionMethod {
    Password(String),
    IdentityFile(String),
    /// Multiple identity files for multi-recipient decryption
    Recipients(Vec<String>),
}

/// Session cache for encryption credentials
pub struct EncryptionSession {
    method: RwLock<Option<EncryptionMethod>>,
    /// Cached public keys for multi-recipient encryption
    public_keys: RwLock<Vec<String>>,
}

impl Default for EncryptionSession {
    fn default() -> Self {
        Self::new()
    }
}

impl EncryptionSession {
    pub fn new() -> Self {
        Self {
            method: RwLock::new(None),
            public_keys: RwLock::new(Vec::new()),
        }
    }

    /// Set password for the session
    pub fn set_password(&self, password: String) {
        let mut method = self.method.write().unwrap();
        *method = Some(EncryptionMethod::Password(password));
    }

    /// Set identity file path for the session
    pub fn set_identity_file(&self, path: String) {
        let mut method = self.method.write().unwrap();
        *method = Some(EncryptionMethod::IdentityFile(path));
    }

    /// Set multiple identity files for recipient-based decryption
    pub fn set_recipient_identities(&self, paths: Vec<String>) {
        let mut method = self.method.write().unwrap();
        *method = Some(EncryptionMethod::Recipients(paths));
    }

    /// Set public keys for multi-recipient encryption
    pub fn set_public_keys(&self, keys: Vec<String>) {
        let mut public_keys = self.public_keys.write().unwrap();
        *public_keys = keys;
    }

    /// Get public keys for encryption
    pub fn get_public_keys(&self) -> Vec<String> {
        let public_keys = self.public_keys.read().unwrap();
        public_keys.clone()
    }

    /// Add a single identity file to recipients
    pub fn add_recipient_identity(&self, path: String) {
        let mut method = self.method.write().unwrap();
        match &mut *method {
            Some(EncryptionMethod::Recipients(paths)) => {
                if !paths.contains(&path) {
                    paths.push(path);
                }
            }
            _ => {
                *method = Some(EncryptionMethod::Recipients(vec![path]));
            }
        }
    }

    /// Clear the session (lock)
    pub fn lock(&self) {
        let mut method = self.method.write().unwrap();
        *method = None;
        let mut public_keys = self.public_keys.write().unwrap();
        public_keys.clear();
    }

    /// Check if session is unlocked
    pub fn is_unlocked(&self) -> bool {
        let method = self.method.read().unwrap();
        method.is_some()
    }

    /// Get current method (cloned)
    pub fn get_method(&self) -> Option<EncryptionMethod> {
        let method = self.method.read().unwrap();
        method.clone()
    }
}

/// Encrypt data with password using age's scrypt
pub fn encrypt_with_password(plaintext: &[u8], password: &str) -> Result<Vec<u8>, EncryptionError> {
    let encryptor = age::Encryptor::with_user_passphrase(age::secrecy::Secret::new(password.to_owned()));

    let mut encrypted = vec![];
    let mut writer = encryptor
        .wrap_output(&mut encrypted)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .write_all(plaintext)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .finish()
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    Ok(encrypted)
}

/// Decrypt data with password
pub fn decrypt_with_password(ciphertext: &[u8], password: &str) -> Result<Vec<u8>, EncryptionError> {
    let decryptor = match age::Decryptor::new(ciphertext)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?
    {
        age::Decryptor::Passphrase(d) => d,
        _ => return Err(EncryptionError::DecryptionFailed("Not password-encrypted".to_string())),
    };

    let mut decrypted = vec![];
    let mut reader = decryptor
        .decrypt(&age::secrecy::Secret::new(password.to_owned()), None)
        .map_err(|_| EncryptionError::InvalidPassword)?;

    reader
        .read_to_end(&mut decrypted)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

    Ok(decrypted)
}

/// Load X25519 identity from file
fn load_x25519_identity(path: &str) -> Result<age::x25519::Identity, EncryptionError> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(EncryptionError::IdentityFileNotFound(path.display().to_string()));
    }

    let contents = std::fs::read_to_string(path)?;

    // Parse the identity file line by line, looking for AGE-SECRET-KEY-
    for line in contents.lines() {
        let line = line.trim();
        if line.starts_with("AGE-SECRET-KEY-") {
            return line.parse::<age::x25519::Identity>()
                .map_err(|e| EncryptionError::InvalidIdentityFile(e.to_string()));
        }
    }

    Err(EncryptionError::InvalidIdentityFile("No valid AGE-SECRET-KEY found in file".to_string()))
}

/// Encrypt data with identity file (X25519)
pub fn encrypt_with_identity_file(plaintext: &[u8], identity_path: &str) -> Result<Vec<u8>, EncryptionError> {
    let identity = load_x25519_identity(identity_path)?;
    let recipient = identity.to_public();

    let encryptor = age::Encryptor::with_recipients(vec![Box::new(recipient)])
        .expect("Recipients should not be empty");

    let mut encrypted = vec![];
    let mut writer = encryptor
        .wrap_output(&mut encrypted)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .write_all(plaintext)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .finish()
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    Ok(encrypted)
}

/// Decrypt data with identity file
pub fn decrypt_with_identity_file(ciphertext: &[u8], identity_path: &str) -> Result<Vec<u8>, EncryptionError> {
    let identity = load_x25519_identity(identity_path)?;

    let decryptor = match age::Decryptor::new(ciphertext)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?
    {
        age::Decryptor::Recipients(d) => d,
        _ => return Err(EncryptionError::DecryptionFailed("Not key-encrypted".to_string())),
    };

    let mut decrypted = vec![];
    let mut reader = decryptor
        .decrypt(std::iter::once(&identity as &dyn age::Identity))
        .map_err(|_| EncryptionError::NoMatchingKey)?;

    reader
        .read_to_end(&mut decrypted)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

    Ok(decrypted)
}

/// Parse an age public key string
fn parse_public_key(key: &str) -> Result<age::x25519::Recipient, EncryptionError> {
    key.parse::<age::x25519::Recipient>()
        .map_err(|e| EncryptionError::InvalidPublicKey(format!("{}: {}", key, e)))
}

/// Get public key from identity file
pub fn get_public_key_from_identity(identity_path: &str) -> Result<String, EncryptionError> {
    let identity = load_x25519_identity(identity_path)?;
    Ok(identity.to_public().to_string())
}

/// Generate a new age X25519 identity and save to file
/// Returns the public key as a string
pub fn generate_identity(path: &str) -> Result<String, EncryptionError> {
    use std::fs;
    use std::path::Path;
    use age::secrecy::ExposeSecret;

    let path = Path::new(path);

    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    // Generate new identity
    let identity = age::x25519::Identity::generate();
    let public_key = identity.to_public();

    // Format the identity file content
    let content = format!(
        "# created: {}\n# public key: {}\n{}\n",
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        public_key,
        identity.to_string().expose_secret()
    );

    // Write to file
    fs::write(path, content)?;

    // Set restrictive permissions on Unix (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, permissions)?;
    }

    Ok(public_key.to_string())
}

/// Encrypt data for multiple recipients using their public keys
pub fn encrypt_with_recipients(plaintext: &[u8], public_keys: &[String]) -> Result<Vec<u8>, EncryptionError> {
    if public_keys.is_empty() {
        return Err(EncryptionError::NoRecipients);
    }

    let recipients: Result<Vec<Box<dyn age::Recipient + Send>>, EncryptionError> = public_keys
        .iter()
        .map(|key| {
            let recipient = parse_public_key(key)?;
            Ok(Box::new(recipient) as Box<dyn age::Recipient + Send>)
        })
        .collect();

    let recipients = recipients?;

    let encryptor = age::Encryptor::with_recipients(recipients)
        .expect("Recipients should not be empty");

    let mut encrypted = vec![];
    let mut writer = encryptor
        .wrap_output(&mut encrypted)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .write_all(plaintext)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    writer
        .finish()
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

    Ok(encrypted)
}

/// Decrypt data using any of the provided identity files
pub fn decrypt_with_recipient_identities(ciphertext: &[u8], identity_paths: &[String]) -> Result<Vec<u8>, EncryptionError> {
    if identity_paths.is_empty() {
        return Err(EncryptionError::NoMatchingKey);
    }

    // Load all identities
    let identities: Vec<age::x25519::Identity> = identity_paths
        .iter()
        .filter_map(|path| load_x25519_identity(path).ok())
        .collect();

    if identities.is_empty() {
        return Err(EncryptionError::NoMatchingKey);
    }

    let decryptor = match age::Decryptor::new(ciphertext)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?
    {
        age::Decryptor::Recipients(d) => d,
        _ => return Err(EncryptionError::DecryptionFailed("Not key-encrypted".to_string())),
    };

    // Try decrypting with all identities
    let identity_refs: Vec<&dyn age::Identity> = identities
        .iter()
        .map(|i| i as &dyn age::Identity)
        .collect();

    let mut decrypted = vec![];
    let mut reader = decryptor
        .decrypt(identity_refs.into_iter())
        .map_err(|_| EncryptionError::NoMatchingKey)?;

    reader
        .read_to_end(&mut decrypted)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

    Ok(decrypted)
}

/// Encrypt using session credentials
pub fn encrypt_with_session(session: &EncryptionSession, plaintext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    // First check if we have public keys for multi-recipient encryption
    let public_keys = session.get_public_keys();
    if !public_keys.is_empty() {
        return encrypt_with_recipients(plaintext, &public_keys);
    }

    // Fall back to single-method encryption
    match session.get_method() {
        Some(EncryptionMethod::Password(password)) => encrypt_with_password(plaintext, &password),
        Some(EncryptionMethod::IdentityFile(path)) => encrypt_with_identity_file(plaintext, &path),
        Some(EncryptionMethod::Recipients(_)) => {
            // Recipients mode but no public keys set
            Err(EncryptionError::NoRecipients)
        }
        None => Err(EncryptionError::SessionLocked),
    }
}

/// Decrypt using session credentials
pub fn decrypt_with_session(session: &EncryptionSession, ciphertext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    match session.get_method() {
        Some(EncryptionMethod::Password(password)) => decrypt_with_password(ciphertext, &password),
        Some(EncryptionMethod::IdentityFile(path)) => decrypt_with_identity_file(ciphertext, &path),
        Some(EncryptionMethod::Recipients(paths)) => decrypt_with_recipient_identities(ciphertext, &paths),
        None => Err(EncryptionError::SessionLocked),
    }
}

/// Armor encrypted data (base64 with markers)
pub fn armor_encrypt(encrypted: &[u8]) -> String {
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(encrypted);
    format!(
        "-----BEGIN AGE ENCRYPTED FILE-----\n{}\n-----END AGE ENCRYPTED FILE-----",
        encoded
            .as_bytes()
            .chunks(64)
            .map(|chunk| std::str::from_utf8(chunk).unwrap())
            .collect::<Vec<_>>()
            .join("\n")
    )
}

/// Dearmor encrypted data
pub fn dearmor_decrypt(armored: &str) -> Result<Vec<u8>, EncryptionError> {
    use base64::Engine;

    let trimmed = armored.trim();
    if !trimmed.starts_with("-----BEGIN AGE ENCRYPTED FILE-----") {
        return Err(EncryptionError::DecryptionFailed("Invalid armor format".to_string()));
    }

    let base64_content: String = trimmed
        .lines()
        .filter(|line| !line.starts_with("-----"))
        .collect::<Vec<_>>()
        .join("");

    base64::engine::general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| EncryptionError::DecryptionFailed(format!("Base64 decode error: {}", e)))
}

/// Check if content is encrypted (armored format)
pub fn is_encrypted(content: &str) -> bool {
    content.trim().starts_with("-----BEGIN AGE ENCRYPTED FILE-----")
}

// ============================================================================
// Keychain functions for persistent storage
// ============================================================================

/// Save password to system keychain
pub fn save_password_to_keychain(password: &str) -> Result<(), EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_PASSWORD_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    entry.set_password(password)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))
}

/// Load password from system keychain
pub fn load_password_from_keychain() -> Result<Option<String>, EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_PASSWORD_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(EncryptionError::KeychainError(e.to_string())),
    }
}

/// Delete password from system keychain
pub fn delete_password_from_keychain() -> Result<(), EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_PASSWORD_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(EncryptionError::KeychainError(e.to_string())),
    }
}

/// Save identity file path to system keychain
pub fn save_identity_path_to_keychain(path: &str) -> Result<(), EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_IDENTITY_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    entry.set_password(path)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))
}

/// Load identity file path from system keychain
pub fn load_identity_path_from_keychain() -> Result<Option<String>, EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_IDENTITY_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    match entry.get_password() {
        Ok(path) => Ok(Some(path)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(EncryptionError::KeychainError(e.to_string())),
    }
}

/// Delete identity path from system keychain
pub fn delete_identity_path_from_keychain() -> Result<(), EncryptionError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_IDENTITY_KEY)
        .map_err(|e| EncryptionError::KeychainError(e.to_string()))?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(EncryptionError::KeychainError(e.to_string())),
    }
}

/// Check if credentials are stored in keychain
pub fn has_stored_credentials() -> bool {
    load_password_from_keychain().ok().flatten().is_some() ||
    load_identity_path_from_keychain().ok().flatten().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_encryption_roundtrip() {
        let plaintext = b"Hello, secret world!";
        let password = "test_password_123";

        let encrypted = encrypt_with_password(plaintext, password).unwrap();
        let decrypted = decrypt_with_password(&encrypted, password).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_wrong_password() {
        let plaintext = b"Hello, secret world!";
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let encrypted = encrypt_with_password(plaintext, password).unwrap();
        let result = decrypt_with_password(&encrypted, wrong_password);

        assert!(matches!(result, Err(EncryptionError::InvalidPassword)));
    }

    #[test]
    fn test_armor_roundtrip() {
        let data = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let armored = armor_encrypt(&data);
        let dearmored = dearmor_decrypt(&armored).unwrap();

        assert_eq!(data, dearmored);
    }

    #[test]
    fn test_is_encrypted() {
        let encrypted = "-----BEGIN AGE ENCRYPTED FILE-----\nbase64data\n-----END AGE ENCRYPTED FILE-----";
        let plain = "# Hello World\nThis is plain text";

        assert!(is_encrypted(encrypted));
        assert!(!is_encrypted(plain));
    }

    #[test]
    fn test_session_lifecycle() {
        let session = EncryptionSession::new();

        assert!(!session.is_unlocked());

        session.set_password("test".to_string());
        assert!(session.is_unlocked());

        session.lock();
        assert!(!session.is_unlocked());
    }

    #[test]
    fn test_generate_identity_creates_valid_file() {
        use tempfile::tempdir;

        let temp = tempdir().unwrap();
        let path = temp.path().join("test-key.txt");

        let public_key = super::generate_identity(path.to_str().unwrap()).unwrap();

        // Public key should start with "age1"
        assert!(public_key.starts_with("age1"), "Public key should start with age1");

        // File should exist
        assert!(path.exists(), "Identity file should be created");

        // Should be able to load the identity back
        let loaded_public = super::get_public_key_from_identity(path.to_str().unwrap()).unwrap();
        assert_eq!(public_key, loaded_public, "Loaded public key should match");
    }

    #[test]
    fn test_generate_identity_creates_parent_dirs() {
        use tempfile::tempdir;

        let temp = tempdir().unwrap();
        let path = temp.path().join("nested/dir/key.txt");

        let result = super::generate_identity(path.to_str().unwrap());
        assert!(result.is_ok(), "Should create parent directories");
        assert!(path.exists(), "File should exist in nested directory");
    }

    #[test]
    #[cfg(unix)]
    fn test_generate_identity_sets_restrictive_permissions() {
        use std::os::unix::fs::PermissionsExt;
        use tempfile::tempdir;

        let temp = tempdir().unwrap();
        let path = temp.path().join("secure-key.txt");

        super::generate_identity(path.to_str().unwrap()).unwrap();

        let metadata = std::fs::metadata(&path).unwrap();
        let mode = metadata.permissions().mode();

        // Check that only owner has read/write (0o600)
        // The mode includes file type bits, so mask with 0o777 to get just permission bits
        assert_eq!(mode & 0o777, 0o600, "Identity file should have 0600 permissions");
    }
}
