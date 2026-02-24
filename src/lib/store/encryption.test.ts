import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("encryptionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recipients encryption", () => {
    it("should have own identity tracking signals", async () => {
      // Due to SolidJS createRoot requirements, we verify the module exports
      // rather than testing reactive behavior directly
      const { encryptionStore } = await import("./encryption");

      expect(encryptionStore).toBeDefined();
      expect(typeof encryptionStore.ownIdentityPath).toBe("function");
      expect(typeof encryptionStore.ownPublicKey).toBe("function");
      expect(typeof encryptionStore.setOwnIdentity).toBe("function");
      expect(typeof encryptionStore.clearOwnIdentity).toBe("function");
    });

    it("should have recipient management functions", async () => {
      const { encryptionStore } = await import("./encryption");

      expect(typeof encryptionStore.setupWithRecipients).toBe("function");
      expect(typeof encryptionStore.addRecipient).toBe("function");
      expect(typeof encryptionStore.getCurrentPublicKeys).toBe("function");
      expect(typeof encryptionStore.clearAllRecipients).toBe("function");
    });

    it("should have core encryption functions", async () => {
      const { encryptionStore } = await import("./encryption");

      expect(typeof encryptionStore.encrypt).toBe("function");
      expect(typeof encryptionStore.decrypt).toBe("function");
      expect(typeof encryptionStore.isUnlocked).toBe("function");
      expect(typeof encryptionStore.lock).toBe("function");
    });
  });
});
