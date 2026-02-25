use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;

use super::types::{
    BlockType, FileEntry, Kanban, KanbanIndex, KanbanSettings, KanbanTask, KanbanTaskWithContent,
    LocalState, NoteContent, Notebook, NotebookBlock, NotebookBlockWithContent, NotebookIndex,
    TaskUpdates, VaultConfig, VaultInfo,
};

/// Error type for file system operations
#[derive(Debug, thiserror::Error)]
pub enum FsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path not found: {0}")]
    NotFound(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("Path traversal detected")]
    PathTraversal,
}

impl serde::Serialize for FsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Validate that a path doesn't contain traversal attempts
fn validate_path(base: &Path, target: &Path) -> Result<PathBuf, FsError> {
    let canonical_base = base.canonicalize().map_err(|_| FsError::NotFound(base.display().to_string()))?;
    let full_path = base.join(target);

    // For new files that don't exist yet, check the parent
    let check_path = if full_path.exists() {
        full_path.canonicalize()?
    } else {
        let parent = full_path.parent().ok_or(FsError::InvalidPath(target.display().to_string()))?;
        if parent.exists() {
            let canonical_parent = parent.canonicalize()?;
            if !canonical_parent.starts_with(&canonical_base) {
                return Err(FsError::PathTraversal);
            }
            return Ok(full_path);
        } else {
            return Err(FsError::NotFound(parent.display().to_string()));
        }
    };

    if !check_path.starts_with(&canonical_base) {
        return Err(FsError::PathTraversal);
    }

    Ok(check_path)
}

/// Open a vault directory and return information about it
#[tauri::command]
pub async fn open_vault(path: PathBuf) -> Result<VaultInfo, FsError> {
    if !path.exists() {
        return Err(FsError::NotFound(path.display().to_string()));
    }

    if !path.is_dir() {
        return Err(FsError::InvalidPath("Path is not a directory".to_string()));
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());

    // Count markdown files
    let note_count = count_notes(&path);

    // Check for git
    let has_git = path.join(".git").exists();

    // Check for .notemaker config
    let config_path = path.join(".notemaker");
    let has_config = config_path.exists();

    // Initialize .notemaker if it doesn't exist
    if !has_config {
        initialize_vault_config(&path)?;
    }

    Ok(VaultInfo {
        path,
        name,
        note_count,
        has_git,
        has_config: true,
    })
}

/// Initialize the .notemaker configuration directory
fn initialize_vault_config(vault_path: &Path) -> Result<(), FsError> {
    let config_dir = vault_path.join(".notemaker");
    fs::create_dir_all(&config_dir)?;
    fs::create_dir_all(config_dir.join("templates"))?;
    fs::create_dir_all(config_dir.join("snippets"))?;

    let config = VaultConfig::default();
    let config_content = serde_yaml::to_string(&config)?;
    fs::write(config_dir.join("config.yaml"), config_content)?;

    // Create default template
    let default_template = r#"---
title: "{{title}}"
created: "{{date}}"
labels: []
---

# {{title}}

"#;
    fs::write(config_dir.join("templates").join("default.md"), default_template)?;

    Ok(())
}

/// Count markdown files in a directory recursively
fn count_notes(path: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                // Skip hidden directories
                if !entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().starts_with('.'))
                    .unwrap_or(false)
                {
                    count += count_notes(&entry_path);
                }
            } else if entry_path.extension().map(|e| e == "md").unwrap_or(false) {
                count += 1;
            }
        }
    }
    count
}

/// Recursively list contents of a directory
fn list_directory_recursive(path: &Path) -> Result<Vec<FileEntry>, FsError> {
    if !path.exists() {
        return Err(FsError::NotFound(path.display().to_string()));
    }

    let mut entries = Vec::new();

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let metadata = entry.metadata()?;

        let name = entry_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip all hidden files and folders
        if name.starts_with('.') {
            continue;
        }

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Recursively get children for directories
        let children = if metadata.is_dir() {
            Some(list_directory_recursive(&entry_path).unwrap_or_default())
        } else {
            None
        };

        let file_entry = FileEntry {
            name,
            path: entry_path,
            is_directory: metadata.is_dir(),
            modified,
            size: metadata.len(),
            children,
        };

        entries.push(file_entry);
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// List contents of a directory
#[tauri::command]
pub async fn list_directory(path: PathBuf) -> Result<Vec<FileEntry>, FsError> {
    list_directory_recursive(&path)
}

/// Read a note's content
#[tauri::command]
pub async fn read_note(path: PathBuf) -> Result<NoteContent, FsError> {
    if !path.exists() {
        return Err(FsError::NotFound(path.display().to_string()));
    }

    let content = fs::read_to_string(&path)?;
    let metadata = fs::metadata(&path)?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(NoteContent {
        path,
        content,
        modified,
    })
}

/// Write content to a note
#[tauri::command]
pub async fn write_note(path: PathBuf, content: String) -> Result<(), FsError> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(&path, content)?;
    Ok(())
}

