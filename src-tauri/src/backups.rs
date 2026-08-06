use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::compute_sha256;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupFileMeta {
    pub filename: String,
    pub checksum: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn create_backup(
    parent_id: String,
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();

    // Fetch project data to backup
    let project = conn
        .query_row(
            "SELECT data FROM Project WHERE id = ?1",
            params![parent_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Project not found: {}", e));

    let project_data = match project {
        Ok(d) => d,
        Err(e) => return Err(e),
    };

    let checksum = compute_sha256(&project_data);

    conn.execute(
        "INSERT INTO ProjectBackup (id, parentId, data, checksum, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, parent_id, project_data, checksum, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "id": id }))
}

fn verify_backup_checksum(data_str: &str, expected_checksum: &str) -> Result<(), String> {
    let actual_checksum = compute_sha256(data_str);
    if actual_checksum != expected_checksum {
        return Err(format!(
            "Checksum mismatch: expected {}, got {}",
            expected_checksum, actual_checksum
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn get_backup(
    parent_id: String,
    state: State<'_, DbState>,
) -> Result<Option<serde_json::Value>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let result = conn
        .query_row(
            "SELECT id, parentId, data, checksum, createdAt FROM ProjectBackup WHERE parentId = ?1 ORDER BY createdAt DESC LIMIT 1",
            params![parent_id],
            |row| {
                let data_str: String = row.get(2)?;
                let stored_checksum: String = row.get(3)?;
                Ok((data_str, stored_checksum, row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(4)?))
            },
        )
        .map_err(|e| eprintln!("[backups] get_backup query error: {:?}", e))
        .ok();

    match result {
        Some((data_str, stored_checksum, id, parent_project_id, created_at)) => {
            verify_backup_checksum(&data_str, &stored_checksum)?;
            let parsed: serde_json::Value = serde_json::from_str(&data_str)
                .map_err(|e| format!("Failed to parse backup data: {}", e))?;
            Ok(Some(serde_json::json!({
                "id": id,
                "parentProjectId": parent_project_id,
                "data": parsed,
                "checksum": stored_checksum,
                "createdAt": created_at
            })))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn save_backup_file(
    project_id: String,
    state_json: String,
    state: State<'_, DbState>,
) -> Result<BackupFileMeta, String> {
    let checksum = compute_sha256(&state_json);
    let now = Utc::now().timestamp_millis();

    // FIX-B-4: use LOCALAPPDATA env var for reliable backup path
    let app_data_dir = std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .map_err(|_| "LOCALAPPDATA not set")?;
    let backup_dir = app_data_dir.join("keycluster").join("backups").join(&project_id);
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let filename = format!("{}.kcbak", now);
    let filepath = backup_dir.join(&filename);

    std::fs::write(&filepath, &state_json).map_err(|e| e.to_string())?;

    // Also insert into ProjectBackup table for metadata tracking
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO ProjectBackup (id, parentId, data, checksum, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, project_id, state_json, checksum, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(BackupFileMeta {
        filename,
        checksum,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_backup_files(
    project_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id FROM ProjectBackup WHERE parentId = ?1 ORDER BY createdAt DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SnapshotItem {
    pub id: String,
    pub parent_id: String,
    pub created_at: i64,
    pub label: String,
    pub auto: bool,
    pub phrase_count: i64,
    pub group_count: i64,
}

#[tauri::command]
pub fn list_snapshots(
    parent_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<SnapshotItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, parentId, data, createdAt FROM ProjectBackup WHERE parentId = ?1 ORDER BY createdAt DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![parent_id], |row| {
            let data_str: String = row.get(2)?;
            let created_at: i64 = row.get(3)?;
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, data_str, created_at))
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        let (id, pid, data_str, created_at) = row.map_err(|e| e.to_string())?;
        // FIX-B-5: handle corrupt JSON in backup data
        let parsed: serde_json::Value = match serde_json::from_str(&data_str) {
            Ok(v) => v,
            Err(_) => serde_json::Value::Null,
        };

        let label = parsed
            .get("label")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let is_auto = parsed
            .get("auto")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let phrase_count = parsed
            .get("phraseCount")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        let group_count = parsed
            .get("groupCount")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        result.push(SnapshotItem {
            id,
            parent_id: pid,
            created_at,
            label,
            auto: is_auto,
            phrase_count,
            group_count,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_snapshot(
    id: String,
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let result = conn
        .query_row(
            "SELECT data, checksum FROM ProjectBackup WHERE id = ?1",
            params![id],
            |row| {
                let data_str: String = row.get(0)?;
                let checksum: String = row.get(1)?;
                Ok((data_str, checksum))
            },
        )
        .map_err(|e| eprintln!("[backups] get_snapshot query error: {:?}", e))
        .ok();

    match result {
        Some((data_str, stored_checksum)) => {
            verify_backup_checksum(&data_str, &stored_checksum)?;
            Ok(Some(data_str))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn delete_snapshot(
    id: String,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM ProjectBackup WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows > 0)
}

#[tauri::command]
pub fn prune_backup_files(
    project_id: String,
    keep_count: i64,
    state: State<'_, DbState>,
) -> Result<i64, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Get total count for the project
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM ProjectBackup WHERE parentId = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if total <= keep_count {
        return Ok(0);
    }

    let to_delete = total - keep_count;
    conn.execute(
        "DELETE FROM ProjectBackup WHERE parentId = ?1 AND id NOT IN (
            SELECT id FROM ProjectBackup WHERE parentId = ?1 ORDER BY createdAt DESC LIMIT ?2
        )",
        params![project_id, keep_count],
    )
    .map_err(|e| e.to_string())?;

    // Also clean up files
    // FIX-B-4: use LOCALAPPDATA env var for reliable backup path
    let app_data_dir = std::env::var("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .map_err(|_| "LOCALAPPDATA not set")?;
    let backup_dir = app_data_dir.join("keycluster").join("backups").join(&project_id);
    if backup_dir.exists() {
        let mut entries: Vec<_> = std::fs::read_dir(&backup_dir)
            .map_err(|e| e.to_string())?
            .filter_map(|e| {
                e.map_err(|err| eprintln!("[backups] read_dir error: {:?}", err)).ok()
            })
            .collect();
        entries.sort_by_key(|e| e.path());

        while entries.len() > keep_count as usize {
            if let Some(oldest) = entries.first() {
                std::fs::remove_file(oldest.path()).map_err(|e| e.to_string())?;
                entries.remove(0);
            }
        }
    }

    Ok(to_delete)
}
