# Git History & Conflict Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add commit diff viewer, branch switching, and conflict resolution UI for pull/merge/rebase operations.

**Architecture:** Extend existing GitPanel with new Rust commands (git2 crate) for diff, branches, pull/push/merge/rebase, and conflict resolution. Add DiffViewer, BranchSwitcher, and ConflictResolver components.

**Tech Stack:** Rust git2 crate, Tauri commands, SolidJS components, TypeScript

---

## Task 1: Add git_diff Rust command

**Files:**
- Modify: `src-tauri/src/git/commands.rs`
- Modify: `src-tauri/src/git/types.rs`

**Step 1: Add Diff types**

In `src-tauri/src/git/types.rs`, add:

```rust
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
```

**Step 2: Add git_diff command**

In `src-tauri/src/git/commands.rs`, add:

```rust
#[tauri::command]
pub fn git_diff(path: &str, commit_id: &str) -> Result<CommitDiff, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let commit = repo.find_commit(Oid::from_str(commit_id)
        .map_err(|e| GitError::Generic(e.message().to_string()))?)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let parent = if commit.parent_count() > 0 {
        Some(commit.parent(0).map_err(|e| GitError::Generic(e.message().to_string()))?)
    } else {
        None
    };

    let commit_tree = commit.tree().map_err(|e| GitError::Generic(e.message().to_string()))?;
    let parent_tree = parent.as_ref().map(|p| p.tree().ok()).flatten();

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let mut files: Vec<DiffFile> = Vec::new();

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            _ => "modified",
        }.to_string();

        // Find or create file entry
        let file = if let Some(f) = files.iter_mut().find(|f| f.path == path) {
            f
        } else {
            files.push(DiffFile {
                path: path.clone(),
                status,
                hunks: Vec::new(),
            });
            files.last_mut().unwrap()
        };

        // Handle hunk header
        if let Some(h) = hunk {
            let header = format!("@@ -{},{} +{},{} @@",
                h.old_start(), h.old_lines(),
                h.new_start(), h.new_lines());

            if file.hunks.last().map(|hk| hk.header != header).unwrap_or(true) {
                file.hunks.push(DiffHunk {
                    header,
                    lines: Vec::new(),
                });
            }
        }

        // Handle line
        if let Some(hunk) = file.hunks.last_mut() {
            let line_type = match line.origin() {
                '+' => "add",
                '-' => "delete",
                _ => "context",
            }.to_string();

            let content = std::str::from_utf8(line.content())
                .unwrap_or("")
                .trim_end_matches('\n')
                .to_string();

            hunk.lines.push(DiffLine {
                line_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
                content,
            });
        }

        true
    }).map_err(|e| GitError::Generic(e.message().to_string()))?;

    let author = commit.author();
    let author_str = format!("{} <{}>",
        author.name().unwrap_or("Unknown"),
        author.email().unwrap_or(""));

    Ok(CommitDiff {
        commit_id: commit_id.to_string(),
        message: commit.message().unwrap_or("").to_string(),
        author: author_str,
        time: commit.time().seconds(),
        files,
    })
}
```

**Step 3: Register command in lib.rs**

Add `git_diff` to the invoke_handler in `src-tauri/src/lib.rs`.

**Step 4: Commit**

```bash
git add src-tauri/src/git/types.rs src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add git_diff command for commit diff viewing"
```

---

## Task 2: Add git_branches and git_checkout_branch commands

**Files:**
- Modify: `src-tauri/src/git/commands.rs`
- Modify: `src-tauri/src/git/types.rs`

**Step 1: Add Branch type**

In `src-tauri/src/git/types.rs`:

```rust
#[derive(Debug, Serialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}
```

**Step 2: Add git_branches command**

```rust
#[tauri::command]
pub fn git_branches(path: &str) -> Result<Vec<BranchInfo>, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let mut branches = Vec::new();
    let head = repo.head().ok();
    let current_branch = head.as_ref()
        .and_then(|h| h.shorthand())
        .map(|s| s.to_string());

    for branch_result in repo.branches(Some(git2::BranchType::Local))
        .map_err(|e| GitError::Generic(e.message().to_string()))?
    {
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
```

**Step 3: Add git_checkout_branch command**

```rust
#[tauri::command]
pub fn git_checkout_branch(path: &str, branch_name: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let branch = repo.find_branch(branch_name, git2::BranchType::Local)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let commit = branch.get().peel_to_commit()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.checkout_tree(commit.as_object(), None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.set_head(&format!("refs/heads/{}", branch_name))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}
```

