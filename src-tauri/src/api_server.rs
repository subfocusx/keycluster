use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, Request, StatusCode},
    middleware,
    response::{IntoResponse, Json},
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use uuid::Uuid;

use crate::db::DbState;

// ═══════════════════════════════════════════════════════════
//  Public types (used from lib.rs)
// ═══════════════════════════════════════════════════════════

#[derive(Clone)]
pub struct SharedToken {
    inner: Arc<Mutex<String>>,
}

impl SharedToken {
    pub fn new(token: String) -> Self {
        Self { inner: Arc::new(Mutex::new(token)) }
    }
    pub fn get(&self) -> String {
        self.inner.lock().map(|g| g.clone()).unwrap_or_else(|e| {
            eprintln!("[api_server] SharedToken lock poisoned: {:?}", e);
            String::new()
        })
    }
    pub fn set(&self, val: String) {
        match self.inner.lock() {
            Ok(mut guard) => *guard = val,
            Err(e) => eprintln!("[api_server] SharedToken lock poisoned on set: {:?}", e),
        }
    }
}

#[derive(Clone)]
pub struct SharedPort {
    inner: Arc<Mutex<u16>>,
}

impl SharedPort {
    pub fn new(port: u16) -> Self {
        Self { inner: Arc::new(Mutex::new(port)) }
    }
    pub fn get(&self) -> u16 {
        self.inner.lock().map(|g| *g).unwrap_or_else(|e| {
            eprintln!("[api_server] SharedPort lock poisoned: {:?}", e);
            42001 // default port
        })
    }
    pub fn set(&self, val: u16) {
        match self.inner.lock() {
            Ok(mut guard) => *guard = val,
            Err(e) => eprintln!("[api_server] SharedPort lock poisoned on set: {:?}", e),
        }
    }
}

