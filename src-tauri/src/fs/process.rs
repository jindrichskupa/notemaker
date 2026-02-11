use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Mutex;

use super::commands::{CodeExecutionResult, FsError};

/// Tracks running processes by their PID
pub struct ProcessManager {
    /// Map of block_id -> process PID
    pids: HashMap<String, u32>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            pids: HashMap::new(),
        }
    }

    /// Track a process PID
    pub fn track(&mut self, block_id: String, pid: u32) {
        // Kill any existing process for this block
        if let Some(old_pid) = self.pids.remove(&block_id) {
            Self::kill_pid(old_pid);
        }
        self.pids.insert(block_id, pid);
    }

    /// Remove a process from tracking
    pub fn untrack(&mut self, block_id: &str) {
        self.pids.remove(block_id);
    }

    /// Kill a running process by block ID
    pub fn kill(&mut self, block_id: &str) -> bool {
        if let Some(pid) = self.pids.remove(block_id) {
            Self::kill_pid(pid)
        } else {
            false
        }
    }

    /// Kill a process by PID
    fn kill_pid(pid: u32) -> bool {
        #[cfg(unix)]
        {
            use std::process::Command;
            // Kill the process group to also terminate child processes
            Command::new("kill")
                .arg("-TERM")
                .arg(format!("-{}", pid))
                .output()
                .map(|o| o.status.success())
                .unwrap_or_else(|_| {
                    // Fallback: just kill the process itself
                    Command::new("kill")
                        .arg("-TERM")
                        .arg(pid.to_string())
                        .output()
                        .map(|o| o.status.success())
                        .unwrap_or(false)
                })
        }
        #[cfg(windows)]
        {
            use std::process::Command;
            Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global process manager state (using tokio Mutex for async)
pub type ProcessState = Arc<Mutex<ProcessManager>>;

/// Get the default interpreter for a language
fn get_default_interpreter(language: &str) -> &'static str {
    match language {
        "shell" => "bash",
        "python" => "python3",
        "ruby" => "ruby",
        _ => "sh",
    }
}

/// Execute a code block asynchronously with process tracking
#[tauri::command]
pub async fn execute_code_block_async(
    block_id: String,
    language: String,
    code: String,
    working_dir: Option<PathBuf>,
    interpreter: Option<String>,
    process_state: tauri::State<'_, ProcessState>,
) -> Result<CodeExecutionResult, FsError> {
    let work_dir = working_dir.unwrap_or_else(|| std::env::temp_dir());
    let lang = language.to_lowercase();

    // Validate language
    if !matches!(lang.as_str(), "shell" | "python" | "ruby") {
        return Err(FsError::InvalidPath(format!("Unsupported language: {}", language)));
    }

    let interp = interpreter.unwrap_or_else(|| get_default_interpreter(&lang).to_string());

    // Get the appropriate argument flag for the language
    let arg_flag = match lang.as_str() {
        "shell" => "-c",
        "python" => "-c",
        "ruby" => "-e",
        _ => "-c",
    };

    // Build command with process group on Unix
    #[cfg(unix)]
    let child = {
        let mut cmd = Command::new(&interp);
        cmd.arg(arg_flag).arg(&code);
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
        let mut cmd = Command::new(&interp);
        cmd.arg(arg_flag).arg(&code);
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

    Ok(CodeExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Terminate a running code block
#[tauri::command]
pub async fn terminate_code_block(
    block_id: String,
    process_state: tauri::State<'_, ProcessState>,
) -> Result<bool, FsError> {
    let mut manager = process_state.lock().await;
    Ok(manager.kill(&block_id))
}
