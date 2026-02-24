use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Encryption method configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EncryptionMethodConfig {
    Password,
    IdentityFile,
    Recipients,
}

impl Default for EncryptionMethodConfig {
    fn default() -> Self {
        Self::Password
    }
}

/// A recipient for multi-recipient encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipient {
    /// Unique identifier for this recipient
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// age public key (age1...)
    pub public_key: String,
    /// Optional path to identity file (for local decryption)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_file: Option<String>,
    /// When this recipient was added
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub added_at: Option<String>,
}

/// Encryption settings for the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionSettings {
    /// Whether encryption is enabled
    #[serde(default)]
    pub enabled: bool,
    /// Encryption method (password, identity file, or recipients)
    #[serde(default)]
    pub method: EncryptionMethodConfig,
    /// Path to identity file (when using IdentityFile method)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_file: Option<String>,
    /// List of recipients for multi-recipient encryption
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipients: Vec<Recipient>,
}

impl Default for EncryptionSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            method: EncryptionMethodConfig::Password,
            identity_file: None,
            recipients: Vec::new(),
        }
    }
}

/// Information about the opened vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub path: PathBuf,
    pub name: String,
    pub note_count: usize,
    pub has_git: bool,
    pub has_config: bool,
}

/// A file or directory entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: PathBuf,
    pub is_directory: bool,
    pub modified: u64,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

/// Content of a note with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteContent {
    pub path: PathBuf,
    pub content: String,
    pub modified: u64,
}

/// Notebook block type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BlockType {
    Markdown,
    Code,
}

/// A block in a notebook
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookBlock {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: BlockType,
    pub file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// Whether this block is encrypted
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encrypted: Option<bool>,
}

/// Notebook index file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookIndex {
    pub version: u32,
    pub blocks: Vec<NotebookBlock>,
}

/// Full notebook with content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notebook {
    pub path: PathBuf,
    pub name: String,
    pub blocks: Vec<NotebookBlockWithContent>,
}

/// Block with its content loaded
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookBlockWithContent {
    pub id: String,
    #[serde(rename = "type")]
    pub block_type: BlockType,
    pub language: Option<String>,
    pub content: String,
    /// Whether this block is encrypted
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encrypted: Option<bool>,
}

impl Default for NotebookIndex {
    fn default() -> Self {
        Self {
            version: 1,
            blocks: vec![],
        }
    }
}

/// File change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeEvent {
    pub path: PathBuf,
    pub kind: FileChangeKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileChangeKind {
    Create,
    Modify,
    Delete,
    Rename,
}

/// Interpreter settings for code execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterpreterSettings {
    /// Path to shell interpreter (default: bash)
    #[serde(default)]
    pub shell: Option<String>,
    /// Path to Python interpreter (default: python3)
    #[serde(default)]
    pub python: Option<String>,
    /// Path to Ruby interpreter (default: ruby)
    #[serde(default)]
    pub ruby: Option<String>,
    /// Path to Node.js interpreter (default: node)
    #[serde(default)]
    pub node: Option<String>,
}

impl Default for InterpreterSettings {
    fn default() -> Self {
        Self {
            shell: None,
            python: None,
            ruby: None,
            node: None,
        }
    }
}

/// Vault configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub version: u32,
    pub vault: VaultSettings,
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default)]
    pub git: GitSettings,
    #[serde(default)]
    pub formatting: FormattingSettings,
    #[serde(default)]
    pub file_tree: FileTreeSettings,
    #[serde(default)]
    pub encryption: EncryptionSettings,
    #[serde(default)]
    pub interpreters: InterpreterSettings,
}

/// File tree settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeSettings {
    /// Default expanded state: "all", "none", or "remember"
    #[serde(default = "default_tree_expanded")]
    pub default_expanded: String,
}

impl Default for FileTreeSettings {
    fn default() -> Self {
        Self {
            default_expanded: default_tree_expanded(),
        }
    }
}

fn default_tree_expanded() -> String {
    "remember".to_string()
}

