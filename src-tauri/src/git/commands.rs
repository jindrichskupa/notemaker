use super::types::{CommitInfo, FileHistory, FileStatus, GitError, GitStatus};
use git2::{Repository, Signature, StatusOptions};
use std::path::Path;

/// Initialize a git repository in the vault
#[tauri::command]
pub fn git_init(vault_path: String) -> Result<bool, GitError> {
    let path = Path::new(&vault_path);
    if !path.exists() {
        return Err(GitError::InvalidPath(vault_path));
    }

    // Check if already a repo
    if Repository::open(path).is_ok() {
        return Ok(false); // Already initialized
    }

    // Initialize new repo
    Repository::init(path)?;

    // Create initial .gitignore
    let gitignore_path = path.join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(
            &gitignore_path,
            "# Notemaker local state (not versioned)\n.notemaker/.local/\n\n# System files\n*.tmp\n.DS_Store\n",
        )
        .ok();
    }

    Ok(true)
}

/// Get git status for the vault
#[tauri::command]
pub fn git_status(vault_path: String) -> Result<GitStatus, GitError> {
    let path = Path::new(&vault_path);
    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            return Ok(GitStatus {
                is_repo: false,
                branch: None,
                has_changes: false,
                staged_count: 0,
                unstaged_count: 0,
                untracked_count: 0,
            });
        }
    };

    // Get current branch
    let branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    // Get status
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut staged_count = 0u32;
    let mut unstaged_count = 0u32;
    let mut untracked_count = 0u32;

    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
            staged_count += 1;
        }
        if status.is_wt_modified() || status.is_wt_deleted() {
            unstaged_count += 1;
        }
        if status.is_wt_new() {
            untracked_count += 1;
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        has_changes: staged_count > 0 || unstaged_count > 0 || untracked_count > 0,
        staged_count,
        unstaged_count,
        untracked_count,
    })
}

/// Get list of changed files
#[tauri::command]
pub fn git_changed_files(vault_path: String) -> Result<Vec<FileStatus>, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let file_path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        let status_str = if status.is_index_new() || status.is_wt_new() {
            "added"
        } else if status.is_index_deleted() || status.is_wt_deleted() {
            "deleted"
        } else if status.is_index_modified() || status.is_wt_modified() {
            "modified"
        } else {
            "unknown"
        };

        let staged = status.is_index_new() || status.is_index_modified() || status.is_index_deleted();

        files.push(FileStatus {
            path: file_path,
            status: status_str.to_string(),
            staged,
        });
    }

    Ok(files)
}

/// Stage a file for commit
#[tauri::command]
pub fn git_stage(vault_path: String, file_path: String) -> Result<(), GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut index = repo.index()?;
    index.add_path(Path::new(&file_path))?;
    index.write()?;

    Ok(())
}

/// Stage all changes
#[tauri::command]
pub fn git_stage_all(vault_path: String) -> Result<u32, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    // Return count of staged files
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut opts))?;

    let count = statuses
        .iter()
        .filter(|e| {
            let s = e.status();
            s.is_index_new() || s.is_index_modified() || s.is_index_deleted()
        })
        .count();

    Ok(count as u32)
}

/// Unstage a file
#[tauri::command]
pub fn git_unstage(vault_path: String, file_path: String) -> Result<(), GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let head = repo.head()?.peel_to_commit()?;
    repo.reset_default(Some(&head.into_object()), [Path::new(&file_path)])?;

    Ok(())
}

/// Commit staged changes
#[tauri::command]
pub fn git_commit(vault_path: String, message: String) -> Result<String, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Get signature
    let sig = match repo.signature() {
        Ok(s) => s,
        Err(_) => Signature::now("Notemaker User", "user@notemaker.local")?,
    };

    // Get parent commit (if any)
    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    let commit_id = if let Some(parent) = parent {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent])?
    } else {
        repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[])?
    };

    Ok(commit_id.to_string())
}

/// Get commit history for the vault
#[tauri::command]
pub fn git_log(vault_path: String, limit: Option<u32>) -> Result<Vec<CommitInfo>, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let limit = limit.unwrap_or(50) as usize;
    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        commits.push(CommitInfo {
            id: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            timestamp: commit.time().seconds(),
        });
    }

    Ok(commits)
}

/// Get history for a specific file
#[tauri::command]
pub fn git_file_history(
    vault_path: String,
    file_path: String,
    limit: Option<u32>,
) -> Result<FileHistory, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let limit = limit.unwrap_or(20) as usize;
    let mut commits = Vec::new();

    for oid in revwalk {
        if commits.len() >= limit {
            break;
        }

        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        // Check if file was modified in this commit
        if let Ok(tree) = commit.tree() {
            if tree.get_path(Path::new(&file_path)).is_ok() {
                commits.push(CommitInfo {
                    id: oid.to_string(),
                    message: commit.message().unwrap_or("").to_string(),
                    author: commit.author().name().unwrap_or("Unknown").to_string(),
                    timestamp: commit.time().seconds(),
                });
            }
        }
    }

    Ok(FileHistory {
        path: file_path,
        commits,
    })
}

/// Get file content at a specific commit
#[tauri::command]
pub fn git_show_file(
    vault_path: String,
    file_path: String,
    commit_id: String,
) -> Result<String, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let oid = git2::Oid::from_str(&commit_id)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let entry = tree.get_path(Path::new(&file_path))?;
    let blob = repo.find_blob(entry.id())?;

    let content = String::from_utf8_lossy(blob.content()).to_string();
    Ok(content)
}

/// Discard changes to a file
#[tauri::command]
pub fn git_discard(vault_path: String, file_path: String) -> Result<(), GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.path(&file_path);
    checkout.force();

    repo.checkout_head(Some(&mut checkout))?;

    Ok(())
}