**Step 4: Register and commit**

```bash
git add src-tauri/src/git/types.rs src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add branch listing and checkout commands"
```

---

## Task 3: Add git_pull command

**Files:**
- Modify: `src-tauri/src/git/commands.rs`
- Modify: `src-tauri/src/git/types.rs`

**Step 1: Add PullResult type**

```rust
#[derive(Debug, Serialize, Clone)]
pub struct PullResult {
    pub success: bool,
    pub conflicts: Vec<String>,
    pub message: String,
}
```

**Step 2: Add git_pull command**

```rust
#[tauri::command]
pub fn git_pull(path: &str) -> Result<PullResult, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    // Get remote
    let mut remote = repo.find_remote("origin")
        .map_err(|e| GitError::Generic(format!("No remote 'origin': {}", e.message())))?;

    // Fetch
    remote.fetch(&["HEAD"], None, None)
        .map_err(|e| GitError::Generic(format!("Fetch failed: {}", e.message())))?;

    // Get fetch head
    let fetch_head = repo.find_reference("FETCH_HEAD")
        .map_err(|e| GitError::Generic(format!("No FETCH_HEAD: {}", e.message())))?;

    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Merge analysis
    let (analysis, _) = repo.merge_analysis(&[&fetch_commit])
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    if analysis.is_up_to_date() {
        return Ok(PullResult {
            success: true,
            conflicts: vec![],
            message: "Already up to date".to_string(),
        });
    }

    if analysis.is_fast_forward() {
        // Fast-forward
        let refname = "refs/heads/".to_string() + repo.head()
            .map_err(|e| GitError::Generic(e.message().to_string()))?
            .shorthand()
            .unwrap_or("master");

        let mut reference = repo.find_reference(&refname)
            .map_err(|e| GitError::Generic(e.message().to_string()))?;

        reference.set_target(fetch_commit.id(), "Fast-forward")
            .map_err(|e| GitError::Generic(e.message().to_string()))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| GitError::Generic(e.message().to_string()))?;

        return Ok(PullResult {
            success: true,
            conflicts: vec![],
            message: "Fast-forward merge".to_string(),
        });
    }

    // Normal merge
    repo.merge(&[&fetch_commit], None, None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Check for conflicts
    let index = repo.index()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    if index.has_conflicts() {
        let conflicts: Vec<String> = index.conflicts()
            .map_err(|e| GitError::Generic(e.message().to_string()))?
            .filter_map(|c| c.ok())
            .filter_map(|c| {
                c.our.or(c.their).or(c.ancestor)
                    .and_then(|e| String::from_utf8(e.path.clone()).ok())
            })
            .collect();

        return Ok(PullResult {
            success: false,
            conflicts,
            message: "Merge conflicts detected".to_string(),
        });
    }

    // Auto-commit if no conflicts
    let sig = repo.signature()
        .unwrap_or_else(|_| git2::Signature::now("Notemaker", "notemaker@local").unwrap());

    let tree_id = index.write_tree()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let tree = repo.find_tree(tree_id)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let head_commit = repo.head()
        .map_err(|e| GitError::Generic(e.message().to_string()))?
        .peel_to_commit()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let fetch_commit_obj = repo.find_commit(fetch_commit.id())
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Merge remote-tracking branch",
        &tree,
        &[&head_commit, &fetch_commit_obj],
    ).map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.cleanup_state()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(PullResult {
        success: true,
        conflicts: vec![],
        message: "Merged successfully".to_string(),
    })
}
```

**Step 3: Commit**

```bash
git add src-tauri/src/git/types.rs src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add git_pull command with conflict detection"
```

---

## Task 4: Add git_push command

**Files:**
- Modify: `src-tauri/src/git/commands.rs`

**Step 1: Add git_push command**

```rust
#[tauri::command]
pub fn git_push(path: &str) -> Result<String, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let mut remote = repo.find_remote("origin")
        .map_err(|e| GitError::Generic(format!("No remote 'origin': {}", e.message())))?;

    let head = repo.head()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let branch_name = head.shorthand().unwrap_or("master");

    remote.push(&[&format!("refs/heads/{}", branch_name)], None)
        .map_err(|e| GitError::Generic(format!("Push failed: {}", e.message())))?;

    Ok(format!("Pushed to origin/{}", branch_name))
}
```

