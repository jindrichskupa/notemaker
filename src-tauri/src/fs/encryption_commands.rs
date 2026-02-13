//! Tauri commands for encryption operations

use super::encryption::{
    armor_encrypt, dearmor_decrypt, decrypt_with_session, encrypt_with_session, is_encrypted,
    EncryptionError, EncryptionSession, get_public_key_from_identity,
    save_password_to_keychain, load_password_from_keychain, delete_password_from_keychain,
    save_identity_path_to_keychain, load_identity_path_from_keychain, delete_identity_path_from_keychain,
    has_stored_credentials,
};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use serde::{Deserialize, Serialize};

/// Expand tilde (~) to home directory
fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(&path[2..]);
        }
    } else if path == "~" {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home);
        }
    }
    PathBuf::from(path)
}

/// Encryption state managed by Tauri
pub struct EncryptionState {
    pub session: Arc<EncryptionSession>,
}

impl Default for EncryptionState {
    fn default() -> Self {
        Self {
            session: Arc::new(EncryptionSession::new()),
        }
    }
}

/// Convert EncryptionError to string for Tauri
impl From<EncryptionError> for String {
    fn from(e: EncryptionError) -> Self {
        e.to_string()
    }
}

/// Set password for the encryption session
#[tauri::command]
pub fn set_encryption_password(
    state: State<'_, EncryptionState>,
    password: String,
) -> Result<(), String> {
    state.session.set_password(password);
    Ok(())
}

/// Set identity file for the encryption session
#[tauri::command]
pub fn set_encryption_identity(
    state: State<'_, EncryptionState>,
    path: String,
) -> Result<(), String> {
    // Expand tilde and validate file exists
    let expanded_path = expand_tilde(&path);
    if !expanded_path.exists() {
        return Err(format!("Identity file not found: {}", path));
    }
    state.session.set_identity_file(expanded_path.to_string_lossy().to_string());
    Ok(())
}

/// Lock the encryption session (clear credentials)
#[tauri::command]
pub fn lock_encryption_session(state: State<'_, EncryptionState>) -> Result<(), String> {
    state.session.lock();
    Ok(())
}

/// Check if encryption session is unlocked
#[tauri::command]
pub fn is_encryption_unlocked(state: State<'_, EncryptionState>) -> bool {
    state.session.is_unlocked()
}

/// Encrypt a text block
#[tauri::command]
pub fn encrypt_block(
    state: State<'_, EncryptionState>,
    content: String,
) -> Result<String, String> {
    let encrypted = encrypt_with_session(&state.session, content.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(armor_encrypt(&encrypted))
}

/// Decrypt a text block
#[tauri::command]
pub fn decrypt_block(
    state: State<'_, EncryptionState>,
    content: String,
) -> Result<String, String> {
    if !is_encrypted(&content) {
        return Err("Content is not encrypted".to_string());
    }

    let ciphertext = dearmor_decrypt(&content).map_err(|e| e.to_string())?;
    let decrypted = decrypt_with_session(&state.session, &ciphertext)
        .map_err(|e| e.to_string())?;

    String::from_utf8(decrypted)
        .map_err(|e| format!("Invalid UTF-8 in decrypted content: {}", e))
}

/// Encrypt a note file
#[tauri::command]
pub fn encrypt_note(
    state: State<'_, EncryptionState>,
    path: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Note file not found: {}", path));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read note: {}", e))?;

    // Don't double-encrypt
    if is_encrypted(&content) {
        return Err("Note is already encrypted".to_string());
    }

    let encrypted = encrypt_with_session(&state.session, content.as_bytes())
        .map_err(|e| e.to_string())?;
    let armored = armor_encrypt(&encrypted);

    std::fs::write(&file_path, armored)
        .map_err(|e| format!("Failed to write encrypted note: {}", e))?;

    Ok(())
}

/// Decrypt a note file
#[tauri::command]
pub fn decrypt_note(
    state: State<'_, EncryptionState>,
    path: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Note file not found: {}", path));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read note: {}", e))?;

    if !is_encrypted(&content) {
        return Err("Note is not encrypted".to_string());
    }

    let ciphertext = dearmor_decrypt(&content).map_err(|e| e.to_string())?;
    let decrypted = decrypt_with_session(&state.session, &ciphertext)
        .map_err(|e| e.to_string())?;

    let plaintext = String::from_utf8(decrypted)
        .map_err(|e| format!("Invalid UTF-8 in decrypted content: {}", e))?;

    std::fs::write(&file_path, plaintext)
        .map_err(|e| format!("Failed to write decrypted note: {}", e))?;

    Ok(())
}

/// Check if a note file is encrypted
#[tauri::command]
pub fn is_note_encrypted(path: String) -> Result<bool, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Note file not found: {}", path));
    }

    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read note: {}", e))?;

    Ok(is_encrypted(&content))
}

/// Check if content string is encrypted
#[tauri::command]
pub fn is_content_encrypted(content: String) -> bool {
    is_encrypted(&content)
}

// ============================================================================
// Keychain commands for persistent credential storage
// ============================================================================

