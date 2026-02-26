use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GitError {
    #[error("Not a git repository")]
    NotARepository,
    #[error("Repository not initialized")]
    NotInitialized,
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("No changes to commit")]
    NoChanges,
}

impl serde::Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub has_changes: bool,
    pub staged_count: u32,
    pub unstaged_count: u32,
    pub untracked_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "untracked"
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub id: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHistory {
    pub path: String,
    pub commits: Vec<CommitInfo>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffLine {
    pub line_type: String, // "context", "add", "delete"
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiffFile {
    pub path: String,
    pub status: String, // "added", "modified", "deleted"
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CommitDiff {
    pub commit_id: String,
    pub message: String,
    pub author: String,
    pub time: i64,
    pub files: Vec<DiffFile>,
}
