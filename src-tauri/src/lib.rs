use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::Manager;

mod api_server;
mod commands;
mod db;
mod http;
mod projects;
mod backups;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_data_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("[keycluster] failed to resolve app data dir: {}", e);
                    return Err(Box::new(e));
                }
            };
            std::fs::create_dir_all(&app_data_dir).ok();
            std::fs::create_dir_all(app_data_dir.join("logs")).ok();

            let db_path = app_data_dir.join("custom.db");
            let db_path_str = db_path.to_str().unwrap_or_else(|| {
                eprintln!("[keycluster] db_path is not valid UTF-8");
                "keycluster.db"
            });
            let conn = match db::init_db(db_path_str) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[keycluster] failed to initialize database: {}", e);
                    return Err(Box::new(e));
                }
            };

            app.manage(db::DbState {
                conn: std::sync::Mutex::new(conn),
            });

            let api_state = api_server::ApiState {
                handle: app.handle().clone(),
                token: api_server::SharedToken::new(uuid::Uuid::new_v4().to_string()),
                port: api_server::SharedPort::new(42001),
                started_at: Instant::now(),
                request_log: Arc::new(Mutex::new(Vec::new())),
                restart_tx: api_server::SharedRestart::new(),
                rate_map: Arc::new(Mutex::new(HashMap::new())),
            };

            app.manage(api_state.clone());

            let handle = app.handle().clone();
            let state = api_state.clone();
            tauri::async_runtime::spawn(async move {
                api_server::start(handle, state).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::get_project_root,
            commands::export_project_to_file,
            http::http_request,
            projects::list_projects,
            projects::get_project,
            projects::create_project,
            projects::update_project,
            projects::delete_project,
            projects::restore_project,
            backups::create_backup,
            backups::get_backup,
            backups::save_backup_file,
            backups::list_backup_files,
            backups::prune_backup_files,
            backups::list_snapshots,
            backups::get_snapshot,
            backups::delete_snapshot,
            api_server::get_api_token,
            api_server::regenerate_api_token,
            api_server::get_api_status,
            api_server::get_api_request_log,
            api_server::restart_api_server,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("[keycluster] error while running tauri application: {}", e);
        });
}

pub fn compute_sha256(data: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}