#[derive(Clone)]
pub struct SharedRestart {
    inner: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl SharedRestart {
    pub fn new() -> Self {
        Self { inner: Arc::new(Mutex::new(None)) }
    }
    pub fn store(&self, tx: tokio::sync::oneshot::Sender<()>) {
        match self.inner.lock() {
            Ok(mut guard) => *guard = Some(tx),
            Err(e) => eprintln!("[api_server] SharedRestart lock poisoned on store: {:?}", e),
        }
    }
    pub fn signal(&self) {
        match self.inner.lock() {
            Ok(mut guard) => {
                if let Some(tx) = guard.take() {
                    let _ = tx.send(());
                }
            }
            Err(e) => eprintln!("[api_server] SharedRestart lock poisoned on signal: {:?}", e),
        }
    }
}

#[derive(Clone)]
pub struct ApiState {
    pub handle: AppHandle,
    pub token: SharedToken,
    pub port: SharedPort,
    pub started_at: Instant,
    pub request_log: Arc<Mutex<Vec<RequestLogEntry>>>,
    pub restart_tx: SharedRestart,
    pub rate_map: Arc<Mutex<HashMap<String, Vec<u64>>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestLogEntry {
    pub method: String,
    pub path: String,
    pub status: u16,
    pub timestamp_ms: u64,
    pub duration_ms: u64,
}

// ═══════════════════════════════════════════════════════════
//  Tauri commands
// ═══════════════════════════════════════════════════════════

#[tauri::command]
pub fn get_api_token(state: tauri::State<'_, ApiState>) -> String {
    state.token.get()
}

#[tauri::command]
pub fn regenerate_api_token(state: tauri::State<'_, ApiState>) -> String {
    let new = Uuid::new_v4().to_string();
    state.token.set(new.clone());
    new
}

#[tauri::command]
pub fn get_api_status(state: tauri::State<'_, ApiState>) -> serde_json::Value {
    serde_json::json!({
        "running": true,
        "port": state.port.get(),
        "uptime_secs": state.started_at.elapsed().as_secs(),
    })
}

#[tauri::command]
pub fn get_api_request_log(state: tauri::State<'_, ApiState>) -> Vec<RequestLogEntry> {
    state.request_log.lock().map(|g| g.clone()).unwrap_or_else(|e| {
        eprintln!("[api_server] request_log lock poisoned: {:?}", e);
        Vec::new()
    })
}

#[tauri::command]
pub async fn restart_api_server(
    port: u16,
    state: tauri::State<'_, ApiState>,
) -> Result<(), String> {
    let old = state.port.get();
    if port == old {
        return Ok(());
    }
    state.port.set(port);
    state.restart_tx.signal();
    Ok(())
}

// ═══════════════════════════════════════════════════════════
//  Server entry point
// ═══════════════════════════════════════════════════════════

pub async fn start(_handle: AppHandle, shared: ApiState) {
    loop {
        let port = shared.port.get();
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        shared.restart_tx.store(shutdown_tx);

        // FIX-B-1: CORS - only localhost
        // FIX-B-1: CORS - localhost for origin, Any for methods/headers
        let cors = CorsLayer::new()
            .allow_origin(AllowOrigin::exact(
                "http://localhost".parse().expect("hardcoded URL must be valid")
            ))
            .allow_methods(Any)
            .allow_headers(Any);

        let app = Router::new()
            .route("/api/health", get(health))
            .route("/api/token", get(get_token))
            .route("/api/phrases", post(add_phrases))
            .route("/api/phrases", delete(delete_phrases))
            .route("/api/phrases", get(get_phrases))
            .route("/api/frequency", post(update_frequency))
            .route("/api/project", get(get_project))
            .route("/api/groups", get(get_groups))
            .route("/api/snapshot", post(create_snapshot))
            .route("/api/log", get(get_log))
            .layer(cors)
            .layer(middleware::from_fn_with_state(
                shared.clone(),
                request_logger,
            ))
            .with_state(shared.clone());

        let addr = format!("127.0.0.1:{}", port);
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                println!("[api_server] listening on {}", addr);
                axum::serve(listener, app)
                    .with_graceful_shutdown(async { shutdown_rx.await.ok(); })
                    .await
                    .ok();
                println!("[api_server] shutdown, restarting...");
            }
            Err(e) => {
                eprintln!("[api_server] bind {} failed: {}", addr, e);
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  Middleware – request logging + rate limiting
// ═══════════════════════════════════════════════════════════

async fn request_logger(
    State(state): State<ApiState>,
    req: Request<axum::body::Body>,
    next: middleware::Next,
) -> Result<impl IntoResponse, (StatusCode, &'static str)> {
    // Rate limiting --------------------------------------------------
    // Server binds to 127.0.0.1 only — no external IPs, no spoofing risk
    let ip = "127.0.0.1".to_string();

    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    {
        let mut map = state.rate_map.lock().unwrap_or_else(|e| {
            eprintln!("[api_server] rate_map lock poisoned: {:?}", e);
            std::process::abort()
        });
        let entries = map.entry(ip).or_default();
        entries.retain(|&t| now_secs - t < 60);
        if entries.len() >= 100 {
            return Err((StatusCode::TOO_MANY_REQUESTS, "rate limit exceeded"));
        }
        entries.push(now_secs);
    }

    // Request logging ------------------------------------------------
    let start = Instant::now();
    let method = req.method().to_string();
    let path = req.uri().path().to_string();
    let query = req
        .uri()
        .query()
        .map(|q| format!("?{}", q))
        .unwrap_or_default();
    let full_path = format!("{}{}", path, query);

    let response = next.run(req).await;
    let status = response.status().as_u16();
    let duration_ms = start.elapsed().as_millis() as u64;

    {
        let mut log = state.request_log.lock().unwrap_or_else(|e| {
            eprintln!("[api_server] request_log lock poisoned: {:?}", e);
            std::process::abort()
        });
        log.push(RequestLogEntry {
            method,
            path: full_path,
            status,
            timestamp_ms: now_secs * 1000,
            duration_ms,
        });
        let len = log.len();
        if len > 200 {
            *log = log.split_off(len - 100);
        }
    }

    Ok(response)
}

// ═══════════════════════════════════════════════════════════
//  Auth helper
// ═══════════════════════════════════════════════════════════

fn check_auth(headers: &HeaderMap, state: &ApiState) -> Result<(), (StatusCode, &'static str)> {
    let val = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = format!("Bearer {}", state.token.get());
    if val == expected {
        Ok(())
    } else {
        Err((StatusCode::UNAUTHORIZED, "unauthorized"))
    }
}

// ═══════════════════════════════════════════════════════════
//  Route handlers
// ═══════════════════════════════════════════════════════════

// ---------- /api/health ----------

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "version": "0.3.0" }))
}

