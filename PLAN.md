# Notemaker - Plán projektu

Multiplatformní desktop aplikace pro vývojářské a DevOps poznámky.
**Primární platforma: Desktop (macOS, Windows, Linux). Mobile je sekundární.**

## Stav implementace

**Poslední aktualizace:** 2026-02-24 (I-016 Recipients encryption dokončeno)

### Dokončené funkce ✅

| ID | Funkce | Popis |
|----|--------|-------|
| REQ-001 | Tauri scaffold | Tauri 2.0 + SolidJS + Vite |
| REQ-002 | File system | Rust notify crate, file watcher, CRUD operace |
| REQ-003 | Editor CodeMirror | CodeMirror 6, syntax highlighting 14+ jazyků |
| REQ-004 | Markdown Preview | unified/remark/rehype, live preview |
| REQ-005 | Vim Mode | @replit/codemirror-vim, persistence |
| REQ-006 | Frontmatter | YAML parser, FrontmatterEditor UI |
| REQ-007 | Navigace | TreeView, Sidebar, drag & drop |
| REQ-008 | Mermaid | Flowcharts, sequence, gantt, a další |
| REQ-009 | Search | In-memory indexer, fuzzy search |
| REQ-010 | Git operace | git2 crate, commit, log, stage, discard, GitPanel UI, status indicator |
| REQ-013 | Editor módy | Source / Split / Preview |
| REQ-014 | Frontmatter Editor | UI pro editaci YAML metadata |
| REQ-015 | Tags System | TagsStore, TagsPanel, barevné tagy |
| REQ-016 | Note Linking | Wiki-style [[links]], LinksStore |
| REQ-017 | Backlinks | BacklinksPanel, OutgoingLinksPanel |
| REQ-018 | Table of Contents | TableOfContents, auto z headings |
| REQ-019 | Export | HTML/PDF export, ExportDialog, Command Palette integrace |
| REQ-020 | Settings Panel | SettingsPanel, persistence |
| REQ-022 | Keyboard Shortcuts Help | ShortcutsHelp dialog |
| REQ-023 | Keyboard & Command Palette | Cmd+K, Cmd+P, globální shortcuts |
| REQ-024 | Templates | 11 built-in note šablon + 6 notebook šablon + TemplateDialog + SaveAsTemplateDialog |
| REQ-025 | Daily Notes | Daily notes utility, formátování |
| REQ-026 | Notebook Editor | Block-based editor, executable code blocks (shell, python, ruby), process termination, block type inheritance |
| REQ-027 | Encryption (Secrets) | age crate šifrování bloků a souborů, password + identity file podpora, session cache |

### Zbývající funkce ⏳

| ID | Funkce | Priorita | Poznámka |
|----|--------|----------|----------|
| REQ-011 | Git Conflict Resolution | Nízká | Odloženo |
| REQ-012 | Git History UI | Nízká | Odloženo |
| REQ-021 | Themes | Nízká | Light/Dark themes (částečně v settings)

## Struktura projektu