/// Create a new note
#[tauri::command]
pub async fn create_note(
    path: PathBuf,
    title: Option<String>,
    template: Option<String>,
) -> Result<(), FsError> {
    if path.exists() {
        return Err(FsError::InvalidPath("File already exists".to_string()));
    }

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let title = title.unwrap_or_else(|| {
        path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".to_string())
    });

    let now = chrono::Utc::now().to_rfc3339();

    // If template content is provided, use it directly
    // Otherwise, create a basic note with frontmatter
    let content = if let Some(template_content) = template {
        template_content
    } else {
        format!(
            r#"---
title: "{}"
created: "{}"
labels: []
---

# {}

"#,
            title, now, title
        )
    };

    fs::write(&path, content)?;
    Ok(())
}

/// Delete a note (moves to trash on supported platforms)
#[tauri::command]
pub async fn delete_note(path: PathBuf) -> Result<(), FsError> {
    if !path.exists() {
        return Err(FsError::NotFound(path.display().to_string()));
    }

    // Also delete associated .assets folder if it exists
    let assets_path = path.with_extension("").join(".assets");
    if assets_path.exists() {
        fs::remove_dir_all(&assets_path)?;
    }

    // Try to move to trash, fallback to direct delete
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        if trash::delete(&path).is_err() {
            fs::remove_file(&path)?;
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        fs::remove_file(&path)?;
    }

    Ok(())
}

/// Rename a note
#[tauri::command]
pub async fn rename_note(from: PathBuf, to: PathBuf) -> Result<(), FsError> {
    if !from.exists() {
        return Err(FsError::NotFound(from.display().to_string()));
    }

    if to.exists() {
        return Err(FsError::InvalidPath("Target already exists".to_string()));
    }

    fs::rename(&from, &to)?;

    // Also rename associated .assets folder if it exists
    let from_assets = from.with_extension("").to_string_lossy().to_string() + ".assets";
    let to_assets = to.with_extension("").to_string_lossy().to_string() + ".assets";
    let from_assets_path = PathBuf::from(&from_assets);
    let to_assets_path = PathBuf::from(&to_assets);

    if from_assets_path.exists() {
        fs::rename(from_assets_path, to_assets_path)?;
    }

    Ok(())
}

/// Move a note to a different directory
#[tauri::command]
pub async fn move_note(from: PathBuf, to_dir: PathBuf) -> Result<PathBuf, FsError> {
    if !from.exists() {
        return Err(FsError::NotFound(from.display().to_string()));
    }

    if !to_dir.is_dir() {
        return Err(FsError::InvalidPath("Target is not a directory".to_string()));
    }

    let file_name = from
        .file_name()
        .ok_or_else(|| FsError::InvalidPath("Invalid file name".to_string()))?;

    let to = to_dir.join(file_name);

    if to.exists() {
        return Err(FsError::InvalidPath("Target already exists".to_string()));
    }

    fs::rename(&from, &to)?;

    Ok(to)
}

/// Create a new directory
#[tauri::command]
pub async fn create_directory(path: PathBuf) -> Result<(), FsError> {
    if path.exists() {
        return Err(FsError::InvalidPath("Directory already exists".to_string()));
    }

    fs::create_dir_all(&path)?;
    Ok(())
}

/// Delete a directory
#[tauri::command]
pub async fn delete_directory(path: PathBuf) -> Result<(), FsError> {
    if !path.exists() {
        return Err(FsError::NotFound(path.display().to_string()));
    }

    if !path.is_dir() {
        return Err(FsError::InvalidPath("Path is not a directory".to_string()));
    }

    // Try to move to trash, fallback to direct delete
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        if trash::delete(&path).is_err() {
            fs::remove_dir_all(&path)?;
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        fs::remove_dir_all(&path)?;
    }

    Ok(())
}

/// Get vault configuration
#[tauri::command]
pub async fn get_vault_config(vault_path: PathBuf) -> Result<VaultConfig, FsError> {
    let config_path = vault_path.join(".notemaker").join("config.yaml");

    if !config_path.exists() {
        return Ok(VaultConfig::default());
    }

    let content = fs::read_to_string(&config_path)?;
    let config: VaultConfig = serde_yaml::from_str(&content)?;

    Ok(config)
}