// ---------- /api/token ----------

async fn get_token(State(state): State<ApiState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "token": state.token.get() }))
}

// ---------- /api/project?projectId=... ----------

async fn get_project(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let row = if let Some(pid) = params.get("projectId") {
        conn.query_row(
            "SELECT id, name, data, phraseCount FROM Project WHERE id = ?1",
            rusqlite::params![pid],
            |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let data_str: String = row.get(2)?;
                let phrase_count: i64 = row.get(3)?;
                Ok((id, name, data_str, phrase_count))
            },
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?
    } else {
        eprintln!("[api_server] WARNING: get_project called without projectId, using latest project. This is deprecated. Please pass projectId query parameter.");
        conn.query_row(
            "SELECT id, name, data, phraseCount FROM Project ORDER BY updatedAt DESC LIMIT 1",
            [],
            |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let data_str: String = row.get(2)?;
                let phrase_count: i64 = row.get(3)?;
                Ok((id, name, data_str, phrase_count))
            },
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "no project"))?
    };

    let (id, name, data_str, phrase_count) = row;
    let data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;

    let group_count = data
        .get("groups")
        .and_then(|v| v.as_str())
        .and_then(|s| {
            serde_json::from_str::<Vec<serde_json::Value>>(s)
                .map_err(|e| eprintln!("[api_server] corrupt groups JSON in get_project: {}", e))
                .ok()
        })
        .map(|v| v.len())
        .unwrap_or(0);

    Ok(Json(serde_json::json!({
        "id": id,
        "name": name,
        "groupCount": group_count,
        "phraseCount": phrase_count,
    })))
}

// ---------- /api/groups?projectId=... ----------

