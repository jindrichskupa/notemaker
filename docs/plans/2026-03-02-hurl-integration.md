# Hurl Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Hurl as a new executable interpreter for notebook code blocks.

**Architecture:** Hurl is added as the 4th executable language alongside shell/python/ruby. Since Hurl requires a file as input (not stdin), the code block content is written to a temp file and executed with `hurl --verbose <file>`.

**Tech Stack:** Rust (Tauri backend), SolidJS (frontend), TypeScript

---

## Task 1: Add Hurl to InterpreterSettings (Backend)

**Files:**
- Modify: `src-tauri/src/fs/types.rs:169-195`

**Step 1: Add hurl field to InterpreterSettings struct**

In `src-tauri/src/fs/types.rs`, add `hurl` field after `node`:

```rust
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
    /// Path to Hurl interpreter (default: hurl)
    #[serde(default)]
    pub hurl: Option<String>,
}

impl Default for InterpreterSettings {
    fn default() -> Self {
        Self {
            shell: None,
            python: None,
            ruby: None,
            node: None,
            hurl: None,
        }
    }
}
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add src-tauri/src/fs/types.rs
git commit -m "feat(backend): add hurl to InterpreterSettings"
```

---

## Task 2: Add Hurl Execution Logic (Backend)

**Files:**
- Modify: `src-tauri/src/fs/process.rs:88-174`

**Step 1: Add hurl to default interpreter function**

In `src-tauri/src/fs/process.rs`, update `get_default_interpreter`:

```rust
/// Get the default interpreter for a language
fn get_default_interpreter(language: &str) -> &'static str {
    match language {
        "shell" => "bash",
        "python" => "python3",
        "ruby" => "ruby",
        "hurl" => "hurl",
        _ => "sh",
    }
}
```

**Step 2: Update language validation**

Change line ~111 to include hurl:

```rust
    // Validate language
    if !matches!(lang.as_str(), "shell" | "python" | "ruby" | "hurl") {
        return Err(FsError::InvalidPath(format!("Unsupported language: {}", language)));
    }
```

**Step 3: Add hurl-specific execution logic**

Replace the execution logic (lines ~115-151) with:

```rust
    let interp = interpreter.unwrap_or_else(|| get_default_interpreter(&lang).to_string());

    // Build command based on language
    let (cmd_name, cmd_args, temp_file) = if lang == "hurl" {
        // Hurl requires a file, write code to temp file
        let temp_path = work_dir.join(format!("{}.hurl", block_id));
        std::fs::write(&temp_path, &code).map_err(FsError::Io)?;
        (interp, vec!["--verbose".to_string(), temp_path.to_string_lossy().to_string()], Some(temp_path))
    } else {
        // Other languages use -c or -e flag with inline code
        let arg_flag = match lang.as_str() {
            "shell" => "-c",
            "python" => "-c",
            "ruby" => "-e",
            _ => "-c",
        };
        (interp, vec![arg_flag.to_string(), code.clone()], None)
    };

    // Build command with process group on Unix
    #[cfg(unix)]
    let child = {
        let mut cmd = Command::new(&cmd_name);
        for arg in &cmd_args {
            cmd.arg(arg);
        }
        cmd.current_dir(&work_dir);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        // Create new process group for easier termination
        unsafe {
            cmd.pre_exec(|| {
                libc::setpgid(0, 0);
                Ok(())
            });
        }
        cmd.spawn().map_err(FsError::Io)?
    };

    #[cfg(windows)]
    let child = {
        let mut cmd = Command::new(&cmd_name);
        for arg in &cmd_args {
            cmd.arg(arg);
        }
        cmd.current_dir(&work_dir);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.spawn().map_err(FsError::Io)?
    };

    // Get PID and track it
    let pid = child.id().unwrap_or(0);
    {
        let mut manager = process_state.lock().await;
        manager.track(block_id.clone(), pid);
    }

    // Wait for the process to complete
    let output = child.wait_with_output().await.map_err(FsError::Io)?;

    // Untrack after completion
    {
        let mut manager = process_state.lock().await;
        manager.untrack(&block_id);
    }

    // Clean up temp file for hurl
    if let Some(temp_path) = temp_file {
        let _ = std::fs::remove_file(temp_path);
    }

    Ok(CodeExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
```

**Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

**Step 5: Commit**

```bash
git add src-tauri/src/fs/process.rs
git commit -m "feat(backend): add hurl execution with temp file and --verbose"
```

---

## Task 3: Add Hurl to Frontend Language List

**Files:**
- Modify: `src/components/NotebookBlock.tsx:26-44`

**Step 1: Add hurl to EXECUTABLE_LANGUAGES**

Change line 26:

```typescript
const EXECUTABLE_LANGUAGES = ["shell", "python", "ruby", "hurl"];
```

