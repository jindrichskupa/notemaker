import { createSignal, createRoot } from "solid-js";
import {
  isEncryptionUnlocked,
  setEncryptionPasswordWithSave,
  setEncryptionIdentityWithSave,
  lockEncryptionSessionWithClear,
  unlockFromKeychain,
  hasKeychainCredentials,
  clearKeychainCredentials,
  encryptBlock,
  decryptBlock,
  getVaultConfig,
  setupRecipientsEncryption,
  addRecipientIdentity,
  getRecipientPublicKeys,
  clearRecipients,
  getPublicKeyFromIdentityFile,
  type EncryptionMethod,
  type Recipient,
} from "../fs";
import { vaultStore } from "./vault";

function createEncryptionStore() {
  const [isUnlocked, setIsUnlocked] = createSignal(false);
  const [method, setMethod] = createSignal<EncryptionMethod>("password");
  const [hasStoredCredentials, setHasStoredCredentials] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [recipients, setRecipients] = createSignal<Recipient[]>([]);
  const [showPasswordDialog, setShowPasswordDialog] = createSignal(false);
  const [pendingUnlockCallback, setPendingUnlockCallback] = createSignal<(() => void) | null>(null);
  const [ownIdentityPath, setOwnIdentityPath] = createSignal<string | null>(null);
  const [ownPublicKey, setOwnPublicKey] = createSignal<string | null>(null);

  // Check initial state and try to auto-unlock from keychain
  async function initialize() {
    try {
      // Check if already unlocked
      const unlocked = await isEncryptionUnlocked();
      if (unlocked) {
        setIsUnlocked(true);
        return;
      }

      // Check if we have stored credentials
      const hasStored = await hasKeychainCredentials();
      setHasStoredCredentials(hasStored);

      // Try to auto-unlock from keychain
      if (hasStored) {
        const success = await unlockFromKeychain();
        if (success) {
          setIsUnlocked(true);
          console.log("Auto-unlocked encryption from keychain");
        }
      }
    } catch (e) {
      console.error("Failed to initialize encryption state:", e);
      setIsUnlocked(false);
    }
  }

  // Try to auto-unlock using vault config and keychain
  // Returns: { success: boolean, error?: string, needsPassword?: boolean }
  async function tryAutoUnlock(): Promise<{ success: boolean; error?: string; needsPassword?: boolean }> {
    // Already unlocked?
    if (isUnlocked()) {
      return { success: true };
    }

    const vault = vaultStore.vault();
    if (!vault) {
      return { success: false, error: "No vault open" };
    }

    try {
      // Load vault config to check encryption settings
      const config = await getVaultConfig(vault.path);

      if (!config.encryption?.enabled) {
        return { success: false, error: "Encryption not enabled. Configure in Vault Settings." };
      }

      // Try keychain first
      const hasStored = await hasKeychainCredentials();
      if (hasStored) {
        const success = await unlockFromKeychain();
        if (success) {
          setIsUnlocked(true);
          setHasStoredCredentials(true);
          return { success: true };
        }
      }

      // If method is identity file, try to use it from config
      if (config.encryption.method === "identityfile") {
        const identityPath = config.encryption.identity_file;
        if (identityPath) {
          try {
            await setEncryptionIdentityWithSave(identityPath, false);
            setIsUnlocked(true);
            setMethod("identityfile");
            return { success: true };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, error: `Invalid identity file: ${msg}` };
          }
        } else {
          return { success: false, error: "Identity file path not configured. Set in Vault Settings." };
        }
      }

      // If method is recipients, try to set up from config
      if (config.encryption.method === "recipients") {
        const configRecipients = config.encryption.recipients || [];
        if (configRecipients.length > 0) {
          try {
            const publicKeys = configRecipients.map(r => r.public_key);
            const identityPaths = configRecipients
              .filter(r => r.identity_file)
              .map(r => r.identity_file!);

            await setupRecipientsEncryption(publicKeys, identityPaths);
            setIsUnlocked(true);
            setMethod("recipients");
            setRecipients(configRecipients);
            return { success: true };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { success: false, error: `Failed to setup recipients: ${msg}` };
          }
        } else {
          return { success: false, error: "No recipients configured. Add recipients in Vault Settings." };
        }
      }

      // Password method but no keychain credentials - need to prompt user
      return { success: false, error: "Password required", needsPassword: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  // Check unlock state without auto-unlock
  async function checkUnlockState() {
    try {
      const unlocked = await isEncryptionUnlocked();
      setIsUnlocked(unlocked);

      const hasStored = await hasKeychainCredentials();
      setHasStoredCredentials(hasStored);
    } catch (e) {
      console.error("Failed to check encryption state:", e);
      setIsUnlocked(false);
    }
  }

  // Initialize on load
  initialize();

  async function unlockWithPassword(
    password: string,
    saveToKeychain: boolean = false
  ): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      await setEncryptionPasswordWithSave(password, saveToKeychain);
      setIsUnlocked(true);
      setMethod("password");
      if (saveToKeychain) {
        setHasStoredCredentials(true);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function unlockWithIdentity(
    path: string,
    saveToKeychain: boolean = false
  ): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      await setEncryptionIdentityWithSave(path, saveToKeychain);
      setIsUnlocked(true);
      setMethod("identityfile");
      if (saveToKeychain) {
        setHasStoredCredentials(true);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function lock(clearKeychain: boolean = false): Promise<void> {
    try {
      await lockEncryptionSessionWithClear(clearKeychain);
      setIsUnlocked(false);
      if (clearKeychain) {
        setHasStoredCredentials(false);
      }
    } catch (e) {
      console.error("Failed to lock encryption session:", e);
    }
  }

  async function forgetCredentials(): Promise<void> {
    try {
      await clearKeychainCredentials();
      setHasStoredCredentials(false);
    } catch (e) {
      console.error("Failed to clear keychain credentials:", e);
    }
  }

  async function encrypt(content: string): Promise<string> {
    if (!isUnlocked()) {
      throw new Error("Encryption session is locked");
    }
    return encryptBlock(content);
  }

  async function decrypt(content: string): Promise<string> {
    if (!isUnlocked()) {
      throw new Error("Encryption session is locked");
    }
    return decryptBlock(content);
  }

  // Setup encryption with multiple recipients
  async function setupWithRecipients(
    recipientList: Recipient[]
  ): Promise<boolean> {
    setIsLoading(true);
    setError(null);

    try {
      const publicKeys = recipientList.map(r => r.public_key);
      const identityPaths = recipientList
        .filter(r => r.identity_file)
        .map(r => r.identity_file!);

      await setupRecipientsEncryption(publicKeys, identityPaths);
      setIsUnlocked(true);
      setMethod("recipients");
      setRecipients(recipientList);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  // Add a recipient identity and return its public key
  async function addRecipient(
    identityPath: string
  ): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    try {
      const publicKey = await addRecipientIdentity(identityPath);
      return { success: true, publicKey };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  // Get currently configured public keys
  async function getCurrentPublicKeys(): Promise<string[]> {
    try {
      return await getRecipientPublicKeys();
    } catch {
      return [];
    }
  }

  // Clear all recipients and lock session
  async function clearAllRecipients(): Promise<void> {
    try {
      await clearRecipients();
      setRecipients([]);
      setIsUnlocked(false);
    } catch (e) {
      console.error("Failed to clear recipients:", e);
    }
  }

  // Set own identity (for displaying public key)
  async function setOwnIdentity(identityPath: string): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    try {
      const publicKey = await getPublicKeyFromIdentityFile(identityPath);
      setOwnIdentityPath(identityPath);
      setOwnPublicKey(publicKey);
      return { success: true, publicKey };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: msg };
    }
  }

  // Clear own identity
  function clearOwnIdentity(): void {
    setOwnIdentityPath(null);
    setOwnPublicKey(null);
  }

  // Request password from user (opens dialog)
  function requestPassword(callback?: () => void): void {
    setPendingUnlockCallback(() => callback || null);
    setShowPasswordDialog(true);
  }

  // Handle password dialog confirmation
  async function handlePasswordConfirm(password: string, saveToKeychain: boolean): Promise<boolean> {
    const success = await unlockWithPassword(password, saveToKeychain);
    if (success) {
      setShowPasswordDialog(false);
      const callback = pendingUnlockCallback();
      if (callback) {
        callback();
        setPendingUnlockCallback(null);
      }
    }
    return success;
  }

  // Cancel password dialog
  function cancelPasswordDialog(): void {
    setShowPasswordDialog(false);
    setPendingUnlockCallback(null);
  }

  return {
    // State
    isUnlocked,
    method,
    hasStoredCredentials,
    isLoading,
    error,
    recipients,
    showPasswordDialog,
    ownIdentityPath,
    ownPublicKey,

    // Actions
    initialize,
    tryAutoUnlock,
    checkUnlockState,
    unlockWithPassword,
    unlockWithIdentity,
    setupWithRecipients,
    addRecipient,
    getCurrentPublicKeys,
    clearAllRecipients,
    setOwnIdentity,
    clearOwnIdentity,
    lock,
    forgetCredentials,
    encrypt,
    decrypt,
    requestPassword,
    handlePasswordConfirm,
    cancelPasswordDialog,
  };
}

export const encryptionStore = createRoot(createEncryptionStore);