**Step 2: Commit**

```bash
git add src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add git_push command"
```

---

## Task 5: Add conflict resolution commands

**Files:**
- Modify: `src-tauri/src/git/commands.rs`

**Step 1: Add git_conflicted_files command**

```rust
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
```

**Step 2: Add git_resolve_ours command**

```rust
#[tauri::command]
pub fn git_resolve_ours(path: &str, file_path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    // Checkout our version
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.path(file_path).force().our(true);
    repo.checkout_index(None, Some(&mut opts))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Stage the file
    let mut index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.add_path(std::path::Path::new(file_path))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.write().map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}
```

**Step 3: Add git_resolve_theirs command**

```rust
#[tauri::command]
pub fn git_resolve_theirs(path: &str, file_path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    // Checkout their version
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.path(file_path).force().their(true);
    repo.checkout_index(None, Some(&mut opts))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Stage the file
    let mut index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.add_path(std::path::Path::new(file_path))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;
    index.write().map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}
```

**Step 4: Add git_abort_merge command**

```rust
#[tauri::command]
pub fn git_abort_merge(path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    repo.cleanup_state()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}
```

**Step 5: Commit**

```bash
git add src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add conflict resolution commands"
```

---

## Task 6: Add merge and rebase commands

**Files:**
- Modify: `src-tauri/src/git/commands.rs`

**Step 1: Add git_merge command**

```rust
#[tauri::command]
pub fn git_merge(path: &str, branch_name: &str) -> Result<PullResult, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let branch = repo.find_branch(branch_name, git2::BranchType::Local)
        .map_err(|e| GitError::Generic(format!("Branch not found: {}", e.message())))?;

    let branch_commit = repo.reference_to_annotated_commit(branch.get())
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Merge
    repo.merge(&[&branch_commit], None, None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Check for conflicts
    let index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;

    if index.has_conflicts() {
        let conflicts: Vec<String> = index.conflicts()
            .map_err(|e| GitError::Generic(e.message().to_string()))?
            .filter_map(|c| c.ok())
            .filter_map(|c| {
                c.our.or(c.their).or(c.ancestor)
                    .and_then(|e| String::from_utf8(e.path.clone()).ok())
            })
            .collect();

        return Ok(PullResult {
            success: false,
            conflicts,
            message: "Merge conflicts detected".to_string(),
        });
    }

    Ok(PullResult {
        success: true,
        conflicts: vec![],
        message: format!("Merged {} successfully", branch_name),
    })
}
```

**Step 2: Add git_rebase command**

```rust
#[tauri::command]
pub fn git_rebase(path: &str, onto_branch: &str) -> Result<PullResult, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let onto = repo.find_branch(onto_branch, git2::BranchType::Local)
        .map_err(|e| GitError::Generic(format!("Branch not found: {}", e.message())))?;

    let onto_commit = repo.reference_to_annotated_commit(onto.get())
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let head = repo.head().map_err(|e| GitError::Generic(e.message().to_string()))?;
    let head_commit = repo.reference_to_annotated_commit(&head)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    let mut rebase = repo.rebase(Some(&head_commit), Some(&onto_commit), None, None)
        .map_err(|e| GitError::Generic(format!("Rebase failed: {}", e.message())))?;

    let sig = repo.signature()
        .unwrap_or_else(|_| git2::Signature::now("Notemaker", "notemaker@local").unwrap());

    while let Some(op) = rebase.next() {
        match op {
            Ok(_) => {
                let index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
                if index.has_conflicts() {
                    let conflicts: Vec<String> = index.conflicts()
                        .map_err(|e| GitError::Generic(e.message().to_string()))?
                        .filter_map(|c| c.ok())
                        .filter_map(|c| {
                            c.our.or(c.their).or(c.ancestor)
                                .and_then(|e| String::from_utf8(e.path.clone()).ok())
                        })
                        .collect();

                    return Ok(PullResult {
                        success: false,
                        conflicts,
                        message: "Rebase conflicts detected".to_string(),
                    });
                }
                rebase.commit(None, &sig, None)
                    .map_err(|e| GitError::Generic(e.message().to_string()))?;
            }
            Err(e) => return Err(GitError::Generic(e.message().to_string())),
        }
    }

    rebase.finish(Some(&sig))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(PullResult {
        success: true,
        conflicts: vec![],
        message: format!("Rebased onto {} successfully", onto_branch),
    })
}
```

