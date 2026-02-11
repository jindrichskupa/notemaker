use std::sync::{Arc, Mutex};

mod commands;
mod fs;
mod git;

use fs::{EncryptionState, FileWatcher, ProcessManager, ProcessState, WatcherState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize file watcher state
    let watcher_state: WatcherState = Arc::new(Mutex::new(FileWatcher::new()));

    // Initialize process manager state
    let process_state: ProcessState = Arc::new(tokio::sync::Mutex::new(ProcessManager::new()));

    // Initialize encryption state
    let encryption_state = EncryptionState::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher_state)
        .manage(process_state)
        .manage(encryption_state)
        .invoke_handler(tauri::generate_handler![
            // Basic commands
            commands::greet,
            // File system commands
            fs::open_vault,
            fs::list_directory,
            fs::read_note,
            fs::write_note,
            fs::create_note,
            fs::delete_note,
            fs::rename_note,
            fs::move_note,
            fs::create_directory,
            fs::delete_directory,
            fs::get_vault_config,
            fs::save_vault_config,
            fs::get_local_state,
            fs::save_local_state,
            // Notebook commands
            fs::create_notebook,
            fs::read_notebook,
            fs::add_notebook_block,
            fs::update_notebook_block,
            fs::delete_notebook_block,
            fs::move_notebook_block,
            fs::change_block_type,
            // Code execution
            fs::execute_code_block,
            fs::execute_code_block_async,
            fs::terminate_code_block,
            // Note conversion
            fs::convert_note_to_notebook,
            // File watcher commands
            fs::start_watching,
            fs::stop_watching,
            // Encryption commands
            fs::set_encryption_password,
            fs::set_encryption_identity,
            fs::lock_encryption_session,
            fs::is_encryption_unlocked,
            fs::encrypt_block,
            fs::decrypt_block,
            fs::encrypt_note,
            fs::decrypt_note,
            fs::is_note_encrypted,
            fs::is_content_encrypted,
            // Encryption keychain commands
            fs::set_encryption_password_with_save,
            fs::set_encryption_identity_with_save,
            fs::unlock_from_keychain,
            fs::has_keychain_credentials,
            fs::clear_keychain_credentials,
            fs::lock_encryption_session_with_clear,
            // Git commands
            git::git_init,
            git::git_status,
            git::git_changed_files,
            git::git_stage,
            git::git_stage_all,
            git::git_unstage,
            git::git_commit,
            git::git_log,
            git::git_file_history,
            git::git_show_file,
            git::git_discard,
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