/// Local state (not versioned in git)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalState {
    /// Expanded folder paths in the file tree
    #[serde(default)]
    pub expanded_paths: Vec<String>,
    /// Last opened note/notebook path
    #[serde(default)]
    pub last_opened: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSettings {
    pub name: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EditorSettings {
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    #[serde(default = "default_true")]
    pub word_wrap: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub auto_commit: bool,
    #[serde(default)]
    pub auto_sync_interval: u32,
    #[serde(default = "default_remote")]
    pub remote: String,
    #[serde(default = "default_branch")]
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FormattingSettings {
    #[serde(default = "default_auto_format")]
    pub auto_format_on_paste: String,
    #[serde(default = "default_indent")]
    pub default_indent: u32,
}

fn default_font_family() -> String {
    "JetBrains Mono".to_string()
}

fn default_font_size() -> u32 {
    14
}

fn default_line_height() -> f32 {
    1.6
}

fn default_true() -> bool {
    true
}

fn default_remote() -> String {
    "origin".to_string()
}

fn default_branch() -> String {
    "main".to_string()
}

fn default_auto_format() -> String {
    "ask".to_string()
}

fn default_indent() -> u32 {
    2
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            version: 1,
            vault: VaultSettings {
                name: "My Notes".to_string(),
                created: chrono::Utc::now().to_rfc3339(),
            },
            editor: EditorSettings::default(),
            git: GitSettings::default(),
            formatting: FormattingSettings::default(),
            file_tree: FileTreeSettings::default(),
            encryption: EncryptionSettings::default(),
            interpreters: InterpreterSettings::default(),
        }
    }
}

/// A task in a kanban board
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTask {
    /// Unique identifier for this task
    pub id: String,
    /// Task title
    pub title: String,
    /// Current status/column (e.g., "todo", "in_progress", "done")
    pub status: String,
    /// Optional priority level
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    /// Optional due date in ISO 8601 format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    /// When this task was created (ISO 8601)
    pub created: String,
    /// When this task was last updated (ISO 8601)
    pub updated: String,
}

/// Settings for kanban board display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanSettings {
    /// Card density: "compact", "standard", or "comfortable"
    #[serde(default = "default_card_density")]
    pub card_density: String,
    /// Whether to show closed/done tasks
    #[serde(default)]
    pub show_closed: bool,
}

fn default_card_density() -> String {
    "standard".to_string()
}

impl Default for KanbanSettings {
    fn default() -> Self {
        Self {
            card_density: default_card_density(),
            show_closed: false,
        }
    }
}

/// Kanban board index file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanIndex {
    /// Schema version
    pub version: u32,
    /// Column names/statuses in display order
    pub columns: Vec<String>,
    /// All tasks in this kanban board
    pub tasks: Vec<KanbanTask>,
    /// Display settings
    #[serde(default)]
    pub settings: KanbanSettings,
}

impl Default for KanbanIndex {
    fn default() -> Self {
        Self {
            version: 1,
            columns: vec![
                "todo".to_string(),
                "in_progress".to_string(),
                "done".to_string(),
            ],
            tasks: vec![],
            settings: KanbanSettings::default(),
        }
    }
}

/// Full kanban board with task content loaded
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kanban {
    /// Path to the kanban board directory
    pub path: PathBuf,
    /// Display name of the kanban board
    pub name: String,
    /// All tasks with their descriptions loaded
    pub tasks: Vec<KanbanTaskWithContent>,
    /// Display settings
    pub settings: KanbanSettings,
}

/// A kanban task with its description content loaded
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanTaskWithContent {
    /// Unique identifier for this task
    pub id: String,
    /// Task title
    pub title: String,
    /// Current status/column
    pub status: String,
    /// Optional priority level
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    /// Optional due date in ISO 8601 format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    /// When this task was created (ISO 8601)
    pub created: String,
    /// When this task was last updated (ISO 8601)
    pub updated: String,
    /// Task description/body content (markdown)
    pub description: String,
}

/// Partial updates for a task (all fields optional)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TaskUpdates {
    /// New title
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// New status/column
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// New priority
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    /// New due date
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    /// New description/body content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}
