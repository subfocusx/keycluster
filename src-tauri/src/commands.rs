use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct HealthCheckResponse {
    pub status: String,
    pub version: String,
    pub db_connected: bool,
}

#[tauri::command]
pub fn health_check(db: tauri::State<'_, crate::db::DbState>) -> HealthCheckResponse {
    let db_ok = db.conn.lock().map(|_| true).unwrap_or(false);
    HealthCheckResponse {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        db_connected: db_ok,
    }
}

#[tauri::command]
pub async fn export_project_to_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project_root() -> String {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    Path::new(manifest_dir)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| manifest_dir.to_string())
}
