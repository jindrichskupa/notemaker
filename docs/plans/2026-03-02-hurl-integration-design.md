# Hurl Integration Design

**Date:** 2026-03-02
**Status:** Approved

## Overview

Add [Hurl](https://hurl.dev/) as a new executable interpreter for notebook code blocks. Hurl is a command-line tool for running HTTP requests defined in plain text format.

## Requirements

- Execute Hurl code blocks in notebooks
- Verbose output mode (`--verbose`) for full request/response details
- Configurable interpreter path in vault settings
- No variables support in initial version (can be added later)

## Architecture

Hurl is added as the 4th executable language alongside shell/python/ruby. The existing execution flow remains unchanged:

```
NotebookBlock (Run click)
    → notebookStore.runCodeBlock()
    → executeCodeBlockAsync(blockId, "hurl", code, workingDir, interpreter)
    → Tauri command: execute_code_block_async
    → Rust: spawn hurl process with --verbose flag
    → Output back to UI (stdout/stderr)
```

**Execution method:** Hurl requires a file as input (not stdin), so the code block content is written to a temp file `request.hurl` and executed as `hurl --verbose request.hurl`.

## Code Changes

### Frontend

**`src/components/NotebookBlock.tsx`:**
- Add `"hurl"` to `EXECUTABLE_LANGUAGES` array (line ~26)
- Add `{ value: "hurl", label: "Hurl", executable: true }` to language options

**`src/lib/store/notebook.ts`:**
- Add `hurl` case to `getInterpreterForLanguage()` - returns path from config or default `"hurl"`

**`src/components/VaultSettingsDialog.tsx`:**
- Add input field for Hurl interpreter path in Interpreters tab

### Backend (Rust)

**`src-tauri/src/fs/process.rs`:**
- Add `"hurl"` to language validation (line ~110-113)
- Add execution handling:
  - Write code to temp file with `.hurl` extension
  - Execute: `hurl --verbose <temp_file>`
  - Clean up temp file after execution

**`src-tauri/src/fs/types.rs`:**
- Add `hurl: Option<String>` to `InterpreterSettings` struct

## Syntax Highlighting

Hurl doesn't have an official CodeMirror 6 mode. Initial implementation uses plain text or HTTP mode for basic highlighting.

**Future enhancement:** Create custom CodeMirror mode for Hurl syntax (requests, headers, assertions, captures).

## Testing

- Manual testing: create notebook with Hurl block, execute HTTP request
- Verify stdout shows verbose output (request + response)
- Verify stderr captures errors (connection failures, assertion errors)
- Test interpreter path configuration

## Future Enhancements

- [ ] Custom CodeMirror syntax highlighting for Hurl
- [ ] Variables support (`--variable name=value`)
- [ ] Environment files (`--variables-file`)
- [ ] JSON report mode for structured output