/// Save vault configuration
#[tauri::command]
pub async fn save_vault_config(vault_path: PathBuf, config: VaultConfig) -> Result<(), FsError> {
    let config_dir = vault_path.join(".notemaker");
    fs::create_dir_all(&config_dir)?;

    let config_content = serde_yaml::to_string(&config)?;
    fs::write(config_dir.join("config.yaml"), config_content)?;

    Ok(())
}

/// Get local state (not versioned)
#[tauri::command]
pub async fn get_local_state(vault_path: PathBuf) -> Result<LocalState, FsError> {
    let state_path = vault_path.join(".notemaker").join(".local").join("state.json");

    if !state_path.exists() {
        return Ok(LocalState::default());
    }

    let content = fs::read_to_string(&state_path)?;
    let state: LocalState = serde_json::from_str(&content)
        .map_err(|e| FsError::InvalidPath(format!("Invalid local state: {}", e)))?;

    Ok(state)
}

/// Save local state (not versioned)
#[tauri::command]
pub async fn save_local_state(vault_path: PathBuf, state: LocalState) -> Result<(), FsError> {
    let local_dir = vault_path.join(".notemaker").join(".local");
    fs::create_dir_all(&local_dir)?;

    let state_content = serde_json::to_string_pretty(&state)
        .map_err(|e| FsError::InvalidPath(format!("Failed to serialize state: {}", e)))?;
    fs::write(local_dir.join("state.json"), state_content)?;

    Ok(())
}

/// Select a directory using native dialog
#[tauri::command]
pub async fn select_directory() -> Result<Option<PathBuf>, FsError> {
    use tauri_plugin_dialog::DialogExt;

    // This will be handled by the dialog plugin
    // For now, return None and let frontend handle it
    Ok(None)
}

// =============================================================================
// Notebook Commands
// =============================================================================

/// Check if a path is a notebook (directory ending with .md)
pub fn is_notebook(path: &Path) -> bool {
    path.is_dir() && path.extension().map(|e| e == "md").unwrap_or(false)
}

/// Get the index file path for a notebook
fn notebook_index_path(notebook_path: &Path) -> PathBuf {
    notebook_path.join(".index.json")
}

/// Read notebook index, creating default if doesn't exist
fn read_notebook_index(notebook_path: &Path) -> Result<NotebookIndex, FsError> {
    let index_path = notebook_index_path(notebook_path);
    if index_path.exists() {
        let content = fs::read_to_string(&index_path)?;
        let index: NotebookIndex = serde_json::from_str(&content)
            .map_err(|e| FsError::InvalidPath(format!("Invalid index.json: {}", e)))?;
        Ok(index)
    } else {
        Ok(NotebookIndex::default())
    }
}

/// Write notebook index
fn write_notebook_index(notebook_path: &Path, index: &NotebookIndex) -> Result<(), FsError> {
    let index_path = notebook_index_path(notebook_path);
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| FsError::InvalidPath(format!("Failed to serialize index: {}", e)))?;
    fs::write(&index_path, content)?;
    Ok(())
}

/// Generate a unique block ID
fn generate_block_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    // Add random suffix using nanoseconds and process ID to prevent collisions
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let pid = std::process::id();
    let random_suffix = (nanos ^ pid) & 0xFFFF;
    format!("{:x}{:04x}", now, random_suffix)
}

/// Get file extension for a language
fn language_to_extension(language: &str) -> &str {
    match language {
        "python" => "py",
        "javascript" => "js",
        "typescript" => "ts",
        "rust" => "rs",
        "sql" => "sql",
        "bash" | "shell" | "sh" => "sh",
        "markdown" | "md" => "md",
        _ => "txt",
    }
}

/// Create a new notebook
#[tauri::command]
pub async fn create_notebook(path: PathBuf, title: Option<String>) -> Result<Notebook, FsError> {
    if path.exists() {
        return Err(FsError::InvalidPath("Path already exists".to_string()));
    }

    // Create notebook directory
    fs::create_dir_all(&path)?;

    // Create initial markdown block
    let block_id = generate_block_id();
    let block_file = format!("{}.md", block_id);

    let title = title.unwrap_or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.trim_end_matches(".md").to_string())
            .unwrap_or_else(|| "Untitled".to_string())
    });

    let initial_content = format!("# {}\n\n", title);
    fs::write(path.join(&block_file), &initial_content)?;

    // Create index
    let index = NotebookIndex {
        version: 1,
        blocks: vec![NotebookBlock {
            id: block_id.clone(),
            block_type: BlockType::Markdown,
            file: block_file,
            language: None,
            encrypted: None,
        }],
    };
    write_notebook_index(&path, &index)?;

    // Return the notebook
    Ok(Notebook {
        path: path.clone(),
        name: title,
        blocks: vec![NotebookBlockWithContent {
            id: block_id,
            block_type: BlockType::Markdown,
            language: None,
            content: initial_content,
            encrypted: None,
        }],
    })
}

