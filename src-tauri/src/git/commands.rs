use super::types::{BranchInfo, CommitInfo, CommitDiff, DiffFile, DiffHunk, DiffLine, FileHistory, FileStatus, GitError, GitStatus, PullResult};
use git2::{Diff, DiffOptions, Repository, Signature, StatusOptions};
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

/// Get diff for a specific commit
#[tauri::command]
pub fn git_diff(vault_path: String, commit_id: String) -> Result<CommitDiff, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    // Find the commit
    let oid = git2::Oid::from_str(&commit_id)?;
    let commit = repo.find_commit(oid)?;

    // Get commit metadata
    let message = commit.message().unwrap_or("").to_string();
    let author = commit.author().name().unwrap_or("Unknown").to_string();
    let time = commit.time().seconds();

    // Get the commit tree
    let commit_tree = commit.tree()?;

    // Get parent tree (if exists) for comparison
    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    // Generate diff between parent tree and commit tree
    let mut diff_opts = DiffOptions::new();
    let diff: Diff = repo.diff_tree_to_tree(
        parent_tree.as_ref(),
        Some(&commit_tree),
        Some(&mut diff_opts),
    )?;

    // Parse the diff into our structures
    let mut files: Vec<DiffFile> = Vec::new();
    let mut current_file: Option<DiffFile> = None;
    let mut current_hunk: Option<DiffHunk> = None;

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        // Handle file header
        if let Some(new_file) = delta.new_file().path() {
            let file_path = new_file.to_string_lossy().to_string();

            // Determine file status
            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                git2::Delta::Copied => "copied",
                _ => "modified",
            };

            // Check if we need to start a new file
            let need_new_file = current_file.as_ref().map_or(true, |f| f.path != file_path);

            if need_new_file {
                // Save current hunk to current file if exists
                if let Some(hunk) = current_hunk.take() {
                    if let Some(ref mut file) = current_file {
                        file.hunks.push(hunk);
                    }
                }

                // Save current file to files list if exists
                if let Some(file) = current_file.take() {
                    files.push(file);
                }

                // Start new file
                current_file = Some(DiffFile {
                    path: file_path,
                    status: status.to_string(),
                    hunks: Vec::new(),
                });
            }
        }

        // Handle hunk header
        if let Some(hunk_info) = hunk {
            // Save previous hunk if exists
            if let Some(hunk) = current_hunk.take() {
                if let Some(ref mut file) = current_file {
                    file.hunks.push(hunk);
                }
            }

            // Start new hunk
            let header = format!(
                "@@ -{},{} +{},{} @@",
                hunk_info.old_start(),
                hunk_info.old_lines(),
                hunk_info.new_start(),
                hunk_info.new_lines()
            );

            current_hunk = Some(DiffHunk {
                header,
                lines: Vec::new(),
            });
        }

        // Handle diff lines
        let line_type = match line.origin() {
            '+' => "add",
            '-' => "delete",
            ' ' => "context",
            _ => return true, // Skip other line types (file headers, etc.)
        };

        let content = String::from_utf8_lossy(line.content()).to_string();

        let diff_line = DiffLine {
            line_type: line_type.to_string(),
            old_line_no: line.old_lineno(),
            new_line_no: line.new_lineno(),
            content,
        };

        if let Some(ref mut hunk) = current_hunk {
            hunk.lines.push(diff_line);
        }

        true
    })?;

    // Don't forget to save the last hunk and file
    if let Some(hunk) = current_hunk.take() {
        if let Some(ref mut file) = current_file {
            file.hunks.push(hunk);
        }
    }
    if let Some(file) = current_file.take() {
        files.push(file);
    }

    Ok(CommitDiff {
        commit_id,
        message,
        author,
        time,
        files,
    })
}

/// Get list of branches
#[tauri::command]
pub fn git_branches(vault_path: String) -> Result<Vec<BranchInfo>, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let mut branches = Vec::new();
    let head = repo.head().ok();
    let current_branch = head.as_ref()
        .and_then(|h| h.shorthand())
        .map(|s| s.to_string());

    for branch_result in repo.branches(Some(git2::BranchType::Local))? {
        if let Ok((branch, _)) = branch_result {
            if let Ok(Some(name)) = branch.name() {
                branches.push(BranchInfo {
                    name: name.to_string(),
                    is_current: current_branch.as_deref() == Some(name),
                    is_remote: false,
                });
            }
        }
    }

    Ok(branches)
}

/// Checkout a branch
#[tauri::command]
pub fn git_checkout_branch(vault_path: String, branch_name: String) -> Result<(), GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    let branch = repo.find_branch(&branch_name, git2::BranchType::Local)?;

    let commit = branch.get().peel_to_commit()?;

    repo.checkout_tree(commit.as_object(), None)?;

    repo.set_head(&format!("refs/heads/{}", branch_name))?;

    Ok(())
}

