/**
 * Git API - TypeScript bindings for Tauri git commands
 */

import { invoke } from "@tauri-apps/api/core";

export interface GitStatus {
  is_repo: boolean;
  branch: string | null;
  has_changes: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
}

export interface FileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "unknown";
  staged: boolean;
}

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface FileHistory {
  path: string;
  commits: CommitInfo[];
}

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

/**
 * Initialize a git repository in the vault
 */
export async function gitInit(vaultPath: string): Promise<boolean> {
  return invoke<boolean>("git_init", { vaultPath });
}

/**
 * Get git status for the vault
 */
export async function gitStatus(vaultPath: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { vaultPath });
}

/**
 * Get list of changed files
 */
export async function gitChangedFiles(vaultPath: string): Promise<FileStatus[]> {
  return invoke<FileStatus[]>("git_changed_files", { vaultPath });
}

/**
 * Stage a file for commit
 */
export async function gitStage(vaultPath: string, filePath: string): Promise<void> {
  return invoke("git_stage", { vaultPath, filePath });
}

/**
 * Stage all changes
 */
export async function gitStageAll(vaultPath: string): Promise<number> {
  return invoke<number>("git_stage_all", { vaultPath });
}

/**
 * Unstage a file
 */
export async function gitUnstage(vaultPath: string, filePath: string): Promise<void> {
  return invoke("git_unstage", { vaultPath, filePath });
}

/**
 * Commit staged changes
 */
export async function gitCommit(vaultPath: string, message: string): Promise<string> {
  return invoke<string>("git_commit", { vaultPath, message });
}

/**
 * Get commit history for the vault
 */
export async function gitLog(vaultPath: string, limit?: number): Promise<CommitInfo[]> {
  return invoke<CommitInfo[]>("git_log", { vaultPath, limit });
}

/**
 * Get history for a specific file
 */
export async function gitFileHistory(
  vaultPath: string,
  filePath: string,
  limit?: number
): Promise<FileHistory> {
  return invoke<FileHistory>("git_file_history", { vaultPath, filePath, limit });
}

/**
 * Get file content at a specific commit
 */
export async function gitShowFile(
  vaultPath: string,
  filePath: string,
  commitId: string
): Promise<string> {
  return invoke<string>("git_show_file", { vaultPath, filePath, commitId });
}

/**
 * Discard changes to a file
 */
export async function gitDiscard(vaultPath: string, filePath: string): Promise<void> {
  return invoke("git_discard", { vaultPath, filePath });
}

/**
 * Get diff for a specific commit
 */
export async function gitDiff(path: string, commitId: string): Promise<CommitDiff> {
  return invoke<CommitDiff>("git_diff", { path, commitId });
}

/**
 * Get list of branches
 */
export async function gitBranches(path: string): Promise<BranchInfo[]> {
  return invoke<BranchInfo[]>("git_branches", { path });
}

/**
 * Checkout a branch
 */
export async function gitCheckoutBranch(path: string, branchName: string): Promise<void> {
  return invoke("git_checkout_branch", { path, branchName });
}

/**
 * Pull changes from remote
 */
export async function gitPull(path: string): Promise<PullResult> {
  return invoke<PullResult>("git_pull", { path });
}

/**
 * Push changes to remote
 */
export async function gitPush(path: string): Promise<string> {
  return invoke<string>("git_push", { path });
}

/**
 * Merge a branch into current branch
 */
export async function gitMerge(path: string, branchName: string): Promise<PullResult> {
  return invoke<PullResult>("git_merge", { path, branchName });
}

/**
 * Rebase current branch onto another branch
 */
export async function gitRebase(path: string, ontoBranch: string): Promise<PullResult> {
  return invoke<PullResult>("git_rebase", { path, ontoBranch });
}

/**
 * Get list of conflicted files
 */
export async function gitConflictedFiles(path: string): Promise<string[]> {
  return invoke<string[]>("git_conflicted_files", { path });
}

/**
 * Resolve conflict by keeping our version
 */
export async function gitResolveOurs(path: string, filePath: string): Promise<void> {
  return invoke("git_resolve_ours", { path, filePath });
}

/**
 * Resolve conflict by keeping their version
 */
export async function gitResolveTheirs(path: string, filePath: string): Promise<void> {
  return invoke("git_resolve_theirs", { path, filePath });
}

/**
 * Abort an in-progress merge
 */
export async function gitAbortMerge(path: string): Promise<void> {
  return invoke("git_abort_merge", { path });
}

/**
 * Abort an in-progress rebase
 */
export async function gitAbortRebase(path: string): Promise<void> {
  return invoke("git_abort_rebase", { path });
}

/**
 * Continue a paused rebase after resolving conflicts
 */
export async function gitContinueRebase(path: string): Promise<PullResult> {
  return invoke<PullResult>("git_continue_rebase", { path });
}

/**
 * Format timestamp as relative time
 */
export function formatCommitTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) {
    return "just now";
  } else if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } else {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  }
}