/// Read a notebook and all its blocks
#[tauri::command]
pub async fn read_notebook(path: PathBuf) -> Result<Notebook, FsError> {
    if !is_notebook(&path) {
        return Err(FsError::InvalidPath("Not a notebook".to_string()));
    }

    let index = read_notebook_index(&path)?;
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.trim_end_matches(".md").to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let mut blocks = Vec::new();
    for block in &index.blocks {
        let block_path = path.join(&block.file);
        let content = if block_path.exists() {
            fs::read_to_string(&block_path)?
        } else {
            String::new()
        };

        blocks.push(NotebookBlockWithContent {
            id: block.id.clone(),
            block_type: block.block_type.clone(),
            language: block.language.clone(),
            content,
            encrypted: block.encrypted,
        });
    }

    Ok(Notebook { path, name, blocks })
}

/// Add a new block to a notebook
#[tauri::command]
pub async fn add_notebook_block(
    notebook_path: PathBuf,
    block_type: BlockType,
    language: Option<String>,
    after_block_id: Option<String>,
) -> Result<NotebookBlockWithContent, FsError> {
    let mut index = read_notebook_index(&notebook_path)?;

    let block_id = generate_block_id();
    let extension = if block_type == BlockType::Code {
        language_to_extension(language.as_deref().unwrap_or("txt"))
    } else {
        "md"
    };
    let block_file = format!("{}.{}", block_id, extension);

    // Create empty block file
    let initial_content = String::new();
    fs::write(notebook_path.join(&block_file), &initial_content)?;

    let new_block = NotebookBlock {
        id: block_id.clone(),
        block_type: block_type.clone(),
        file: block_file,
        language: language.clone(),
        encrypted: None,
    };

    // Insert at correct position
    if let Some(after_id) = after_block_id {
        if let Some(pos) = index.blocks.iter().position(|b| b.id == after_id) {
            index.blocks.insert(pos + 1, new_block);
        } else {
            index.blocks.push(new_block);
        }
    } else {
        index.blocks.push(new_block);
    }

    write_notebook_index(&notebook_path, &index)?;

    Ok(NotebookBlockWithContent {
        id: block_id,
        block_type,
        language,
        content: initial_content,
        encrypted: None,
    })
}

/// Update a block's content
#[tauri::command]
pub async fn update_notebook_block(
    notebook_path: PathBuf,
    block_id: String,
    content: String,
) -> Result<(), FsError> {
    let index = read_notebook_index(&notebook_path)?;

    let block = index
        .blocks
        .iter()
        .find(|b| b.id == block_id)
        .ok_or_else(|| FsError::NotFound(format!("Block not found: {}", block_id)))?;

    let block_path = notebook_path.join(&block.file);
    fs::write(&block_path, content)?;

    Ok(())
}

/// Delete a block from a notebook
#[tauri::command]
pub async fn delete_notebook_block(
    notebook_path: PathBuf,
    block_id: String,
) -> Result<(), FsError> {
    let mut index = read_notebook_index(&notebook_path)?;

    let block_pos = index
        .blocks
        .iter()
        .position(|b| b.id == block_id)
        .ok_or_else(|| FsError::NotFound(format!("Block not found: {}", block_id)))?;

    let block = index.blocks.remove(block_pos);

    // Delete the block file
    let block_path = notebook_path.join(&block.file);
    if block_path.exists() {
        fs::remove_file(&block_path)?;
    }

    write_notebook_index(&notebook_path, &index)?;

    Ok(())
}

/// Move a block to a new position
#[tauri::command]
pub async fn move_notebook_block(
    notebook_path: PathBuf,
    block_id: String,
    new_index: usize,
) -> Result<(), FsError> {
    let mut index = read_notebook_index(&notebook_path)?;

    let block_pos = index
        .blocks
        .iter()
        .position(|b| b.id == block_id)
        .ok_or_else(|| FsError::NotFound(format!("Block not found: {}", block_id)))?;

    let block = index.blocks.remove(block_pos);
    let insert_pos = new_index.min(index.blocks.len());
    index.blocks.insert(insert_pos, block);

    write_notebook_index(&notebook_path, &index)?;

    Ok(())
}