**Step 3: Add git_abort_rebase and git_continue_rebase**

```rust
#[tauri::command]
pub fn git_abort_rebase(path: &str) -> Result<(), GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let mut rebase = repo.open_rebase(None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    rebase.abort()
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn git_continue_rebase(path: &str) -> Result<PullResult, GitError> {
    let repo = Repository::open(path).map_err(|e| GitError::OpenRepo(e.message().to_string()))?;

    let mut rebase = repo.open_rebase(None)
        .map_err(|e| GitError::Generic(format!("No rebase in progress: {}", e.message())))?;

    let sig = repo.signature()
        .unwrap_or_else(|_| git2::Signature::now("Notemaker", "notemaker@local").unwrap());

    // Commit current step
    rebase.commit(None, &sig, None)
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    // Continue with remaining steps
    while let Some(op) = rebase.next() {
        match op {
            Ok(_) => {
                let index = repo.index().map_err(|e| GitError::Generic(e.message().to_string()))?;
                if index.has_conflicts() {
                    let conflicts: Vec<String> = index.conflicts()
                        .map_err(|e| GitError::Generic(e.message().to_string()))?
                        .filter_map(|c| c.ok())
                        .filter_map(|c| {
                            c.our.or(c.their).or(c.ancestor)
                                .and_then(|e| String::from_utf8(e.path.clone()).ok())
                        })
                        .collect();

                    return Ok(PullResult {
                        success: false,
                        conflicts,
                        message: "More rebase conflicts".to_string(),
                    });
                }
                rebase.commit(None, &sig, None)
                    .map_err(|e| GitError::Generic(e.message().to_string()))?;
            }
            Err(e) => return Err(GitError::Generic(e.message().to_string())),
        }
    }

    rebase.finish(Some(&sig))
        .map_err(|e| GitError::Generic(e.message().to_string()))?;

    Ok(PullResult {
        success: true,
        conflicts: vec![],
        message: "Rebase completed".to_string(),
    })
}
```

**Step 4: Commit**

```bash
git add src-tauri/src/git/commands.rs src-tauri/src/lib.rs
git commit -m "feat(git): add merge and rebase commands"
```

---

## Task 7: Add TypeScript API bindings

**Files:**
- Modify: `src/lib/git/api.ts`

**Step 1: Add types**

```typescript
export interface DiffLine {
  line_type: "context" | "add" | "delete";
  old_line_no: number | null;
  new_line_no: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  hunks: DiffHunk[];
}

export interface CommitDiff {
  commit_id: string;
  message: string;
  author: string;
  time: number;
  files: DiffFile[];
}

export interface BranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export interface PullResult {
  success: boolean;
  conflicts: string[];
  message: string;
}
```

**Step 2: Add API functions**

```typescript
export async function gitDiff(path: string, commitId: string): Promise<CommitDiff> {
  return invoke("git_diff", { path, commitId });
}

export async function gitBranches(path: string): Promise<BranchInfo[]> {
  return invoke("git_branches", { path });
}

export async function gitCheckoutBranch(path: string, branchName: string): Promise<void> {
  return invoke("git_checkout_branch", { path, branchName });
}

export async function gitPull(path: string): Promise<PullResult> {
  return invoke("git_pull", { path });
}

export async function gitPush(path: string): Promise<string> {
  return invoke("git_push", { path });
}

export async function gitMerge(path: string, branchName: string): Promise<PullResult> {
  return invoke("git_merge", { path, branchName });
}

export async function gitRebase(path: string, ontoBranch: string): Promise<PullResult> {
  return invoke("git_rebase", { path, ontoBranch });
}

export async function gitConflictedFiles(path: string): Promise<string[]> {
  return invoke("git_conflicted_files", { path });
}

export async function gitResolveOurs(path: string, filePath: string): Promise<void> {
  return invoke("git_resolve_ours", { path, filePath });
}

export async function gitResolveTheirs(path: string, filePath: string): Promise<void> {
  return invoke("git_resolve_theirs", { path, filePath });
}

export async function gitAbortMerge(path: string): Promise<void> {
  return invoke("git_abort_merge", { path });
}

export async function gitAbortRebase(path: string): Promise<void> {
  return invoke("git_abort_rebase", { path });
}

export async function gitContinueRebase(path: string): Promise<PullResult> {
  return invoke("git_continue_rebase", { path });
}
```