```
notemaker/
├── src/                          # Frontend (SolidJS)
│   ├── components/
│   │   ├── Editor.tsx           # CodeMirror editor
│   │   ├── EditorWithPreview.tsx # Editor + preview modes
│   │   ├── Preview.tsx          # Markdown preview
│   │   ├── SplitView.tsx        # Resizable split panel
│   │   ├── FrontmatterEditor.tsx # YAML metadata editor
│   │   ├── EditorModeToggle.tsx # Source/Split/Preview toggle
│   │   ├── Sidebar.tsx          # File browser
│   │   ├── TreeView.tsx         # File tree (folders, notebooks, files)
│   │   ├── CommandPalette.tsx   # Cmd+K palette
│   │   ├── QuickOpen.tsx        # Cmd+P file search
│   │   ├── SearchPanel.tsx      # Global search
│   │   ├── ContextMenu.tsx      # Right-click menu
│   │   ├── ExportDialog.tsx     # HTML/PDF export dialog
│   │   ├── NotebookEditor.tsx   # Block-based notebook editor
│   │   ├── NotebookBlock.tsx    # Individual notebook block
│   │   ├── CodeBlockEditor.tsx  # CodeMirror for code blocks
│   │   ├── GitPanel.tsx         # Git operations panel
│   │   ├── GitStatusIndicator.tsx # Git status in header
│   │   └── Icons.tsx            # SVG icons
│   ├── lib/
│   │   ├── editor/
│   │   │   ├── extensions.ts    # CodeMirror extensions
│   │   │   ├── languages.ts     # 14+ language support
│   │   │   ├── vim-mode.ts      # Vim mode manager
│   │   │   └── autosave.ts      # Auto-save controller
│   │   ├── commands/
│   │   │   ├── registry.ts      # Command registry
│   │   │   └── index.ts         # Command definitions
│   │   ├── frontmatter/
│   │   │   ├── parser.ts        # YAML parser
│   │   │   └── types.ts         # Types
│   │   ├── markdown/
│   │   │   ├── renderer.ts      # MD→HTML renderer
│   │   │   └── mermaid.ts       # Mermaid support
│   │   ├── search/
│   │   │   └── engine.ts        # In-memory search
│   │   ├── store/
│   │   │   ├── vault.ts         # App state
│   │   │   └── notebook.ts      # Notebook state
│   │   ├── keyboard/
│   │   │   └── handler.ts       # Global shortcuts
│   │   ├── git/
│   │   │   └── api.ts           # Git API bindings
│   │   ├── tags/
│   │   │   └── index.ts         # Tags system
│   │   ├── links/
│   │   │   └── index.ts         # Note linking system
│   │   ├── toc/
│   │   │   └── index.ts         # Table of contents
│   │   ├── settings/
│   │   │   └── index.ts         # Settings store
│   │   ├── templates/
│   │   │   └── index.ts         # Note templates
│   │   ├── export/
│   │   │   └── index.ts         # Export service (HTML/PDF)
│   │   ├── daily/
│   │   │   └── index.ts         # Daily notes
│   │   └── store/
│   │       └── encryption.ts    # Encryption state
│   ├── App.tsx
│   └── index.css                # Tailwind + custom styles
├── src-tauri/                   # Backend (Rust)
│   └── src/
│       ├── fs/
│       │   ├── commands.rs      # File CRUD, notebook ops, code execution
│       │   ├── encryption.rs    # age encryption core
│       │   ├── encryption_commands.rs # Tauri encryption commands
│       │   ├── watcher.rs       # File watcher (notify)
│       │   └── types.rs
│       ├── git/
│       │   ├── commands.rs      # Git operations (git2)
│       │   └── types.rs
│       ├── commands.rs
│       └── lib.rs
├── requirements/                # Feature requirements
└── PLAN.md
```

## Keyboard Shortcuts

