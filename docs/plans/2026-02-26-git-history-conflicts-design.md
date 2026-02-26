# Git History & Conflict Resolution Design

**Goal:** Add commit diff viewer, branch switching, and conflict resolution UI for pull/merge/rebase operations.

## Requirements

- **History UI**: Click commit to see diff with changed files and inline additions/deletions
- **Conflicts**: Simple per-file choice dialog (Keep Ours / Keep Theirs / Open in Editor)
- **Operations**: Pull, push, merge, rebase support
- **Branches**: Minimal switch-only dropdown (no create/delete UI)

## Architecture

### Extended GitPanel Structure

```
GitPanel
├── Header: [branch dropdown ▾]
├── Actions: [Pull] [Push] [Merge] [Rebase]
├── Tabs
│   ├── Changes (existing)
│   └── History (enhanced with diff viewer)
└── ConflictResolver (modal, when conflicts exist)
```

### New Rust Commands

| Command | Purpose |
|---------|---------|
| `git_diff` | Get unified diff for a commit |
| `git_branches` | List local branches |
| `git_checkout_branch` | Switch to branch |
| `git_pull` | Fetch + merge from remote |
| `git_push` | Push to remote |
| `git_merge` | Merge branch into current |
| `git_rebase` | Rebase current onto branch |
| `git_conflicted_files` | List files with conflicts |
| `git_resolve_ours` | Accept our version of file |
| `git_resolve_theirs` | Accept their version of file |
| `git_abort_merge` | Abort merge in progress |
| `git_abort_rebase` | Abort rebase in progress |
| `git_continue_rebase` | Continue after resolving |

### New UI Components

1. **DiffViewer** - Renders unified diff with syntax highlighting
2. **BranchSwitcher** - Dropdown for switching branches
3. **ConflictResolver** - Modal dialog for resolving conflicts

---

## Component Designs

### 1. Commit Detail View (History Tab)

When user clicks a commit in history list:

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to History                                       │
├─────────────────────────────────────────────────────────┤
│ Commit: abc123f                                         │
│ Author: John Doe <john@example.com>                     │
│ Date: 2 hours ago                                       │
│ Message: Fix inline image loading                       │
├─────────────────────────────────────────────────────────┤
│ Changed files (3):                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ M src/lib/editor/inline-markdown.ts      [collapse] │ │
│ │ ──────────────────────────────────────────────────  │ │
│ │  94│   eq(other: ImageWidget): boolean {            │ │
│ │ -95│     return other.src === this.src;             │ │
│ │ +95│     return other.src === this.src &&           │ │
│ │ +96│       other.resolvedSrc === this.resolvedSrc;  │ │
│ │  97│   }                                            │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ M src/components/Editor.tsx              [expand]   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Collapsible file sections
- Syntax highlighting (green = added, red = removed)
- Line numbers with context
- Scrollable single view

### 2. ConflictResolver Dialog

Opens automatically when pull/merge/rebase encounters conflicts:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Merge Conflicts (3 files)                         ✕   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ src/components/Editor.tsx                         │  │
│  │ [Keep Ours] [Keep Theirs] [Open in Editor]        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ src/lib/store/vault.ts                    ✓ Ours  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ PLAN.md                                           │  │
│  │ [Keep Ours] [Keep Theirs] [Open in Editor]        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Resolved: 1/3                                           │
│                        [Abort Merge]  [Complete Merge]  │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- List all conflicted files
- Per-file: Keep Ours / Keep Theirs / Open in Editor
- Progress indicator
- Abort cancels operation
- Complete commits the resolution

**"Open in Editor"** flow:
1. Opens file with conflict markers visible
2. User edits manually and saves
3. User clicks "Mark Resolved" button in conflict dialog
4. File removed from conflict list

### 3. Branch Switcher

Dropdown in GitPanel header:

```
┌──────────────────────┐
│ ● master             │  ← current branch
│   feature/images     │
│   fix/editor-crash   │
│   develop            │
└──────────────────────┘
```

**Behavior:**
- Current branch marked with ●
- Click to switch (git checkout)
- If uncommitted changes: show warning dialog
- No create/delete (use terminal)

### 4. Operation Buttons

New buttons in Changes tab header:

```
[Pull ↓] [Push ↑] [Merge ↗] [Rebase ↺]
```

**Pull:**
- Fetches from origin
- Merges into current branch
- On conflict → opens ConflictResolver

**Push:**
- Pushes current branch to origin
- Shows error if rejected (needs pull first)

**Merge:**
- Opens branch selector dropdown
- Merges selected branch into current
- On conflict → opens ConflictResolver

**Rebase:**
- Opens branch selector dropdown
- Rebases current branch onto selected
- On conflict → opens ConflictResolver
- Shows "Continue Rebase" button after resolving each step

---

## Data Flow

### Conflict Resolution Flow

```
1. User clicks Pull/Merge/Rebase
2. Rust command executes operation
3. If conflicts:
   - Returns { success: false, conflicts: ["file1.ts", "file2.ts"] }
   - Frontend opens ConflictResolver modal
4. User resolves each file (ours/theirs/manual)
5. For each resolution:
   - git_resolve_ours/theirs OR user edits + marks resolved
   - git_stage(file)
6. When all resolved:
   - For merge: git_commit (merge commit)
   - For rebase: git_continue_rebase
7. Success → close modal, refresh status
```

### Diff Retrieval

```typescript
interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;  // @@ -10,5 +10,7 @@
  lines: DiffLine[];
}

interface DiffLine {
  type: "context" | "add" | "delete";
  oldLineNo: number | null;
  newLineNo: number | null;
  content: string;
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Push rejected | Toast: "Push rejected. Pull first to get remote changes." |
| Checkout with changes | Dialog: "You have uncommitted changes. Stash or commit?" |
| Merge already in progress | Show ConflictResolver with existing conflicts |
| Rebase already in progress | Show "Continue Rebase" / "Abort Rebase" options |
| Network error | Toast with retry option |

---

## Out of Scope (YAGNI)

- Branch create/delete UI
- Remote management
- Stash UI
- Cherry-pick
- Interactive rebase
- Blame view
- Tag management
- Submodules

---

## Files to Modify/Create

**Rust (src-tauri/src/git/):**
- `commands.rs` - Add new git commands
- `types.rs` - Add Diff types

**TypeScript (src/lib/git/):**
- `api.ts` - Add new API bindings

**Components (src/components/):**
- `GitPanel.tsx` - Add operation buttons, branch switcher
- `DiffViewer.tsx` - NEW: Render diff with syntax highlighting
- `ConflictResolver.tsx` - NEW: Conflict resolution dialog
- `BranchSwitcher.tsx` - NEW: Branch dropdown