**Step 3: Commit**

```bash
git add src/lib/git/api.ts
git commit -m "feat(git): add TypeScript API bindings for new git commands"
```

---

## Task 8: Create DiffViewer component

**Files:**
- Create: `src/components/DiffViewer.tsx`

**Step 1: Create component**

```tsx
import { For, Show } from "solid-js";
import type { DiffFile, DiffHunk, DiffLine } from "../lib/git/api";

interface DiffViewerProps {
  files: DiffFile[];
}

export function DiffViewer(props: DiffViewerProps) {
  return (
    <div class="diff-viewer">
      <For each={props.files}>
        {(file) => (
          <div class="diff-file border border-gray-700 rounded-lg mb-4 overflow-hidden">
            <div class="diff-file-header bg-gray-800 px-4 py-2 flex items-center gap-2">
              <span class={`text-xs px-1.5 py-0.5 rounded ${
                file.status === "added" ? "bg-green-900 text-green-300" :
                file.status === "deleted" ? "bg-red-900 text-red-300" :
                "bg-blue-900 text-blue-300"
              }`}>
                {file.status === "added" ? "A" : file.status === "deleted" ? "D" : "M"}
              </span>
              <span class="text-sm font-mono text-gray-300">{file.path}</span>
            </div>
            <div class="diff-content bg-gray-900 overflow-x-auto">
              <For each={file.hunks}>
                {(hunk) => (
                  <div class="diff-hunk">
                    <div class="diff-hunk-header bg-gray-800/50 px-4 py-1 text-xs text-gray-500 font-mono">
                      {hunk.header}
                    </div>
                    <table class="w-full text-xs font-mono">
                      <tbody>
                        <For each={hunk.lines}>
                          {(line) => (
                            <tr class={
                              line.line_type === "add" ? "bg-green-900/20" :
                              line.line_type === "delete" ? "bg-red-900/20" :
                              ""
                            }>
                              <td class="w-12 text-right pr-2 text-gray-600 select-none border-r border-gray-800">
                                {line.old_line_no || ""}
                              </td>
                              <td class="w-12 text-right pr-2 text-gray-600 select-none border-r border-gray-800">
                                {line.new_line_no || ""}
                              </td>
                              <td class="w-4 text-center select-none">
                                <span class={
                                  line.line_type === "add" ? "text-green-400" :
                                  line.line_type === "delete" ? "text-red-400" :
                                  "text-gray-600"
                                }>
                                  {line.line_type === "add" ? "+" : line.line_type === "delete" ? "-" : " "}
                                </span>
                              </td>
                              <td class="pl-2 whitespace-pre text-gray-300">{line.content}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export default DiffViewer;
```

**Step 2: Commit**

```bash
git add src/components/DiffViewer.tsx
git commit -m "feat(ui): add DiffViewer component for commit diffs"
```

---

## Task 9: Create BranchSwitcher component

**Files:**
- Create: `src/components/BranchSwitcher.tsx`

**Step 1: Create component**

```tsx
import { createSignal, createEffect, For, Show } from "solid-js";
import { gitBranches, gitCheckoutBranch, type BranchInfo } from "../lib/git/api";
import { vaultStore } from "../lib/store/vault";

interface BranchSwitcherProps {
  onSwitch?: () => void;
}

export function BranchSwitcher(props: BranchSwitcherProps) {
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const currentBranch = () => branches().find(b => b.is_current);
  const vaultPath = () => vaultStore.vault()?.path;

  const loadBranches = async () => {
    const path = vaultPath();
    if (!path) return;

    try {
      const result = await gitBranches(path);
      setBranches(result);
    } catch (e) {
      console.error("Failed to load branches:", e);
    }
  };

  createEffect(() => {
    if (vaultPath()) {
      loadBranches();
    }
  });

  const handleSwitch = async (branchName: string) => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    setError(null);

    try {
      await gitCheckoutBranch(path, branchName);
      await loadBranches();
      setIsOpen(false);
      props.onSwitch?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        disabled={isLoading()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="text-gray-400">
          <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0z"/>
        </svg>
        <span class="text-gray-200">{currentBranch()?.name || "master"}</span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" class="text-gray-400">
          <path d="M8 11L3 6h10l-5 5z"/>
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[160px]">
          <Show when={error()}>
            <div class="px-3 py-2 text-xs text-red-400">{error()}</div>
          </Show>
          <For each={branches()}>
            {(branch) => (
              <button
                onClick={() => !branch.is_current && handleSwitch(branch.name)}
                class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  branch.is_current
                    ? "text-blue-400 bg-blue-900/20"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
                disabled={branch.is_current || isLoading()}
              >
                <Show when={branch.is_current}>
                  <span class="text-blue-400">●</span>
                </Show>
                <Show when={!branch.is_current}>
                  <span class="w-3"></span>
                </Show>
                {branch.name}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default BranchSwitcher;
```