/// Change a block's type/language
#[tauri::command]
pub async fn change_block_type(
    notebook_path: PathBuf,
    block_id: String,
    new_type: BlockType,
    new_language: Option<String>,
) -> Result<NotebookBlockWithContent, FsError> {
    let mut index = read_notebook_index(&notebook_path)?;

    let block = index
        .blocks
        .iter_mut()
        .find(|b| b.id == block_id)
        .ok_or_else(|| FsError::NotFound(format!("Block not found: {}", block_id)))?;

    // Read current content
    let old_path = notebook_path.join(&block.file);
    let content = if old_path.exists() {
        fs::read_to_string(&old_path)?
    } else {
        String::new()
    };

    // Determine new extension
    let new_extension = if new_type == BlockType::Code {
        language_to_extension(new_language.as_deref().unwrap_or("txt"))
    } else {
        "md"
    };

    // Create new file name
    let new_file = format!("{}.{}", block_id, new_extension);
    let new_path = notebook_path.join(&new_file);

    // Write content to new file
    fs::write(&new_path, &content)?;

    // Delete old file if different
    if old_path != new_path && old_path.exists() {
        fs::remove_file(&old_path)?;
    }

    // Update block info and capture encrypted before releasing mutable borrow
    block.block_type = new_type.clone();
    block.language = new_language.clone();
    block.file = new_file;
    let encrypted = block.encrypted;

    write_notebook_index(&notebook_path, &index)?;

    Ok(NotebookBlockWithContent {
        id: block_id,
        block_type: new_type,
        language: new_language,
        content,
        encrypted,
    })
}

// =============================================================================
// Code Execution
// =============================================================================

/// Result of code execution
#[derive(Debug, Clone, serde::Serialize)]
pub struct CodeExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Execute a code block
///
/// Supported languages:
/// - shell: Executes via shell interpreter (default: bash, configurable)
/// - python: Executes via python3 -c
/// - ruby: Executes via ruby -e
#[tauri::command]
pub async fn execute_code_block(
    language: String,
    code: String,
    working_dir: Option<PathBuf>,
    interpreter: Option<String>,
) -> Result<CodeExecutionResult, FsError> {
    let work_dir = working_dir.unwrap_or_else(|| std::env::temp_dir());

    let result = match language.to_lowercase().as_str() {
        "shell" => {
            let shell = interpreter.unwrap_or_else(|| "bash".to_string());
            execute_shell(&code, &work_dir, &shell)
        }
        "python" => {
            let python = interpreter.unwrap_or_else(|| "python3".to_string());
            execute_python(&code, &work_dir, &python)
        }
        "ruby" => {
            let ruby = interpreter.unwrap_or_else(|| "ruby".to_string());
            execute_ruby(&code, &work_dir, &ruby)
        }
        _ => Err(FsError::InvalidPath(format!("Unsupported language: {}", language))),
    }?;

    Ok(result)
}

