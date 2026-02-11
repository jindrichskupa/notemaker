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
  EncryptionMethod,
} from "../fs";
import { vaultStore } from "./vault";

function createEncryptionStore() {
  const [isUnlocked, setIsUnlocked] = createSignal(false);
  const [method, setMethod] = createSignal<EncryptionMethod>("password");
  const [hasStoredCredentials, setHasStoredCredentials] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

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
  // Returns: { success: boolean, error?: string }
  async function tryAutoUnlock(): Promise<{ success: boolean; error?: string }> {
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

      // Password method but no keychain credentials
      return { success: false, error: "Encryption locked. Set password in Vault Settings." };
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

  return {
    // State
    isUnlocked,
    method,
    hasStoredCredentials,
    isLoading,
    error,

    // Actions
    initialize,
    tryAutoUnlock,
    checkUnlockState,
    unlockWithPassword,
    unlockWithIdentity,
    lock,
    forgetCredentials,
    encrypt,
    decrypt,
  };
}

export const encryptionStore = createRoot(createEncryptionStore);