**Step 2: Commit**

```bash
git add src/components/BranchSwitcher.tsx
git commit -m "feat(ui): add BranchSwitcher component"
```

---

## Task 10: Create ConflictResolver component

**Files:**
- Create: `src/components/ConflictResolver.tsx`

**Step 1: Create component**

```tsx
import { createSignal, For, Show } from "solid-js";
import { gitResolveOurs, gitResolveTheirs, gitAbortMerge, gitAbortRebase, gitCommit } from "../lib/git/api";
import { vaultStore } from "../lib/store/vault";

interface ConflictResolverProps {
  conflicts: string[];
  operation: "merge" | "rebase" | "pull";
  onComplete: () => void;
  onAbort: () => void;
}

export function ConflictResolver(props: ConflictResolverProps) {
  const [resolved, setResolved] = createSignal<Record<string, "ours" | "theirs" | "manual">>({});
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const vaultPath = () => vaultStore.vault()?.path;
  const resolvedCount = () => Object.keys(resolved()).length;
  const allResolved = () => resolvedCount() === props.conflicts.length;

  const handleResolve = async (filePath: string, resolution: "ours" | "theirs") => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    setError(null);

    try {
      if (resolution === "ours") {
        await gitResolveOurs(path, filePath);
      } else {
        await gitResolveTheirs(path, filePath);
      }
      setResolved({ ...resolved(), [filePath]: resolution });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenInEditor = (filePath: string) => {
    // Navigate to the file in the editor
    const path = vaultPath();
    if (path) {
      vaultStore.selectNote(path + "/" + filePath);
    }
    setResolved({ ...resolved(), [filePath]: "manual" });
  };

  const handleAbort = async () => {
    const path = vaultPath();
    if (!path) return;

    setIsLoading(true);
    try {
      if (props.operation === "rebase") {
        await gitAbortRebase(path);
      } else {
        await gitAbortMerge(path);
      }
      props.onAbort();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    const path = vaultPath();
    if (!path || !allResolved()) return;

    setIsLoading(true);
    try {
      await gitCommit(path, `Resolve ${props.operation} conflicts`);
      props.onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div class="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" class="text-yellow-500">
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <h2 class="text-lg font-medium text-gray-200">
              {props.operation.charAt(0).toUpperCase() + props.operation.slice(1)} Conflicts ({props.conflicts.length} files)
            </h2>
          </div>
          <button
            onClick={handleAbort}
            class="text-gray-400 hover:text-gray-200"
            disabled={isLoading()}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        <div class="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          <Show when={error()}>
            <div class="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-sm text-red-300">
              {error()}
            </div>
          </Show>

          <For each={props.conflicts}>
            {(filePath) => {
              const status = () => resolved()[filePath];
              return (
                <div class="bg-gray-900 border border-gray-700 rounded-lg p-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-mono text-gray-300 truncate flex-1">
                      {filePath}
                    </span>
                    <Show when={status()}>
                      <span class="text-xs text-green-400 ml-2">
                        ✓ {status() === "manual" ? "Manual" : status() === "ours" ? "Ours" : "Theirs"}
                      </span>
                    </Show>
                  </div>
                  <Show when={!status()}>
                    <div class="flex gap-2 mt-2">
                      <button
                        onClick={() => handleResolve(filePath, "ours")}
                        disabled={isLoading()}
                        class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                      >
                        Keep Ours
                      </button>
                      <button
                        onClick={() => handleResolve(filePath, "theirs")}
                        disabled={isLoading()}
                        class="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50"
                      >
                        Keep Theirs
                      </button>
                      <button
                        onClick={() => handleOpenInEditor(filePath)}
                        disabled={isLoading()}
                        class="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded disabled:opacity-50"
                      >
                        Open in Editor
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <span class="text-sm text-gray-400">
            Resolved: {resolvedCount()}/{props.conflicts.length}
          </span>
          <div class="flex gap-2">
            <button
              onClick={handleAbort}
              disabled={isLoading()}
              class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded disabled:opacity-50"
            >
              Abort {props.operation.charAt(0).toUpperCase() + props.operation.slice(1)}
            </button>
            <button
              onClick={handleComplete}
              disabled={!allResolved() || isLoading()}
              class="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
            >
              Complete {props.operation.charAt(0).toUpperCase() + props.operation.slice(1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConflictResolver;
```

