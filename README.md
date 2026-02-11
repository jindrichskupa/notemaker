# Notemaker

A keyboard-first desktop note-taking application for developers and DevOps engineers. Built with Tauri, SolidJS, and Rust.

## Features

### Core
- **Markdown Editor** - CodeMirror 6 with syntax highlighting for 14+ languages
- **Inline Markdown** - Optional WYSIWYG-like rendering (headers, bold, italic, links) while editing
- **Live Preview** - Real-time markdown rendering with split view
- **Notebooks** - Block-based documents with executable code (Shell, Python, Ruby)
- **Vim Mode** - Optional Vim keybindings
- **Themes** - Light, Dark, or System preference

### Organization
- **Vault-based** - Organize notes in local folders
- **Quick Vault Switching** - Fast access to recent vaults
- **File Tree** - Drag & drop, context menu, folder management
- **Quick Open** - Fuzzy file search (⌘P)
- **Command Palette** - All actions accessible via keyboard (⌘K)
- **Tags & Backlinks** - Wiki-style [[links]] and tag system

### Developer Features
- **Code Execution** - Run shell, Python, and Ruby code blocks directly
- **Custom Interpreters** - Configure paths to Python/Ruby/Node environments per vault
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, Gantt charts
- **Frontmatter** - YAML metadata editor
- **Git Integration** - Stage, commit, view history
- **Encryption** - age-based encryption for sensitive content

### Export
- **HTML Export** - Styled or plain HTML
- **PDF Export** - Print-ready output

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)

### Development

```bash
# Clone repository
git clone https://github.com/cookielab/notemaker.git
cd notemaker

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Build

```bash
# Build for production
pnpm tauri build
```

Binaries will be in `src-tauri/target/release/bundle/`.

### Testing

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage
```

## Keyboard Shortcuts

### Global
| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `⌘P` | Quick open (files) |
| `⌘N` | New note |
| `⌘⇧N` | New notebook |
| `⌘⇧T` | New from template |
| `⌘O` | Open vault |
| `⌘S` | Save |
| `⌘\` | Toggle sidebar |
| `⌘⇧F` | Global search |
| `⌘⇧G` | Git panel |
| `⌘⇧V` | Toggle Vim mode |
| `⌘⇧L` | Toggle Light/Dark theme |

### Editor Modes
| Shortcut | Action |
|----------|--------|
| `⌘1` | Source mode |
| `⌘2` | Split mode |
| `⌘3` | Preview mode |
| `⌘E` | Cycle modes |

### Notebook
| Shortcut | Action |
|----------|--------|
| `⌘R` | Run code block |
| `⌘D` | Add block below |
| `⌥↑` | Move block up |
| `⌥↓` | Move block down |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Tauri 2.0 |
| Backend | Rust |
| Frontend | SolidJS |
| Editor | CodeMirror 6 |
| Styling | Tailwind CSS 4 |
| Markdown | unified/remark/rehype |
| Diagrams | Mermaid |
| Git | git2 (Rust) |
| Encryption | age |

## Project Structure

```
notemaker/
├── src/                    # Frontend (SolidJS)
│   ├── components/         # UI components
│   ├── lib/               # Libraries and utilities
│   │   ├── store/         # State management
│   │   ├── editor/        # CodeMirror config
│   │   ├── markdown/      # Markdown rendering
│   │   └── commands/      # Command palette
│   └── App.tsx
├── src-tauri/             # Backend (Rust)
│   └── src/
│       ├── fs/            # Filesystem, notebooks, encryption
│       └── git/           # Git operations
└── requirements/          # Feature specifications
```

## Encryption

Notemaker uses the [age](https://age-encryption.org/) encryption format for securing sensitive content.

### Setup

1. Install age: `brew install age` (macOS) or `apt install age` (Linux)
2. Generate identity: `age-keygen -o ~/.age/key.txt`
3. In Settings → Encryption, select your identity file or use password

### Features
- Encrypt individual notebook blocks
- Encrypt entire note files
- Password-based (scrypt) or identity file (X25519)
- Session-based unlock (keys never stored on disk)

## Templates

Built-in templates for common use cases:
- Meeting Notes
- Daily Note
- Project Documentation
- API Documentation
- Runbook
- Incident Report
- Technical RFC
- Architecture Decision Record
- Code Review
- Sprint Retrospective
- Learning Notes

## Configuration

Vault configuration is stored in `.notemaker/config.yaml`:

```yaml
version: 1
vault:
  name: "My Notes"
editor:
  font_size: 14
  line_height: 1.6
  word_wrap: true
git:
  enabled: true
  auto_commit: false
encryption:
  enabled: false
  method: password
interpreters:
  shell: /bin/bash
  python: /usr/bin/python3
  ruby: /usr/bin/ruby
  node: /usr/bin/node
```

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

---

Built with ❤️ by [Cookielab](https://github.com/cookielab)