async fn get_groups(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let data_str: String = if let Some(pid) = params.get("projectId") {
        conn.query_row(
            "SELECT data FROM Project WHERE id = ?1",
            rusqlite::params![pid],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?
    } else {
        eprintln!("[api_server] WARNING: get_groups called without projectId, using latest project. This is deprecated. Please pass projectId query parameter.");
        conn.query_row(
            "SELECT data FROM Project ORDER BY updatedAt DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "no project"))?
    };

    let data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;
    let raw = data.get("groups").and_then(|v| v.as_str()).unwrap_or_else(|| {
        eprintln!("[api_server] missing groups field in get_groups");
        "[]"
    });
    let groups: Vec<serde_json::Value> = serde_json::from_str(raw)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt groups data"))?;

    Ok(Json(serde_json::json!(groups)))
}

// ---------- GET /api/phrases?groupId=...&projectId=... ----------

async fn get_phrases(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let data_str: String = if let Some(pid) = params.get("projectId") {
        conn.query_row(
            "SELECT data FROM Project WHERE id = ?1",
            rusqlite::params![pid],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?
    } else {
        eprintln!("[api_server] WARNING: get_phrases called without projectId, using latest project. This is deprecated and will be removed. Please pass projectId query parameter.");
        conn.query_row(
            "SELECT data FROM Project ORDER BY updatedAt DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "no project"))?
    };

    let data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;
    let raw = data.get("phrases").and_then(|v| v.as_str()).unwrap_or_else(|| {
        eprintln!("[api_server] missing phrases field in get_phrases");
        "[]"
    });
    let phrases: Vec<serde_json::Value> = serde_json::from_str(raw)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt phrases data"))?;

    let result = if let Some(gid) = params.get("groupId") {
        phrases
            .into_iter()
            .filter(|p| p.get("groupId").and_then(|v| v.as_str()) == Some(gid.as_str()))
            .collect::<Vec<_>>()
    } else {
        phrases
    };

    Ok(Json(serde_json::json!(result)))
}

// ---------- POST /api/phrases ----------

#[derive(Deserialize)]
struct AddPhrasesReq {
    #[serde(rename = "projectId")]
    project_id: String,
    phrases: Vec<String>,
}

async fn add_phrases(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<AddPhrasesReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let data_str: String = conn
        .query_row(
            "SELECT data FROM Project WHERE id = ?1",
            rusqlite::params![body.project_id],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?;

    let mut data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;

    // pick first non-trash group
    let group_id = pick_group_id(&data, &body.project_id);
    let mut phrases = parse_phrases_vec(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt phrases data"))?;

    let now = chrono::Utc::now().timestamp_millis();
    let texts: Vec<String> = body.phrases.into_iter().map(|t| t.trim().to_string()).collect();

    for t in &texts {
        phrases.push(serde_json::json!({
            "id": Uuid::new_v4().to_string(),
            "text": t,
            "groupId": group_id,
            "createdAt": now,
        }));
    }

    let encoded = serde_json::to_string(&phrases)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;
    data["phrases"] = serde_json::Value::String(encoded);

    let new_data = serde_json::to_string(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;

    let count = phrases.len() as i64;
    conn.execute(
        "UPDATE Project SET data = ?1, phraseCount = ?2, updatedAt = ?3 WHERE id = ?4",
        rusqlite::params![new_data, count, now, body.project_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db write"))?;

    drop(conn);

    let _ = state.handle.emit(
        "store:phrases-updated",
        serde_json::json!({
            "action": "addPhrases",
            "payload": { "texts": texts, "groupId": group_id },
        }),
    );

    Ok(Json(serde_json::json!({ "added": texts.len(), "total": count })))
}

// ---------- DELETE /api/phrases ----------

#[derive(Deserialize)]
struct DeletePhrasesReq {
    ids: Vec<String>,
    #[serde(rename = "projectId")]
    project_id: String,
}

async fn delete_phrases(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<DeletePhrasesReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let data_str: String = conn
        .query_row(
            "SELECT data FROM Project WHERE id = ?1",
            rusqlite::params![body.project_id],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?;

    let mut data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;

    let mut phrases = parse_phrases_vec(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt phrases data"))?;
    let id_set: std::collections::HashSet<String> = body.ids.into_iter().collect();
    let before = phrases.len();
    phrases.retain(|p| {
        p.get("id")
            .and_then(|v| v.as_str())
            .map(|id| !id_set.contains(id))
            .unwrap_or_else(|| {
                eprintln!("[api_server] phrase missing id field in delete_phrases — removing");
                false
            })
    });
    let deleted = before - phrases.len();

    let encoded = serde_json::to_string(&phrases)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;
    data["phrases"] = serde_json::Value::String(encoded);

    let new_data = serde_json::to_string(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;

    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE Project SET data = ?1, phraseCount = ?2, updatedAt = ?3 WHERE id = ?4",
        rusqlite::params![new_data, phrases.len() as i64, now, body.project_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db write"))?;

    Ok(Json(serde_json::json!({ "deleted": deleted, "total": phrases.len() })))
}

// ---------- POST /api/frequency ----------

#[derive(Deserialize)]
struct FrequencyReq {
    #[serde(rename = "projectId")]
    project_id: String,
    frequencies: HashMap<String, i64>,
}

async fn update_frequency(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<FrequencyReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let data_str: String = conn
        .query_row(
            "SELECT data FROM Project WHERE id = ?1",
            rusqlite::params![body.project_id],
            |row| row.get(0),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?;

    let mut data: serde_json::Value = serde_json::from_str(&data_str)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt project data"))?;

    let mut phrases = parse_phrases_vec(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "corrupt phrases data"))?;
    let mut updates: Vec<serde_json::Value> = Vec::new();

    for p in &mut phrases {
        let text = p.get("text").and_then(|v| v.as_str()).unwrap_or_else(|| {
            eprintln!("[api_server] phrase missing text field in update_frequency");
            ""
        });
        if let Some(&freq) = body.frequencies.get(text) {
            p["frequency"] = serde_json::Value::Number(serde_json::Number::from(freq));
            updates.push(serde_json::json!({ "id": p["id"], "frequency": freq }));
        }
    }

    let encoded = serde_json::to_string(&phrases)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;
    data["phrases"] = serde_json::Value::String(encoded);

    let new_data = serde_json::to_string(&data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;

    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE Project SET data = ?1, updatedAt = ?2 WHERE id = ?3",
        rusqlite::params![new_data, now, body.project_id],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db write"))?;

    drop(conn);

    let _ = state.handle.emit(
        "store:phrases-updated",
        serde_json::json!({
            "action": "updateFrequencies",
            "payload": { "updates": updates },
        }),
    );

    Ok(Json(serde_json::json!({ "updated": updates.len() })))
}

// ---------- POST /api/snapshot ----------

#[derive(Deserialize)]
struct SnapshotReq {
    #[serde(default)]
    label: Option<String>,
    #[serde(rename = "projectId", default)]
    project_id: Option<String>,
}

async fn create_snapshot(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<SnapshotReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;

    let db = state.handle.state::<DbState>();
    let conn = db.conn.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "lock"))?;

    let (pid, name, data_str, phrase_count): (String, String, String, i64) = if let Some(ref pid) = body.project_id {
        conn.query_row(
            "SELECT id, name, data, phraseCount FROM Project WHERE id = ?1",
            rusqlite::params![pid],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "project not found"))?
    } else {
        eprintln!("[api_server] WARNING: create_snapshot called without projectId, using latest project. This is deprecated. Please pass projectId in request body.");
        conn.query_row(
            "SELECT id, name, data, phraseCount FROM Project ORDER BY updatedAt DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| (StatusCode::NOT_FOUND, "no project"))?
    };

    let now = chrono::Utc::now().timestamp_millis();
    let snapshot_id = Uuid::new_v4().to_string();

    // Build snapshot metadata embedded in the data field
    let snapshot_data = serde_json::json!({
        "label": body.label.unwrap_or_default(),
        "auto": false,
        "phraseCount": phrase_count,
        "projectName": name,
        "originalData": data_str,
    });

    let snapshot_str = serde_json::to_string(&snapshot_data)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "serialize"))?;

    let checksum = crate::compute_sha256(&data_str);

    conn.execute(
        "INSERT INTO ProjectBackup (id, parentId, data, checksum, createdAt) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![snapshot_id, pid, snapshot_str, checksum, now],
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "db write"))?;

    Ok(Json(serde_json::json!({
        "id": snapshot_id,
        "createdAt": now,
        "projectId": pid,
    })))
}

// ---------- GET /api/log ---------- FIX-B-3: auth required

async fn get_log(
    State(state): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<RequestLogEntry>>, (StatusCode, &'static str)> {
    check_auth(&headers, &state)?;
    let log = state.request_log.lock().map(|g| g.clone()).unwrap_or_else(|e| {
        eprintln!("[api_server] request_log lock poisoned in get_log: {:?}", e);
        Vec::new()
    });
    Ok(Json(log.into_iter().rev().take(100).collect()))
}

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════

fn pick_group_id(data: &serde_json::Value, fallback: &str) -> String {
    let raw = data.get("groups").and_then(|v| v.as_str()).unwrap_or_else(|| {
        eprintln!("[api_server] missing groups field in get_groups");
        "[]"
    });
    let groups: Vec<serde_json::Value> = match serde_json::from_str(raw) {
        Ok(g) => g,
        Err(_) => return fallback.to_owned(),
    };
    groups
        .iter()
        .find(|g| !g.get("isTrash").and_then(|v| v.as_bool()).unwrap_or(false))
        .and_then(|g| g.get("id").and_then(|v| v.as_str()))
        .map(|s| s.to_owned())
        .unwrap_or_else(|| fallback.to_owned())
}

fn parse_phrases_vec(data: &serde_json::Value) -> Result<Vec<serde_json::Value>, serde_json::Error> {
    let raw = data.get("phrases").and_then(|v| v.as_str()).unwrap_or_else(|| {
        eprintln!("[api_server] missing phrases field in get_phrases");
        "[]"
    });
    serde_json::from_str(raw)
}