**Step 2: Commit**

```bash
git add src/components/ConflictResolver.tsx
git commit -m "feat(ui): add ConflictResolver component for merge/rebase conflicts"
```

---

## Task 11: Update GitPanel with new features

**Files:**
- Modify: `src/components/GitPanel.tsx`

**Step 1: Add imports and state**

Add to imports:
```tsx
import { BranchSwitcher } from "./BranchSwitcher";
import { DiffViewer } from "./DiffViewer";
import { ConflictResolver } from "./ConflictResolver";
import {
  gitDiff, gitPull, gitPush, gitMerge, gitRebase, gitBranches,
  type CommitDiff, type PullResult, type BranchInfo
} from "../lib/git/api";
```

Add state:
```tsx
const [selectedCommit, setSelectedCommit] = createSignal<CommitDiff | null>(null);
const [conflicts, setConflicts] = createSignal<string[]>([]);
const [conflictOperation, setConflictOperation] = createSignal<"merge" | "rebase" | "pull">("merge");
const [showConflictResolver, setShowConflictResolver] = createSignal(false);
const [branches, setBranches] = createSignal<BranchInfo[]>([]);
const [showMergeSelect, setShowMergeSelect] = createSignal(false);
const [showRebaseSelect, setShowRebaseSelect] = createSignal(false);
```

**Step 2: Add operation handlers**

```tsx
const handlePull = async () => {
  const path = vaultPath();
  if (!path) return;

  setIsLoading(true);
  try {
    const result = await gitPull(path);
    if (!result.success && result.conflicts.length > 0) {
      setConflicts(result.conflicts);
      setConflictOperation("pull");
      setShowConflictResolver(true);
    } else {
      // Show success toast
      await refreshStatus();
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setIsLoading(false);
  }
};

const handlePush = async () => {
  const path = vaultPath();
  if (!path) return;

  setIsLoading(true);
  try {
    await gitPush(path);
    // Show success toast
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setIsLoading(false);
  }
};

const handleMerge = async (branchName: string) => {
  const path = vaultPath();
  if (!path) return;

  setShowMergeSelect(false);
  setIsLoading(true);
  try {
    const result = await gitMerge(path, branchName);
    if (!result.success && result.conflicts.length > 0) {
      setConflicts(result.conflicts);
      setConflictOperation("merge");
      setShowConflictResolver(true);
    } else {
      await refreshStatus();
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setIsLoading(false);
  }
};

const handleRebase = async (branchName: string) => {
  const path = vaultPath();
  if (!path) return;

  setShowRebaseSelect(false);
  setIsLoading(true);
  try {
    const result = await gitRebase(path, branchName);
    if (!result.success && result.conflicts.length > 0) {
      setConflicts(result.conflicts);
      setConflictOperation("rebase");
      setShowConflictResolver(true);
    } else {
      await refreshStatus();
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setIsLoading(false);
  }
};

const handleViewCommit = async (commitId: string) => {
  const path = vaultPath();
  if (!path) return;

  try {
    const diff = await gitDiff(path, commitId);
    setSelectedCommit(diff);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  }
};

const loadBranches = async () => {
  const path = vaultPath();
  if (!path) return;
  try {
    const result = await gitBranches(path);
    setBranches(result);
  } catch (e) {
    console.error("Failed to load branches:", e);
  }
};
```

**Step 3: Update header with BranchSwitcher and operation buttons**