/// Pull changes from remote origin
#[tauri::command]
pub fn git_pull(vault_path: String) -> Result<PullResult, GitError> {
    let path = Path::new(&vault_path);
    let repo = Repository::open(path).map_err(|_| GitError::NotARepository)?;

    // Find remote "origin"
    let mut remote = repo.find_remote("origin")?;

    // Get current branch name
    let head = repo.head()?;
    let branch_name = head
        .shorthand()
        .ok_or_else(|| GitError::InvalidPath("Cannot determine current branch".to_string()))?
        .to_string();

    // Fetch from remote
    let fetch_refspecs: &[&str] = &[];
    remote.fetch(fetch_refspecs, None, None)?;

    // Get FETCH_HEAD reference
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    // Perform merge analysis
    let (analysis, _preference) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        return Ok(PullResult {
            success: true,
            conflicts: Vec::new(),
            message: "Already up to date".to_string(),
        });
    }

    if analysis.is_fast_forward() {
        // Fast-forward merge
        let refname = format!("refs/heads/{}", branch_name);
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "Fast-forward")?;

        // Checkout the new HEAD
        repo.set_head(&refname)?;
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))?;

        return Ok(PullResult {
            success: true,
            conflicts: Vec::new(),
            message: format!("Fast-forward to {}", &fetch_commit.id().to_string()[..7]),
        });
    }

    // Normal merge required
    let fetch_commit_obj = repo.find_commit(fetch_commit.id())?;
    repo.merge(&[&fetch_commit], None, None)?;

    // Check for conflicts
    let mut index = repo.index()?;

    if index.has_conflicts() {
        // Collect conflicted file paths
        let mut conflicts = Vec::new();
        for conflict in index.conflicts()? {
            if let Ok(conflict) = conflict {
                if let Some(ancestor) = conflict.ancestor {
                    let path = String::from_utf8_lossy(&ancestor.path).to_string();
                    if !conflicts.contains(&path) {
                        conflicts.push(path);
                    }
                }
                if let Some(our) = conflict.our {
                    let path = String::from_utf8_lossy(&our.path).to_string();
                    if !conflicts.contains(&path) {
                        conflicts.push(path);
                    }
                }
                if let Some(their) = conflict.their {
                    let path = String::from_utf8_lossy(&their.path).to_string();
                    if !conflicts.contains(&path) {
                        conflicts.push(path);
                    }
                }
            }
        }

        return Ok(PullResult {
            success: false,
            conflicts,
            message: "Merge conflicts detected. Please resolve conflicts and commit.".to_string(),
        });
    }

    // No conflicts - auto-commit the merge
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Get signature
    let sig = match repo.signature() {
        Ok(s) => s,
        Err(_) => Signature::now("Notemaker User", "user@notemaker.local")?,
    };

    // Get HEAD commit as parent
    let head_commit = repo.head()?.peel_to_commit()?;

    // Create merge commit with two parents
    let message = format!("Merge remote-tracking branch 'origin/{}'", branch_name);
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&head_commit, &fetch_commit_obj],
    )?;

    // Clean up merge state
    repo.cleanup_state()?;

    Ok(PullResult {
        success: true,
        conflicts: Vec::new(),
        message: "Merged successfully".to_string(),
    })
}

/// Push changes to remote origin
#[tauri::command]
pub fn git_push(path: &str) -> Result<String, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let mut remote = repo.find_remote("origin")
        .map_err(|e| GitError::Generic(format!("No remote 'origin': {}", e.message())))?;

    let head = repo.head()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let branch_name = head.shorthand().unwrap_or("master");

    // Push requires callbacks for authentication - use default credentials
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        git2::Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
    });

    let mut push_options = git2::PushOptions::new();
    push_options.remote_callbacks(callbacks);

    remote.push(
        &[&format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name)],
        Some(&mut push_options)
    ).map_err(|e| GitError::Generic(format!("Push failed: {}", e.message())))?;

    Ok(format!("Pushed to origin/{}", branch_name))
}

/// List files with merge conflicts
#[tauri::command]
pub fn git_conflicted_files(path: &str) -> Result<Vec<String>, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;
    let index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;

    let conflicts: Vec<String> = index.conflicts()
        .map_err(|e| GitError::Generic(e.message().to_string()))?
        .filter_map(|c| c.ok())
        .filter_map(|c| {
            c.our.or(c.their).or(c.ancestor)
                .and_then(|e| String::from_utf8(e.path.clone()).ok())
        })
        .collect();

    Ok(conflicts)
}

/// Resolve conflict by accepting our version
#[tauri::command]
pub fn git_resolve_ours(path: &str, file_path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    // Checkout our version
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.path(file_path).force().use_ours(true);
    repo.checkout_index(None, Some(&mut opts))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Stage the file
    let mut index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.add_path(std::path::Path::new(file_path))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.write().map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}

/// Resolve conflict by accepting their version
#[tauri::command]
pub fn git_resolve_theirs(path: &str, file_path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    // Checkout their version
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.path(file_path).force().use_theirs(true);
    repo.checkout_index(None, Some(&mut opts))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Stage the file
    let mut index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.add_path(std::path::Path::new(file_path))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.write().map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}

/// Abort a merge in progress
#[tauri::command]
pub fn git_abort_merge(path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.cleanup_state()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}
