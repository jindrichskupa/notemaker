# Changelog

All notable changes to Notemaker will be documented in this file.

## [0.2.0] - 2026-02-13

### Notebook Templates
- **6 Built-in Notebook Templates** - Python Tutorial, Shell Script, Data Analysis, SQL Queries, API Testing, Blank Notebook
- **Template Variables** - Support for `{{title}}`, `{{date}}`, etc. in notebook templates
- **Template Type Filter** - Separate notes and notebooks in template dialog

### Save as Template
- **Save Any Note as Template** - New "Save as Template" dialog (Cmd+Shift+S)
- **Custom Metadata** - Set name, description, category, and icon for templates
- **Vault-local Storage** - Templates saved in `.notemaker/templates/`
- **Template Override** - Vault templates can override built-in templates by ID

### Multi-Recipient Encryption
- **Recipients Mode** - Encrypt for multiple users with age X25519 public keys
- **Recipient Management** - Add/remove recipients in Vault Settings
- **Public Key Display** - View public keys for each recipient
- **Identity File Import** - Add recipients from age identity files

### Encryption UI Complete
- **Password Dialog** - Modal for entering encryption password with show/hide toggle
- **Keychain Integration** - Option to save password to system keychain for auto-unlock
- **Auto-Unlock Flow** - Automatic prompt when encryption is needed
- **Method Selection** - Choose between Password, Identity File, or Multiple Recipients
- **Block-Level Controls** - Encrypt/decrypt buttons on notebook blocks

### Technical
- New `SaveAsTemplateDialog` component
- New `PasswordDialog` component
- Extended `VaultSettingsDialog` with recipients UI
- Updated `encryptionStore` with dialog state management
- Backend support for multi-recipient age encryption
- New `BUILT_IN_NOTEBOOK_TEMPLATES` array with 6 templates

---

## [0.1.0] - 2026-02-13

### Initial Release

#### Core Features
- **Markdown Editor** - CodeMirror 6 with syntax highlighting for 14+ languages
- **Live Preview** - Real-time markdown preview with Mermaid diagram support
- **Vim Mode** - Optional Vim keybindings (toggle with Cmd+Shift+V)
- **Auto-save** - Automatic saving with debounce

#### Notebooks
- **Block-based Editor** - Interactive notebooks with executable code blocks
- **Code Execution** - Run Shell, Python, and Ruby code directly
- **Process Control** - Stop running scripts, view stdout/stderr output
- **Block Operations** - Add, delete, move, and change block types

#### Templates
- **Note Templates** - 11 built-in templates (Daily, Meeting, Project, Bug, Feature, How-To, etc.)
- **Template Categories** - Organize templates by category
- **Template Dialog** - Cmd+Shift+T to create from template

#### Organization
- **Vault-based** - Organize notes in vaults (folders)
- **File Tree** - Collapsible sidebar with drag & drop support
- **Quick Open** - Cmd+P for fast file navigation
- **Command Palette** - Cmd+K for all commands
- **Search** - Global search across all notes (Cmd+Shift+F)

#### Markdown Features
- **Frontmatter** - YAML metadata with visual editor
- **Wiki Links** - [[link]] syntax for note linking
- **Backlinks** - See what notes link to current note
- **Table of Contents** - Auto-generated from headings
- **Tags** - Label notes with colored tags
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, Gantt charts, etc.

#### Git Integration
- **Git Panel** - View changes, stage, commit (Cmd+Shift+G)
- **Status Indicators** - See modified/untracked files in tree
- **Initialize** - Create git repository for vault

#### Encryption
- **Block Encryption** - Encrypt individual notebook blocks
- **Note Encryption** - Encrypt entire notes
- **Password Mode** - Scrypt key derivation
- **Identity File Mode** - Age X25519 keys
- **Keychain Integration** - Save credentials securely

#### Editor Modes
- **Source Mode** - Pure markdown editing (Cmd+1)
- **Split Mode** - Editor and preview side by side (Cmd+2)
- **Preview Mode** - Read-only rendered view (Cmd+3)
- **Inline Rendering** - Optional inline markdown formatting

#### Export
- **HTML Export** - Export notes as standalone HTML
- **PDF Export** - Export notes as PDF documents

#### Settings
- **App Settings** - Global preferences
- **Vault Settings** - Per-vault configuration
- **Theme** - Light/Dark/System themes (Cmd+Shift+L to toggle)
- **Interpreter Config** - Custom paths for Python, Ruby, Shell

#### Keyboard-First Design
- 100% keyboard accessible
- Consistent shortcuts across app
- Shortcuts help dialog (Cmd+/)

#### Cross-Platform
- macOS (arm64, x64)
- Windows (x64) - NSIS installer
- Linux (x64) - AppImage, deb, rpm

### Technical
- **Frontend**: SolidJS + TypeScript + Tailwind CSS v4
- **Backend**: Rust + Tauri v2
- **Editor**: CodeMirror 6
- **Build**: Vite + pnpm

---

## Future Plans

- Format/Prettify code blocks
- Git conflict resolution UI
- Git history visualization
- Vault sync (cloud storage integration)
- Plugin system