Replace header section:
```tsx
<div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
  <div class="flex items-center gap-3">
    <h2 class="text-lg font-medium text-gray-200">Git</h2>
    <BranchSwitcher onSwitch={refreshStatus} />
  </div>
  <button onClick={onClose} class="text-gray-400 hover:text-gray-200">
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
    </svg>
  </button>
</div>

{/* Operation buttons */}
<div class="flex items-center gap-2 px-4 py-2 border-b border-gray-700 bg-gray-800/50">
  <button
    onClick={handlePull}
    disabled={isLoading()}
    class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center gap-1"
  >
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/>
    </svg>
    Pull
  </button>
  <button
    onClick={handlePush}
    disabled={isLoading()}
    class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center gap-1"
  >
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
    </svg>
    Push
  </button>
  <div class="relative">
    <button
      onClick={() => { loadBranches(); setShowMergeSelect(!showMergeSelect()); }}
      disabled={isLoading()}
      class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
    >
      Merge
    </button>
    <Show when={showMergeSelect()}>
      <div class="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
        <For each={branches().filter(b => !b.is_current)}>
          {(branch) => (
            <button
              onClick={() => handleMerge(branch.name)}
              class="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              {branch.name}
            </button>
          )}
        </For>
      </div>
    </Show>
  </div>
  <div class="relative">
    <button
      onClick={() => { loadBranches(); setShowRebaseSelect(!showRebaseSelect()); }}
      disabled={isLoading()}
      class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
    >
      Rebase
    </button>
    <Show when={showRebaseSelect()}>
      <div class="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
        <For each={branches().filter(b => !b.is_current)}>
          {(branch) => (
            <button
              onClick={() => handleRebase(branch.name)}
              class="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              {branch.name}
            </button>
          )}
        </For>
      </div>
    </Show>
  </div>
</div>
```

**Step 4: Update History tab to show diff on click**

```tsx
{/* In History tab */}
<Show when={!selectedCommit()} fallback={
  <div>
    <button
      onClick={() => setSelectedCommit(null)}
      class="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-3"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
      </svg>
      Back to History
    </button>
    <div class="mb-4 p-3 bg-gray-800 rounded-lg">
      <div class="text-xs text-gray-500 mb-1">Commit {selectedCommit()!.commit_id.slice(0, 7)}</div>
      <div class="text-sm text-gray-200 mb-2">{selectedCommit()!.message}</div>
      <div class="text-xs text-gray-400">
        {selectedCommit()!.author} • {formatCommitTime(selectedCommit()!.time)}
      </div>
    </div>
    <DiffViewer files={selectedCommit()!.files} />
  </div>
}>
  {/* Existing commit list - add onClick handler */}
  <For each={commits()}>
    {(commit) => (
      <div
        onClick={() => handleViewCommit(commit.id)}
        class="p-3 hover:bg-gray-800 rounded cursor-pointer transition-colors"
      >
        {/* existing commit display */}
      </div>
    )}
  </For>
</Show>
```

**Step 5: Add ConflictResolver render**

```tsx
{/* At the end of the component, before closing tag */}
<Show when={showConflictResolver()}>
  <ConflictResolver
    conflicts={conflicts()}
    operation={conflictOperation()}
    onComplete={() => {
      setShowConflictResolver(false);
      setConflicts([]);
      refreshStatus();
    }}
    onAbort={() => {
      setShowConflictResolver(false);
      setConflicts([]);
      refreshStatus();
    }}
  />
</Show>
```

**Step 6: Commit**

```bash
git add src/components/GitPanel.tsx
git commit -m "feat(ui): integrate DiffViewer, BranchSwitcher, ConflictResolver into GitPanel"
```

---

## Task 12: Register all new Rust commands

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add all new commands to invoke_handler**

Find the `.invoke_handler(tauri::generate_handler![...])` section and add:

```rust
git_diff,
git_branches,
git_checkout_branch,
git_pull,
git_push,
git_merge,
git_rebase,
git_conflicted_files,
git_resolve_ours,
git_resolve_theirs,
git_abort_merge,
git_abort_rebase,
git_continue_rebase,
```

**Step 2: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(tauri): register all new git commands"
```

---

## Task 13: Update PLAN.md and test

**Step 1: Update PLAN.md**

Mark I-004 and I-005 as complete.

**Step 2: Build and test**

```bash
pnpm tauri dev
```

Test checklist:
- [ ] Click commit in History → shows diff
- [ ] Branch switcher dropdown works
- [ ] Pull button fetches and merges
- [ ] Push button pushes to remote
- [ ] Merge opens branch selector, merges
- [ ] Rebase opens branch selector, rebases
- [ ] Conflicts open ConflictResolver dialog
- [ ] Keep Ours/Theirs resolves conflict
- [ ] Abort cancels operation
- [ ] Complete finishes merge/rebase

**Step 3: Commit and release**

```bash
git add PLAN.md
git commit -m "chore: mark I-004 and I-005 as complete"
```