### Globální
| Klávesa | Akce |
|---------|------|
| `Cmd+K` | Command palette |
| `Cmd+P` | Quick open (soubory) |
| `Cmd+N` | Nová poznámka |
| `Cmd+Shift+N` | Nový notebook |
| `Cmd+Shift+T` | Nová z šablony |
| `Cmd+O` | Otevřít vault |
| `Cmd+S` | Uložit |
| `Cmd+W` | Zavřít poznámku |
| `Cmd+Q` | Ukončit aplikaci |
| `Cmd+\` | Toggle sidebar |
| `Cmd+Shift+F` | Globální hledání |
| `Cmd+Shift+G` | Git commit |
| `Cmd+Shift+V` | Toggle Vim mode |

### Editor módy
| Klávesa | Akce |
|---------|------|
| `Cmd+1` | Source mode |
| `Cmd+2` | Split mode |
| `Cmd+3` | Preview mode |
| `Cmd+E` | Cycle modes |

### Notebook Editor
| Klávesa | Akce |
|---------|------|
| `Cmd+R` | Spustit kód (Run) |
| `Cmd+D` | Přidat blok pod aktuální |
| `Alt+↑` | Přesunout blok nahoru |
| `Alt+↓` | Přesunout blok dolů |
| `Backspace` | Smazat prázdný blok |

### Git
| Klávesa | Akce |
|---------|------|
| `Cmd+Shift+G` | Otevřít Git panel |

## Klíčové principy

### 1. Keyboard-First (PRIORITA)
- **Vše ovladatelné pouze klávesnicí** - žádná akce nevyžaduje myš
- Command palette (Cmd+K) jako centrální ovládací prvek
- Konzistentní keyboard shortcuts napříč celou aplikací
- Vim mode jako volitelný bonus
- Viditelné focus indicators

### 2. Offline-First
- Vše funguje bez připojení k internetu
- Lokální soubory, žádná závislost na cloudu

### 3. File-Based
- Čistý Markdown, žádný vendor lock-in
- Soubory čitelné v jakémkoli editoru
- Git jako volitelný backend

### 4. Developer-Focused
- Syntax highlighting pro 14+ jazyků
- Mermaid diagramy
- Frontmatter metadata

## Technologický stack

| Vrstva | Technologie | Verze |
|--------|-------------|-------|
| Runtime | Tauri | 2.0 |
| Backend | Rust | - |
| Frontend | SolidJS | - |
| Editor | CodeMirror | 6 |
| Styling | Tailwind CSS | 4 |
| Markdown | unified/remark/rehype | - |
| Diagrams | Mermaid | 11.x |
| Git | git2 (Rust) | 0.19 |
| Vim | @replit/codemirror-vim | - |

## Další kroky

### Opravy / Úpravy 🔧

| # | Úkol | Priorita | Stav |
|---|------|----------|------|
| F-001 | **Centralizace klávesových zkratek** | Vysoká | ✅ Hotovo - `keyboard/shortcuts.ts` jako single source of truth, `ShortcutsHelp.tsx` aktualizován, neimplementované zkratky označeny jako "(TBD)" |
| F-002 | **Focus management a platnost zkratek** | Vysoká | ✅ Hotovo - editor mode zkratky (⌘1/2/3/E) integrovány do command registry |
| F-003 | **Typy bloků v notebooku** | Střední | ✅ Hotovo - 11 jazyků, rozlišení executable/non-executable, Run tlačítko jen pro spustitelné |
| F-004 | **Správa výstupu code bloků** | Střední | ✅ Částečně - Clear output tlačítko přidáno, zbývá settings a export |
| F-005 | **Rozšíření šablon** | Nízká | ✅ Hotovo - 11 šablon, TemplateDialog, Cmd+Shift+T |
| F-006 | **Skrýt složku .notemaker** | Nízká | ✅ Hotovo - skryta ve frontend i backend |
| F-007 | **Opravit vyhledávání** | Vysoká | ✅ Hotovo - notebooky zahrnuty do `getAllNotes()` a `searchEngine.indexNotebook()` |
| F-008 | **File browser state persistence** | Střední | ✅ Hotovo - `.notemaker/.local/state.json`, konfigurovatelné v config.json |
| F-009 | **Git status indicators** | Střední | ✅ Hotovo - barevné indikátory v TreeView, polling 5s |
| F-010 | **Notebook block type inheritance** | Nízká | ✅ Hotovo - nové bloky dědí typ z aktuálního/předchozího bloku |
| F-011 | **Process termination** | Střední | ✅ Hotovo - Stop tlačítko pro běžící scripty, PID tracking, process groups |
| F-012 | **Git panel layout** | Nízká | ✅ Hotovo - změny v řádcích pod sebou, Stage/Discard vždy viditelné |

### Implementace 🚀

| # | Úkol | Priorita | Analýza |
|---|------|----------|---------|
| I-001 | **Konverze poznámky na notebook** | Střední | ✅ Hotovo - `convert.ts`, Rust command `convert_note_to_notebook`, Command Palette "Convert to Notebook" |
| I-002 | **UI/UX vylepšení** | Střední | ✅ Hotovo - CSS variables pro appearance, tooltips, touch targets, vylepšené spacing pro kbd elementy |
| I-003 | **REQ-021 Themes** | ✅ Hotovo | Light/Dark/System theme. Settings → Appearance → Theme. Zkratka ⌘⇧L pro toggle. CSS overrides pro všechny komponenty v light mode. |
| I-004 | **REQ-011 Git Conflict Resolution** | Nízká | UI pro řešení merge konfliktů. Odloženo. |
| I-005 | **REQ-012 Git History UI** | Nízká | Vizualizace historie commitů. Odloženo. |
| I-006 | **Testing** | ✅ Hotovo | Vitest + happy-dom. 55 unit testů pro: settings store, recent vaults, command registry, frontmatter parser. Scripty: `pnpm test`, `pnpm test:run`, `pnpm test:coverage`. |
| I-007 | **Performance** | Nízká | Code splitting, lazy loading velkých dependencies (Mermaid, CodeMirror langs). |
| I-008 | **Podpora secrets** | ✅ Hotovo | Implementováno pomocí `age` crate. Password-based (scrypt) i identity file šifrování. EncryptionSession pro bezpečnou session cache. UI: PasswordDialog, VaultSettings/Encryption tab. |
| I-009 | **Inline Markdown Rendering** | ✅ Hotovo | ViewPlugin s dekoracemi pro headings (1-6), bold, italic, strikethrough, inline code, links. Skrývání markdown syntaxe, zobrazení na aktivním řádku. Light/dark theme podpora. Toggle v Settings → Editor → Inline Markdown. |
| I-010 | **Rychlé přepínání vaultů** | ✅ Hotovo | VaultSwitcher dropdown v sidebar header, recentVaultsStore v localStorage (max 10), dynamické příkazy "Switch to: X" v command palette, možnost odstranit vault z recent seznamu. |
| I-011 | **Unifikace notebook bloků** | ✅ Hotovo | Všechny bloky jsou "kód" s vybraným jazykem. Markdown jako jazyk v seznamu (výchozí). Language dropdown vždy viditelný, zjednodušeno API na `onChangeLanguage`. Pravidla: 1) jazyk předchozího bloku, 2) Markdown jako default. |
| I-012 | **Konfigurace interpreterů** | ✅ Hotovo | `InterpreterSettings` v `.notemaker/config.yaml` - shell, python, ruby, node. Fallback na systémové cesty. UI tab "Interpreters" ve VaultSettingsDialog. Notebook store automaticky používá interpreter z config. |
| I-013 | **Multiplatformní konfigurace** | ✅ Hotovo | Windows/Linux bundle config v tauri.conf.json. NSIS installer pro Windows, AppImage/deb/rpm pro Linux. Trash integrace pro všechny platformy. GitHub Actions CI/CD workflow pro automatické buildy. Vygenerovány všechny ikony (ico, icns, png). |
| I-014 | **Custom note templates** | ✅ Hotovo | Uživatelské šablony v `.notemaker/templates/`. SaveAsTemplateDialog pro uložení poznámky jako šablony. Frontmatter metadata (name, description, category, icon). Command Palette "Save as Template". |
| I-015 | **Notebook templates** | ✅ Hotovo | 6 built-in notebook šablon (Python Tutorial, Shell Script, Data Analysis, SQL Queries, API Testing, Blank). Badge "Notebook" v TemplateDialog. `notebookStore.createFromTemplate()` pro vytvoření z šablony. |
| I-016 | **Recipients encryption** | ✅ Hotovo | Multi-recipient age šifrování. UI pro generování identity, zobrazení/kopírování public key, přidávání recipients pomocí public key. Dokumentace v `docs/encryption.md`. |
| I-017 | **Attachment support** | ✅ Hotovo | Paste (Cmd+V) a drag & drop obrázků do editoru. Ukládání do `.assets` složky. Podporované formáty: PNG, JPG, GIF, WebP, SVG (max 10MB). |
| I-018 | **Inline image preview** | ✅ Hotovo | Zobrazení obrázků přímo v editoru místo markdown syntaxe. Max 400x300px. Na aktivním řádku se zobrazí syntax pro editaci. |
| I-019 | **Orphan assets cleanup** | ⏳ Plánováno | Detekce a mazání obrázků v `.assets` složkách, které nejsou referencovány v žádné poznámce. Command Palette "Clean Orphan Assets". |
| I-020 | **Shared assets folder** | ⏳ Plánováno | Volitelná sdílená složka pro assety na úrovni vaultu (`vault/.assets/`). Umožní snadné sdílení obrázků mezi poznámkami. |

## Multiplatformní podpora

### Desktop

| Platforma | Build | Installer | Stav |
|-----------|-------|-----------|------|
| macOS (arm64) | ✅ | .dmg, .app | Připraveno |
| macOS (x64) | ✅ | .dmg, .app | Připraveno |
| Windows (x64) | ✅ | .exe (NSIS), .msi | Připraveno (netestováno) |
| Linux (x64) | ✅ | .AppImage, .deb, .rpm | Připraveno (netestováno) |

### CI/CD

- `.github/workflows/build.yml` - automatické buildy pro všechny platformy
- Testy běží před buildem
- Release draft se vytvoří automaticky při push tagu `v*`

### Build lokálně

```bash
# macOS
pnpm tauri build

# Cross-compile (vyžaduje Docker nebo VM)
pnpm tauri build --target x86_64-pc-windows-msvc
pnpm tauri build --target x86_64-unknown-linux-gnu
```

## Metriky úspěchu

- [x] Startup time < 500ms
- [x] Žádná akce nevyžaduje více než 3 klávesy
- [x] 100% akcí dostupných z klávesnice
- [ ] Search results < 100ms
- [ ] Bundle size < 15MB (aktuálně ~1.6MB gzipped)
