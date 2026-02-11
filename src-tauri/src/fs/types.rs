use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Encryption method configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EncryptionMethodConfig {
    Password,
    IdentityFile,
}

impl Default for EncryptionMethodConfig {
    fn default() -> Self {
        Self::Password
    }
}

/// Encryption settings for the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionSettings {
    /// Whether encryption is enabled
    #[serde(default)]
    pub enabled: bool,
    /// Encryption method (password or identity file)
    #[serde(default)]
    pub method: EncryptionMethodConfig,
    /// Path to identity file (when using IdentityFile method)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identity_file: Option<String>,
}

impl Default for EncryptionSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            method: EncryptionMethodConfig::Password,
            identity_file: None,
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
