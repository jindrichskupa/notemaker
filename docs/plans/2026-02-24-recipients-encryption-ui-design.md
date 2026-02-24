# Recipients Encryption UI - Design Document

**Date:** 2026-02-24
**Status:** Approved
**Related:** I-016 Recipients encryption

## Overview

Complete the recipients encryption feature by adding UI for key management, verifying the flow works end-to-end, adding tests, and documenting the feature.

## Current State

The backend is 95% complete:
- Rust encryption core with multi-recipient support
- Tauri commands for all recipient operations
- Frontend store with recipients support
- Basic UI in VaultSettingsDialog

## Gaps to Address

1. Public key sharing UI
2. Key generation helper
3. End-to-end verification
4. Automated tests
5. Documentation

## Approach

UI-First: Build UI → Manual test → Fix bugs → Add tests → Docs

## UI Design

### VaultSettingsDialog → Encryption Tab

**"Your Identity" section** (new, shown when method is `recipients`)

```
┌─────────────────────────────────────────────────┐
│ Your Identity                                   │
├─────────────────────────────────────────────────┤
│ Identity file: ~/.age/notemaker.txt    [Browse] │
│                                                 │
│ Your public key:                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ age1abc123...xyz789                    [📋] │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Share this key with collaborators so they can   │
│ encrypt notes for you.                          │
│                                                 │
│ [Generate New Identity...]                      │
└─────────────────────────────────────────────────┘
```

**Generate Identity Dialog** (new modal)

```
┌─────────────────────────────────────────────────┐
│ Generate New Identity                           │
├─────────────────────────────────────────────────┤
│ This will create a new age identity file.       │
│ Keep this file secure - it's your private key.  │
│                                                 │
│ Save location:                                  │
│ ┌─────────────────────────────────┐             │
│ │ ~/.age/notemaker.txt      [Browse]           │
│ └─────────────────────────────────┘             │
│                                                 │
│              [Cancel]  [Generate]               │
└─────────────────────────────────────────────────┘
```

**Inline help tooltips:**
- Info icon next to "Recipients" method explaining the concept
- Tooltip on public key explaining what to do with it

## Data Flow

### New Rust Command

```rust
generate_identity(path: String) -> Result<String, String>
```

Uses `age` crate to generate keypair, writes identity file, returns public key.

### Frontend Flow

```
User clicks "Generate New Identity..."
    ↓
GenerateIdentityDialog opens
    ↓
User picks save location via file picker
    ↓
Call Tauri: generate_identity(path)
    ↓
Backend generates keypair, saves file
    ↓
Returns public key
    ↓
Store updates: set identity file path + public key
    ↓
UI refreshes to show "Your Identity" section
```

### State Changes

**encryptionStore additions:**
- `ownIdentityPath: string | null` — Path to user's identity file
- `ownPublicKey: string | null` — User's public key
- `setOwnIdentity(path, publicKey)` — Set after generation or browse
- `loadOwnIdentity()` — Load from vault config on startup

**Vault config addition:**
```yaml
encryption:
  method: recipients
  own_identity: ~/.age/notemaker.txt
  recipients:
    - name: Alice
      public_key: age1...
```

## Error Handling

### Key Generation Errors

| Error | User Message | Recovery |
|-------|--------------|----------|
| Path not writable | "Cannot write to this location. Choose a different folder." | Show file picker again |
| File already exists | "A file already exists at this location. Overwrite?" | Confirm dialog |
| Parent directory missing | "Directory does not exist. Create it?" | Confirm + create |

### Identity Loading Errors

| Error | User Message | Recovery |
|-------|--------------|----------|
| File not found | "Identity file not found at {path}" | Show browse button |
| Invalid format | "This file is not a valid age identity" | Show browse button |
| Permission denied | "Cannot read identity file. Check permissions." | Show path, suggest fix |

### Encryption/Decryption Errors

| Error | User Message | Recovery |
|-------|--------------|----------|
| No recipients configured | "Add at least one recipient before encrypting" | Focus add recipient form |
| No matching identity | "You don't have access to decrypt this note" | Show which recipients can |

### Clipboard

- Show brief toast "Copied to clipboard" on success
- Fallback: "Could not copy. Select and copy manually."

## Testing Strategy

### Manual Testing Scenarios

1. Generate identity — Create new key, verify file exists, public key displays
2. Copy public key — Click copy, paste elsewhere, verify matches
3. Add recipient — Add another identity file, see it in list
4. Encrypt note — Enable encryption, create encrypted block, save
5. Decrypt note — Close and reopen vault, verify decryption works
6. Multi-recipient — Set up 2 identities, encrypt, decrypt with either
7. Error cases — Invalid paths, missing files, permission issues

### Automated Tests

| Test | Type | Location |
|------|------|----------|
| `generate_identity` creates valid file | Unit | `src-tauri/src/fs/encryption.rs` |
| Public key extraction works | Unit | `src-tauri/src/fs/encryption.rs` |
| Encrypt/decrypt round-trip | Integration | `src-tauri/src/fs/encryption.rs` |
| `encryptionStore` state management | Unit | `src/lib/store/encryption.test.ts` |
| Vault config saves/loads own_identity | Unit | `src/lib/store/encryption.test.ts` |

### Not Tested

- File picker UI (Tauri native dialog)
- Clipboard API (browser/OS level)
- Visual layout (manual verification)

## Documentation

### In-App Help

| Location | Text |
|----------|------|
| Recipients method info icon | "Encrypt notes for multiple people. Each recipient needs their own age identity to decrypt." |
| Your public key hint | "Share this key with collaborators so they can encrypt notes for you." |
| Generate identity tooltip | "Create a new age identity file for encryption" |
| Add recipient hint | "Add collaborators by their identity file or public key" |

### docs/encryption.md

User-facing guide covering:
- Encryption methods overview
- Setting up multi-user encryption
- Generating identity
- Sharing public keys
- Adding collaborators
- Command line alternative (`age-keygen`)
- Security notes
