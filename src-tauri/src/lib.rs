mod commands;
mod skills_data;

use commands::{ai, filesystem, llm_gateway, terminal, skills, git, sidecar, updater};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            filesystem::read_file,
            filesystem::write_file,
            filesystem::delete_file,
            filesystem::list_dir,
            filesystem::get_file_tree,
            terminal::run_command,
            ai::ai_models,
            ai::chat_completion,
            llm_gateway::cloud_chat_completion,
            llm_gateway::cloud_models,
            skills::discover_skills,
            skills::read_skill,
            git::git_status,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_clone,
            sidecar::start_sidecar,
            sidecar::stop_sidecar,
            sidecar::is_sidecar_running,
            updater::check_local_update,
            updater::install_update,
            updater::get_app_version,
        ])
        .setup(|_app| {
            std::thread::spawn(|| {
                match sidecar::start_sidecar() {
                    Ok(_) => eprintln!("[sidecar] Auto-started successfully"),
                    Err(e) => eprintln!("[sidecar] Auto-start skipped: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