**Step 2: Add hurl to LANGUAGES array**

Add after ruby (line ~33):

```typescript
const LANGUAGES = [
  { value: "markdown", label: "Markdown", executable: false },
  { value: "shell", label: "Shell", executable: true },
  { value: "python", label: "Python", executable: true },
  { value: "ruby", label: "Ruby", executable: true },
  { value: "hurl", label: "Hurl", executable: true },
  { value: "javascript", label: "JavaScript", executable: false },
  { value: "typescript", label: "TypeScript", executable: false },
  { value: "sql", label: "SQL", executable: false },
  { value: "json", label: "JSON", executable: false },
  { value: "yaml", label: "YAML", executable: false },
  { value: "html", label: "HTML", executable: false },
  { value: "css", label: "CSS", executable: false },
  { value: "rust", label: "Rust", executable: false },
  { value: "go", label: "Go", executable: false },
  { value: "hcl", label: "Terraform/HCL", executable: false },
];
```

**Step 3: Verify TypeScript**

Run: `pnpm check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/NotebookBlock.tsx
git commit -m "feat(ui): add Hurl to executable languages"
```

---

## Task 4: Add Hurl to Interpreter Store

**Files:**
- Modify: `src/lib/store/notebook.ts:405-422`

**Step 1: Add hurl case to getInterpreterForLanguage**

```typescript
function getInterpreterForLanguage(language: string, interpreters: InterpreterSettings): string | undefined {
  const lang = language.toLowerCase();
  switch (lang) {
    case "shell":
    case "bash":
    case "sh":
      return interpreters.shell || undefined;
    case "python":
      return interpreters.python || undefined;
    case "ruby":
      return interpreters.ruby || undefined;
    case "javascript":
    case "node":
      return interpreters.node || undefined;
    case "hurl":
      return interpreters.hurl || undefined;
    default:
      return undefined;
  }
}
```

**Step 2: Update InterpreterSettings type if needed**

Check if `InterpreterSettings` type in `src/lib/store/notebook.ts` or imported type needs update. If local interface exists, add:

```typescript
interface InterpreterSettings {
  shell?: string;
  python?: string;
  ruby?: string;
  node?: string;
  hurl?: string;
}
```

**Step 3: Verify TypeScript**

Run: `pnpm check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/store/notebook.ts
git commit -m "feat(store): add hurl interpreter mapping"
```

---

## Task 5: Add Hurl to Vault Settings UI

**Files:**
- Modify: `src/components/VaultSettingsDialog.tsx:750-761`

**Step 1: Add Hurl input field**

After the Node.js SettingRow (line ~761), add:

```tsx
        <SettingRow label="Hurl" description="Default: hurl">
          <input
            type="text"
            value={props.config.interpreters?.hurl || ""}
            onInput={(e) => props.onUpdate("interpreters", "hurl", e.currentTarget.value || undefined)}
            placeholder="/usr/local/bin/hurl"
            class="w-48 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono"
            style={{ padding: "4px 8px" }}
          />
        </SettingRow>
```

**Step 2: Verify TypeScript**

Run: `pnpm check`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/VaultSettingsDialog.tsx
git commit -m "feat(ui): add Hurl interpreter setting"
```

---

## Task 6: Update PLAN.md

**Files:**
- Modify: `PLAN.md`

**Step 1: Add I-021 Hurl integration entry**

In the "Implementace" section, add:

```markdown
| I-021 | **Hurl integration** | ✅ Hotovo | Hurl jako executable jazyk pro HTTP testing. `--verbose` output. Konfigurovatelná cesta v Vault Settings. |
```

**Step 2: Commit**

```bash
git add PLAN.md
git commit -m "docs: mark I-021 Hurl integration as complete"
```

---

## Task 7: Manual Testing

**Steps:**

1. Run the app: `pnpm tauri dev`
2. Create a new notebook
3. Add a new block, select "Hurl" language
4. Enter test Hurl code:
   ```hurl
   GET https://httpbin.org/get
   HTTP 200
   ```
5. Click Run
6. Verify verbose output shows request and response
7. Test with invalid URL to verify error handling
8. Test Vault Settings → Interpreters → Hurl path setting

**Expected:**
- Run button appears for Hurl blocks
- Execution shows verbose HTTP output
- Errors display in stderr (red)
- Custom interpreter path works

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add hurl to InterpreterSettings | types.rs |
| 2 | Add hurl execution logic | process.rs |
| 3 | Add hurl to frontend languages | NotebookBlock.tsx |
| 4 | Add hurl to interpreter store | notebook.ts |
| 5 | Add hurl to settings UI | VaultSettingsDialog.tsx |
| 6 | Update PLAN.md | PLAN.md |
| 7 | Manual testing | - |