fn execute_shell(code: &str, working_dir: &Path, interpreter: &str) -> Result<CodeExecutionResult, FsError> {
    let output = Command::new(interpreter)
        .arg("-c")
        .arg(code)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    Ok(CodeExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn execute_python(code: &str, working_dir: &Path, interpreter: &str) -> Result<CodeExecutionResult, FsError> {
    let output = Command::new(interpreter)
        .arg("-c")
        .arg(code)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    Ok(CodeExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn execute_ruby(code: &str, working_dir: &Path, interpreter: &str) -> Result<CodeExecutionResult, FsError> {
    let output = Command::new(interpreter)
        .arg("-e")
        .arg(code)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    Ok(CodeExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

// =============================================================================
// Note Conversion
// =============================================================================

/// Parsed code block from markdown
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ParsedCodeBlock {
    pub language: String,
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
}

/// Convert a markdown note to a notebook
/// This will:
/// 1. Parse the markdown content for code blocks
/// 2. Delete the original note file
/// 3. Create a notebook folder at the same path
/// 4. Create blocks for each markdown/code section
#[tauri::command]
pub async fn convert_note_to_notebook(
    note_path: PathBuf,
    content: String,
) -> Result<Notebook, FsError> {
    // Verify the note exists
    if !note_path.exists() {
        return Err(FsError::NotFound(note_path.display().to_string()));
    }

    // Verify it's a file, not a directory
    if note_path.is_dir() {
        return Err(FsError::InvalidPath("Path is already a directory".to_string()));
    }

    // Parse markdown content into blocks
    let parsed_blocks = parse_markdown_blocks(&content);

    // Delete the original note file
    fs::remove_file(&note_path)?;

    // Create notebook directory at the same path
    fs::create_dir_all(&note_path)?;

    // Get title from path
    let title = note_path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.trim_end_matches(".md").to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    // Create blocks
    let mut notebook_blocks: Vec<NotebookBlockWithContent> = Vec::new();
    let mut index_blocks: Vec<NotebookBlock> = Vec::new();

    for parsed in parsed_blocks.iter() {
        let block_id = generate_block_id();

        let (block_type, language, extension) = if parsed.is_code {
            let lang = parsed.language.clone().unwrap_or_else(|| "text".to_string());
            let ext = language_to_extension(&lang).to_string();
            (BlockType::Code, Some(lang), ext)
        } else {
            (BlockType::Markdown, None, "md".to_string())
        };

        let file_name = format!("{}.{}", block_id, extension);
        let file_path = note_path.join(&file_name);

        // Write block content to file
        fs::write(&file_path, &parsed.content)?;

        // Add to index
        index_blocks.push(NotebookBlock {
            id: block_id.clone(),
            block_type: block_type.clone(),
            file: file_name,
            language: language.clone(),
            encrypted: None,
        });

        // Add to result
        notebook_blocks.push(NotebookBlockWithContent {
            id: block_id,
            block_type,
            language,
            content: parsed.content.clone(),
            encrypted: None,
        });
    }

    // If no blocks were created, add an empty markdown block
    if notebook_blocks.is_empty() {
        let block_id = generate_block_id();
        let file_name = format!("{}.md", block_id);
        let initial_content = format!("# {}\n\n", title);

        fs::write(note_path.join(&file_name), &initial_content)?;

        index_blocks.push(NotebookBlock {
            id: block_id.clone(),
            block_type: BlockType::Markdown,
            file: file_name,
            language: None,
            encrypted: None,
        });

        notebook_blocks.push(NotebookBlockWithContent {
            id: block_id,
            block_type: BlockType::Markdown,
            language: None,
            content: initial_content,
            encrypted: None,
        });
    }

    // Write index
    let index = NotebookIndex {
        version: 1,
        blocks: index_blocks,
    };
    write_notebook_index(&note_path, &index)?;

    Ok(Notebook {
        path: note_path,
        name: title,
        blocks: notebook_blocks,
    })
}

/// Parsed block from markdown
#[derive(Debug)]
struct ParsedMarkdownBlock {
    is_code: bool,
    language: Option<String>,
    content: String,
}

/// Parse markdown content into blocks (markdown and code)
fn parse_markdown_blocks(content: &str) -> Vec<ParsedMarkdownBlock> {
    let mut blocks = Vec::new();
    let mut current_text = String::new();
    let mut in_code_block = false;
    let mut code_language = String::new();
    let mut code_content = String::new();

    for line in content.lines() {
        if line.starts_with("```") {
            if in_code_block {
                // End of code block
                blocks.push(ParsedMarkdownBlock {
                    is_code: true,
                    language: if code_language.is_empty() {
                        None
                    } else {
                        Some(code_language.clone())
                    },
                    content: code_content.trim_end().to_string(),
                });
                code_content.clear();
                code_language.clear();
                in_code_block = false;
            } else {
                // Start of code block
                // First, save any accumulated markdown
                let trimmed = current_text.trim();
                if !trimmed.is_empty() {
                    blocks.push(ParsedMarkdownBlock {
                        is_code: false,
                        language: None,
                        content: trimmed.to_string(),
                    });
                }
                current_text.clear();

                // Extract language
                code_language = line.trim_start_matches('`').to_string();
                in_code_block = true;
            }
        } else if in_code_block {
            if !code_content.is_empty() {
                code_content.push('\n');
            }
            code_content.push_str(line);
        } else {
            if !current_text.is_empty() {
                current_text.push('\n');
            }
            current_text.push_str(line);
        }
    }

    // Handle any remaining content
    if in_code_block {
        // Unclosed code block - treat as code anyway
        blocks.push(ParsedMarkdownBlock {
            is_code: true,
            language: if code_language.is_empty() {
                None
            } else {
                Some(code_language)
            },
            content: code_content.trim_end().to_string(),
        });
    } else {
        let trimmed = current_text.trim();
        if !trimmed.is_empty() {
            blocks.push(ParsedMarkdownBlock {
                is_code: false,
                language: None,
                content: trimmed.to_string(),
            });
        }
    }

    blocks
}

// =============================================================================
// Kanban Operations
// =============================================================================

const KANBAN_INDEX_FILE: &str = ".index.json";
const DEFAULT_COLUMNS: [&str; 5] = ["backlog", "ready", "working", "done", "closed"];

/// Check if a path is a kanban board (directory ending with .kanban)
pub fn is_kanban(path: &Path) -> bool {
    path.is_dir() && path.extension().map_or(false, |ext| ext == "kanban")
}

/// Read kanban index
fn read_kanban_index(kanban_path: &Path) -> Result<KanbanIndex, FsError> {
    let index_path = kanban_path.join(KANBAN_INDEX_FILE);
    let content = fs::read_to_string(&index_path)?;
    let index: KanbanIndex = serde_json::from_str(&content)
        .map_err(|e| FsError::InvalidPath(format!("Invalid kanban index: {}", e)))?;
    Ok(index)
}

/// Write kanban index
fn write_kanban_index(kanban_path: &Path, index: &KanbanIndex) -> Result<(), FsError> {
    let index_path = kanban_path.join(KANBAN_INDEX_FILE);
    let content = serde_json::to_string_pretty(index)
        .map_err(|e| FsError::InvalidPath(format!("Failed to serialize kanban index: {}", e)))?;
    fs::write(&index_path, content)?;
    Ok(())
}

/// Generate a unique task ID
fn generate_task_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    // Add random suffix using nanoseconds and process ID to prevent collisions
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let pid = std::process::id();
    let random_suffix = (nanos ^ pid) & 0xFFFF;
    format!("{:x}{:04x}", now, random_suffix)
}

/// Get the file path for a task's description
fn get_task_file_path(kanban_path: &Path, task_id: &str) -> PathBuf {
    kanban_path.join(format!("{}.md", task_id))
}

/// Create a new kanban board
#[tauri::command]
pub async fn create_kanban(path: PathBuf, title: Option<String>) -> Result<Kanban, FsError> {
    if path.exists() {
        return Err(FsError::InvalidPath("Path already exists".to_string()));
    }

    // Create kanban directory
    fs::create_dir_all(&path)?;

    let name = title.unwrap_or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.trim_end_matches(".kanban").to_string())
            .unwrap_or_else(|| "Untitled".to_string())
    });

    // Create default index with default columns
    let index = KanbanIndex {
        version: 1,
        columns: DEFAULT_COLUMNS.iter().map(|s| s.to_string()).collect(),
        tasks: vec![],
        settings: KanbanSettings::default(),
    };
    write_kanban_index(&path, &index)?;

    Ok(Kanban {
        path,
        name,
        tasks: vec![],
        settings: index.settings,
    })
}

/// Read a kanban board and all its tasks
#[tauri::command]
pub async fn read_kanban(path: PathBuf) -> Result<Kanban, FsError> {
    if !is_kanban(&path) {
        return Err(FsError::InvalidPath("Not a kanban board".to_string()));
    }

    let index = read_kanban_index(&path)?;
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.trim_end_matches(".kanban").to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let mut tasks = Vec::new();
    for task in &index.tasks {
        let task_path = get_task_file_path(&path, &task.id);
        let description = if task_path.exists() {
            fs::read_to_string(&task_path)?
        } else {
            String::new()
        };

        tasks.push(KanbanTaskWithContent {
            id: task.id.clone(),
            title: task.title.clone(),
            status: task.status.clone(),
            priority: task.priority.clone(),
            due: task.due.clone(),
            created: task.created.clone(),
            updated: task.updated.clone(),
            description,
        });
    }

    Ok(Kanban {
        path,
        name,
        tasks,
        settings: index.settings,
    })
}

/// Add a new task to a kanban board
#[tauri::command]
pub async fn add_kanban_task(
    kanban_path: PathBuf,
    title: String,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    description: Option<String>,
) -> Result<KanbanTaskWithContent, FsError> {
    // Validate title is not empty
    if title.trim().is_empty() {
        return Err(FsError::InvalidPath("Task title cannot be empty".to_string()));
    }

    let mut index = read_kanban_index(&kanban_path)?;

    let task_id = generate_task_id();
    let now = chrono::Utc::now().to_rfc3339();

    // Use first column as default status if not specified
    let task_status = status.unwrap_or_else(|| {
        index.columns.first().cloned().unwrap_or_else(|| "backlog".to_string())
    });

    let task = KanbanTask {
        id: task_id.clone(),
        title: title.clone(),
        status: task_status.clone(),
        priority: priority.clone(),
        due: due.clone(),
        created: now.clone(),
        updated: now.clone(),
    };

    index.tasks.push(task);
    write_kanban_index(&kanban_path, &index)?;

    // Write description file if provided
    let task_description = description.unwrap_or_default();
    if !task_description.is_empty() {
        let task_path = get_task_file_path(&kanban_path, &task_id);
        fs::write(&task_path, &task_description)?;
    }

    Ok(KanbanTaskWithContent {
        id: task_id,
        title,
        status: task_status,
        priority,
        due,
        created: now.clone(),
        updated: now,
        description: task_description,
    })
}

/// Update a task's metadata (title, status, priority, due)
#[tauri::command]
pub async fn update_kanban_task(
    kanban_path: PathBuf,
    task_id: String,
    updates: TaskUpdates,
) -> Result<KanbanTaskWithContent, FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    let task = index
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or_else(|| FsError::NotFound(format!("Task not found: {}", task_id)))?;

    // Apply updates
    if let Some(title) = updates.title {
        task.title = title;
    }
    if let Some(status) = updates.status {
        task.status = status;
    }
    // Empty string means "clear the field"
    if let Some(priority) = updates.priority {
        task.priority = if priority.is_empty() { None } else { Some(priority) };
    }
    if let Some(due) = updates.due {
        task.due = if due.is_empty() { None } else { Some(due) };
    }

    // Update timestamp
    task.updated = chrono::Utc::now().to_rfc3339();

    // Handle description: update if provided, otherwise read existing
    let task_path = get_task_file_path(&kanban_path, &task_id);
    let description = if let Some(desc) = updates.description {
        fs::write(&task_path, &desc)?;
        desc
    } else if task_path.exists() {
        fs::read_to_string(&task_path)?
    } else {
        String::new()
    };

    // Build result with all data ready
    let result_task = KanbanTaskWithContent {
        id: task.id.clone(),
        title: task.title.clone(),
        status: task.status.clone(),
        priority: task.priority.clone(),
        due: task.due.clone(),
        created: task.created.clone(),
        updated: task.updated.clone(),
        description,
    };

    write_kanban_index(&kanban_path, &index)?;

    Ok(result_task)
}

/// Delete a task from a kanban board
#[tauri::command]
pub async fn delete_kanban_task(
    kanban_path: PathBuf,
    task_id: String,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    let task_pos = index
        .tasks
        .iter()
        .position(|t| t.id == task_id)
        .ok_or_else(|| FsError::NotFound(format!("Task not found: {}", task_id)))?;

    index.tasks.remove(task_pos);
    write_kanban_index(&kanban_path, &index)?;

    // Delete the description file if it exists
    let task_path = get_task_file_path(&kanban_path, &task_id);
    if task_path.exists() {
        fs::remove_file(&task_path)?;
    }

    Ok(())
}

/// Update a task's description content
#[tauri::command]
pub async fn update_task_description(
    kanban_path: PathBuf,
    task_id: String,
    description: String,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;

    // Verify task exists and update timestamp
    let task = index
        .tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or_else(|| FsError::NotFound(format!("Task not found: {}", task_id)))?;

    task.updated = chrono::Utc::now().to_rfc3339();
    write_kanban_index(&kanban_path, &index)?;

    // Write description to file
    let task_path = get_task_file_path(&kanban_path, &task_id);
    fs::write(&task_path, description)?;

    Ok(())
}

/// Update kanban board settings
#[tauri::command]
pub async fn update_kanban_settings(
    kanban_path: PathBuf,
    settings: KanbanSettings,
) -> Result<(), FsError> {
    let mut index = read_kanban_index(&kanban_path)?;
    index.settings = settings;
    write_kanban_index(&kanban_path, &index)?;
    Ok(())
}

// =============================================================================
// Attachment Operations
// =============================================================================

/// Save an attachment (image) to the .assets folder of a note
#[tauri::command]
pub async fn save_attachment(
    note_path: String,
    filename: String,
    data: String,
) -> Result<String, FsError> {
    use std::time::{SystemTime, UNIX_EPOCH};
    use base64::Engine;

    let note_path = PathBuf::from(&note_path);

    if !note_path.exists() {
        return Err(FsError::NotFound(note_path.display().to_string()));
    }

    let assets_dir = if note_path.is_dir() {
        let parent = note_path.parent().unwrap_or(&note_path);
        let name = note_path.file_name().unwrap().to_string_lossy();
        let name_without_ext = name.trim_end_matches(".md");
        parent.join(format!("{}.assets", name_without_ext))
    } else {
        let name = note_path.file_stem().unwrap().to_string_lossy();
        let parent = note_path.parent().unwrap();
        parent.join(format!("{}.assets", name))
    };

    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)?;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let ext = PathBuf::from(&filename)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "png".to_string());

    let hash: String = data.chars().filter(|c| c.is_alphanumeric()).take(4).collect();
    let new_filename = format!("img-{}-{}.{}", timestamp, hash, ext);
    let file_path = assets_dir.join(&new_filename);

    let decoded = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| FsError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("Invalid base64: {}", e)
        )))?;

    fs::write(&file_path, decoded)?;

    let assets_folder_name = assets_dir.file_name().unwrap().to_string_lossy();
    let relative_path = format!("./{}/{}", assets_folder_name, new_filename);

    Ok(relative_path)
}
