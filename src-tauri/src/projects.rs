use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::compute_sha256;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub version: String,
    pub data: String,
    pub phrase_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub phrase_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    pub version: Option<String>,
    pub groups: Option<String>,
    pub phrases: Option<String>,
    pub phrase_count: Option<i64>,
    pub minus_words: Option<String>,
    pub settings: Option<String>,
    pub ui_state: Option<String>,
    pub is_backup: Option<bool>,
    pub parent_project_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub version: Option<String>,
    pub groups: Option<String>,
    pub phrases: Option<String>,
    pub phrase_count: Option<i64>,
    pub minus_words: Option<String>,
    pub settings: Option<String>,
    pub ui_state: Option<String>,
}

fn build_data(input: &CreateProjectInput) -> Result<String, String> {
    let mut map = serde_json::Map::new();
    if let Some(ref v) = input.groups {
        map.insert("groups".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.phrases {
        map.insert("phrases".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.minus_words {
        map.insert("minusWords".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.settings {
        map.insert("settings".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.ui_state {
        map.insert("uiState".into(), serde_json::Value::String(v.clone()));
    }
    map.insert("version".into(), serde_json::Value::String(
        input.version.clone().unwrap_or_else(|| "1.0".into())
    ));
    // FIX-B-6: propagate serialization error instead of panicking
    serde_json::to_string(&map).map_err(|e| format!("serialize project data: {}", e))
}

fn build_update_data(input: &UpdateProjectInput) -> Result<String, String> {
    let mut map = serde_json::Map::new();
    if let Some(ref v) = input.groups {
        map.insert("groups".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.phrases {
        map.insert("phrases".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.minus_words {
        map.insert("minusWords".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.settings {
        map.insert("settings".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.ui_state {
        map.insert("uiState".into(), serde_json::Value::String(v.clone()));
    }
    if let Some(ref v) = input.version {
        map.insert("version".into(), serde_json::Value::String(v.clone()));
    }
    // FIX-B-6: propagate serialization error instead of panicking
    serde_json::to_string(&map).map_err(|e| format!("serialize project data: {}", e))
}

#[tauri::command]
pub fn list_projects(state: State<'_, DbState>) -> Result<Vec<ProjectListItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, version, phraseCount, createdAt, updatedAt FROM Project ORDER BY updatedAt DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectListItem {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                phrase_count: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_project(id: String, state: State<'_, DbState>) -> Result<Option<ProjectRow>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, version, data, phraseCount, createdAt, updatedAt FROM Project WHERE id = ?")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row(params![id], |row| {
            Ok(ProjectRow {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                data: row.get(3)?,
                phrase_count: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn create_project(
    input: CreateProjectInput,
    state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp_millis();
    let data = build_data(&input)?;

    // Count phrases on Rust side if phrases are provided
    let phrase_count = if let Some(ref phrases_json) = input.phrases {
        if let Ok(phrases) = serde_json::from_str::<Vec<serde_json::Value>>(phrases_json) {
            phrases.len() as i64
        } else {
            input.phrase_count.unwrap_or(0)
        }
    } else {
        input.phrase_count.unwrap_or(0)
    };

    conn.execute(
        "INSERT INTO Project (id, name, version, data, phraseCount, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.name,
            input.version.as_deref().unwrap_or("1.0"),
            data,
            phrase_count,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub fn update_project(
    id: String,
    input: UpdateProjectInput,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp_millis();
    let data = build_update_data(&input)?;

    let phrase_count = if let Some(ref phrases_json) = input.phrases {
        if let Ok(phrases) = serde_json::from_str::<Vec<serde_json::Value>>(phrases_json) {
            Some(phrases.len() as i64)
        } else {
            input.phrase_count
        }
    } else {
        input.phrase_count
    };

    let rows = conn
        .execute(
            "UPDATE Project SET data = ?1, phraseCount = COALESCE(?2, phraseCount), updatedAt = ?3 WHERE id = ?4",
            params![data, phrase_count, now, id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows > 0)
}

#[tauri::command]
pub fn delete_project(id: String, state: State<'_, DbState>) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // NOTE: Backups (ProjectBackup) are preserved after project deletion
    // to support snapshot restore. Orphaned backups are cleaned up
    // separately via snapshot lifecycle pruning.

    let rows = conn
        .execute("DELETE FROM Project WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(rows > 0)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestoreBackupInput {
    pub backup_id: String,
    pub parent_project_id: String,
}

#[tauri::command]
pub fn restore_project(
    input: RestoreBackupInput,
    state: State<'_, DbState>,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let backup_data: (String, String) = conn
        .query_row(
            "SELECT data, checksum FROM ProjectBackup WHERE id = ?1 AND parentId = ?2",
            params![input.backup_id, input.parent_project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Backup not found: {}", e))?;

    let (data_str, stored_checksum) = backup_data;

    let actual_checksum = compute_sha256(&data_str);
    if actual_checksum != stored_checksum {
        return Err(format!(
            "Checksum mismatch during restore: expected {}, got {}",
            stored_checksum, actual_checksum
        ));
    }

    let parsed: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|e| format!("Failed to parse backup data: {}", e))?;

    let groups = parsed
        .get("groups")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let phrases = parsed
        .get("phrases")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let minus_words = parsed
        .get("minusWords")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let settings = parsed
        .get("settings")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let ui_state = parsed
        .get("uiState")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let version = parsed
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let update_input = UpdateProjectInput {
        name: None,
        version,
        groups,
        phrases,
        phrase_count: None,
        minus_words,
        settings,
        ui_state,
    };

    let now = Utc::now().timestamp_millis();
    let data = build_update_data(&update_input)?;

    let phrase_count = if let Some(ref phrases_json) = update_input.phrases {
        if let Ok(phrases) = serde_json::from_str::<Vec<serde_json::Value>>(phrases_json) {
            Some(phrases.len() as i64)
        } else {
            None
        }
    } else {
        None
    };

    let rows = conn
        .execute(
            "UPDATE Project SET data = ?1, phraseCount = COALESCE(?2, phraseCount), updatedAt = ?3 WHERE id = ?4",
            params![data, phrase_count, now, input.parent_project_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(rows > 0)
}