/// Set password and optionally save to keychain
#[tauri::command]
pub fn set_encryption_password_with_save(
    state: State<'_, EncryptionState>,
    password: String,
    save_to_keychain: bool,
) -> Result<(), String> {
    state.session.set_password(password.clone());

    if save_to_keychain {
        // Clear any stored identity path since we're using password now
        let _ = delete_identity_path_from_keychain();
        save_password_to_keychain(&password).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Set identity and optionally save to keychain
#[tauri::command]
pub fn set_encryption_identity_with_save(
    state: State<'_, EncryptionState>,
    path: String,
    save_to_keychain: bool,
) -> Result<(), String> {
    let expanded_path = expand_tilde(&path);
    if !expanded_path.exists() {
        return Err(format!("Identity file not found: {}", path));
    }

    let path_str = expanded_path.to_string_lossy().to_string();
    state.session.set_identity_file(path_str.clone());

    if save_to_keychain {
        // Clear any stored password since we're using identity now
        let _ = delete_password_from_keychain();
        save_identity_path_to_keychain(&path_str).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Try to unlock from stored keychain credentials
#[tauri::command]
pub fn unlock_from_keychain(state: State<'_, EncryptionState>) -> Result<bool, String> {
    // Try password first
    if let Some(password) = load_password_from_keychain().map_err(|e| e.to_string())? {
        state.session.set_password(password);
        return Ok(true);
    }

    // Try identity path
    if let Some(path) = load_identity_path_from_keychain().map_err(|e| e.to_string())? {
        let expanded = expand_tilde(&path);
        if expanded.exists() {
            state.session.set_identity_file(expanded.to_string_lossy().to_string());
            return Ok(true);
        }
    }

    Ok(false)
}

/// Check if credentials are stored in keychain
#[tauri::command]
pub fn has_keychain_credentials() -> bool {
    has_stored_credentials()
}

/// Clear all stored credentials from keychain
#[tauri::command]
pub fn clear_keychain_credentials() -> Result<(), String> {
    delete_password_from_keychain().map_err(|e| e.to_string())?;
    delete_identity_path_from_keychain().map_err(|e| e.to_string())?;
    Ok(())
}

/// Lock session and optionally clear keychain
#[tauri::command]
pub fn lock_encryption_session_with_clear(
    state: State<'_, EncryptionState>,
    clear_keychain: bool,
) -> Result<(), String> {
    state.session.lock();

    if clear_keychain {
        delete_password_from_keychain().map_err(|e| e.to_string())?;
        delete_identity_path_from_keychain().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============================================================================
// Multi-recipient commands
// ============================================================================

/// Recipient info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipientInfo {
    pub id: String,
    pub name: String,
    pub public_key: String,
    pub identity_file: Option<String>,
    pub is_unlocked: bool,
}

/// Get public key from an identity file
#[tauri::command]
pub fn get_public_key_from_identity_file(path: String) -> Result<String, String> {
    let expanded_path = expand_tilde(&path);
    if !expanded_path.exists() {
        return Err(format!("Identity file not found: {}", path));
    }
    get_public_key_from_identity(&expanded_path.to_string_lossy())
        .map_err(|e| e.to_string())
}

/// Setup session for multi-recipient encryption
/// public_keys: list of age public keys to encrypt to
/// identity_paths: list of identity file paths for decryption (optional, for local decryption)
#[tauri::command]
pub fn setup_recipients_encryption(
    state: State<'_, EncryptionState>,
    public_keys: Vec<String>,
    identity_paths: Vec<String>,
) -> Result<(), String> {
    // Validate and expand identity paths
    let mut expanded_paths = Vec::new();
    for path in identity_paths {
        let expanded = expand_tilde(&path);
        if expanded.exists() {
            expanded_paths.push(expanded.to_string_lossy().to_string());
        }
    }

    // Set public keys for encryption
    state.session.set_public_keys(public_keys);

    // Set identity paths for decryption
    if !expanded_paths.is_empty() {
        state.session.set_recipient_identities(expanded_paths);
    }

    Ok(())
}

/// Add a single recipient identity for decryption
#[tauri::command]
pub fn add_recipient_identity(
    state: State<'_, EncryptionState>,
    path: String,
) -> Result<String, String> {
    let expanded_path = expand_tilde(&path);
    if !expanded_path.exists() {
        return Err(format!("Identity file not found: {}", path));
    }

    let path_str = expanded_path.to_string_lossy().to_string();

    // Get public key to return
    let public_key = get_public_key_from_identity(&path_str)
        .map_err(|e| e.to_string())?;

    // Add to session
    state.session.add_recipient_identity(path_str);

    Ok(public_key)
}

/// Add a public key for encryption (without identity file)
#[tauri::command]
pub fn add_recipient_public_key(
    state: State<'_, EncryptionState>,
    public_key: String,
) -> Result<(), String> {
    // Validate the public key format
    if !public_key.starts_with("age1") {
        return Err("Invalid public key format. Expected age1...".to_string());
    }

    let mut keys = state.session.get_public_keys();
    if !keys.contains(&public_key) {
        keys.push(public_key);
        state.session.set_public_keys(keys);
    }

    Ok(())
}

/// Get current recipient public keys
#[tauri::command]
pub fn get_recipient_public_keys(
    state: State<'_, EncryptionState>,
) -> Vec<String> {
    state.session.get_public_keys()
}

/// Clear all recipient configuration
#[tauri::command]
pub fn clear_recipients(
    state: State<'_, EncryptionState>,
) -> Result<(), String> {
    state.session.set_public_keys(Vec::new());
    state.session.lock();
    Ok(())
}
