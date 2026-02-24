# Encryption Guide

Notemaker uses [age encryption](https://age-encryption.org/) for securing notes and code blocks.

## Encryption Methods

### Password

Simple password-based encryption using scrypt key derivation.

- **Pros:** Easy to use, no files to manage
- **Cons:** Need to share password with collaborators

### Identity File

Single-user encryption using an age X25519 keypair.

- **Pros:** More secure than password, no password to remember
- **Cons:** Single user only

### Multiple Recipients

Multi-user encryption where each person has their own identity.

- **Pros:** Each user has their own key, revocable access
- **Cons:** More setup required

## Setting Up Multi-User Encryption

### 1. Generate Your Identity

In Notemaker:
1. Go to **Settings → Encryption**
2. Enable encryption and select **Multiple Recipients**
3. Click **Generate New Identity...**
4. Choose a secure location (e.g., `~/.age/notemaker.txt`)

Or via command line:
```bash
age-keygen -o ~/.age/notemaker.txt
```

### 2. Share Your Public Key

Your public key is displayed in **Settings → Encryption → Your Identity**.

Click **Copy** to copy it to clipboard and share with collaborators.

Public keys look like: `age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p`

### 3. Add Collaborators

For each collaborator:
1. Get their public key (they share it with you)
2. Go to **Settings → Encryption**
3. Under **Add Recipient**, enter their name and paste their public key
4. Click **Add Recipient**

## Security Notes

- **Keep your identity file secure** — it contains your private key
- **Public keys are safe to share** — they can only be used to encrypt, not decrypt
- **Back up your identity file** — if lost, you cannot decrypt your notes
- Encrypted notes can only be decrypted by recipients whose public keys were used during encryption

## Command Line Tools

Generate a new identity:
```bash
age-keygen -o identity.txt
```

Encrypt a file:
```bash
age -r age1... -o encrypted.txt plaintext.txt
```

Decrypt a file:
```bash
age -d -i identity.txt -o plaintext.txt encrypted.txt
```

## Troubleshooting

### "Identity file not found"

The identity file path in settings is incorrect or the file was moved/deleted.

### "No matching key found"

You don't have access to decrypt this note. The note was encrypted for different recipients.

### "Invalid identity file"

The file is not a valid age identity. It should contain a line starting with `AGE-SECRET-KEY-`.

### "Invalid public key format"

Public keys must start with `age1`. Make sure you're copying the full key without any extra spaces.
