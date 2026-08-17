use notify::event::ModifyKind;
use notify::{EventKind, Watcher};
use reqwest::Client;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

struct AppState {
    client: Client,
    db: Mutex<Option<Connection>>,
    vault_path: Mutex<Option<String>>,
    server_url: Mutex<Option<String>>,
    token: Mutex<Option<String>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
    sync_loop_id: Mutex<u64>,
    syncing: AtomicBool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ManifestItem {
    pub path: String,
    pub hash: Option<String>,
    pub mtime: Option<i64>,
    pub size: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ManifestResponse {
    pub files: Vec<ManifestItem>,
}

#[derive(Serialize)]
pub struct LocalFile {
    pub path: String,
    pub status: String,
}

fn compute_hash(path: &Path) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

fn safe_join(vault_root: &Path, rel_path: &str) -> Result<PathBuf, String> {
    let rel = Path::new(rel_path);
    if rel.is_absolute()
        || rel
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(format!("Rejected unsafe path from server: {}", rel_path));
    }
    Ok(vault_root.join(rel))
}

#[tauri::command]
fn init_db(
    app_handle: tauri::AppHandle,
    vault_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = PathBuf::from(&vault_path);
    if !path.exists() {
        return Err("Vault path does not exist".to_string());
    }

    let db_dir = path.join(".synap");
    if !db_dir.exists() {
        std::fs::create_dir_all(&db_dir)
            .map_err(|e| format!("Failed to create .synap dir: {}", e))?;
    }

    let db_path = db_dir.join("sync.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Failed to set PRAGMA: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_state (
            path TEXT PRIMARY KEY,
            local_hash TEXT,
            local_mtime INTEGER,
            remote_hash TEXT,
            remote_mtime INTEGER,
            status TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to initialize DB schema: {}", e))?;

    *state.db.lock().unwrap() = Some(conn);
    *state.vault_path.lock().unwrap() = Some(vault_path);

    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(&path, notify::RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Background thread for local file changes (notify)
    let app_clone = app_handle.clone();
    std::thread::spawn(move || {
        let mut pending = false;
        loop {
            match rx.recv_timeout(Duration::from_millis(500)) {
                Ok(Ok(event)) => {
                    if matches!(
                        event.kind,
                        EventKind::Modify(ModifyKind::Data(_)) | EventKind::Create(_)
                    ) {
                        pending = true;
                    }
                }
                Ok(Err(e)) => {
                    log::warn!("Watcher error: {}", e);
                }
                Err(RecvTimeoutError::Timeout) => {
                    if pending {
                        pending = false;

                        let state = app_clone.state::<AppState>();
                        let url = state.server_url.lock().unwrap().clone();
                        let token = state.token.lock().unwrap().clone();

                        if let (Some(u), Some(t)) = (url, token) {
                            let app_clone_async = app_clone.clone();
                            tauri::async_runtime::spawn(async move {
                                perform_sync(&app_clone_async, &u, &t).await.ok();
                                app_clone_async.emit("sync-done", ()).ok();
                            });
                        }
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    *state.watcher.lock().unwrap() = Some(watcher);

    Ok(())
}

/// Recursively scan vault directory for .md files, returning relative paths.
fn scan_local_md_files(vault_root: &Path) -> Vec<String> {
    let mut results = Vec::new();
    fn walk(dir: &Path, root: &Path, results: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip hidden directories (.synap, .git, etc.) and large build/dependency directories
                if name.starts_with('.')
                    || name == "node_modules"
                    || name == "target"
                    || name == "dist"
                {
                    continue;
                }
                if path.is_dir() {
                    walk(&path, root, results);
                } else if name.ends_with(".md")
                    && let Ok(rel) = path.strip_prefix(root)
                {
                    // Always use forward slashes for consistency
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    results.push(rel_str);
                }
            }
        }
    }
    walk(vault_root, vault_root, &mut results);
    results.sort();
    results
}

#[tauri::command]
fn get_local_files(state: State<'_, AppState>) -> Result<Vec<LocalFile>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault path set")?;
    let vault_root = PathBuf::from(&vault_path);
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("DB not initialized")?;

    // 1. Scan the actual filesystem for .md files
    let disk_files = scan_local_md_files(&vault_root);

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // 2. Register any new files (on disk but not in DB) with status 'local'
    // 3. Also update hashes for existing files that may have changed on disk
    for rel_path in &disk_files {
        let abs_path = vault_root.join(rel_path);
        let hash = match compute_hash(&abs_path) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("Failed to hash {}: {}", rel_path, e);
                continue;
            }
        };

        tx.execute(
            "INSERT OR IGNORE INTO sync_state (path, local_hash, local_mtime, remote_hash, remote_mtime, status) VALUES (?, ?, 0, NULL, 0, 'local')",
            params![rel_path, hash],
        ).ok();
        // Check if hash differs from what's in DB
        let db_hash: Option<String> = tx
            .query_row(
                "SELECT local_hash FROM sync_state WHERE path = ?",
                params![rel_path],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None)
            .unwrap_or(None);

        if let Some(ref stored_hash) = db_hash
            && stored_hash != &hash
        {
            tx.execute(
                "UPDATE sync_state SET local_hash = ?, status = 'modified' WHERE path = ?",
                params![hash, rel_path],
            )
            .ok();
        }
    }

    // 4. Mark files that are in DB but no longer on disk
    let mut stmt = tx
        .prepare("SELECT path FROM sync_state")
        .map_err(|e| e.to_string())?;
    let db_paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    for db_path in &db_paths {
        if !disk_files.contains(db_path) {
            tx.execute(
                "UPDATE sync_state SET status = 'deleted' WHERE path = ?",
                params![db_path],
            )
            .ok();
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // 5. Return the full merged list (skip 'deleted' entries for now)
    let mut out_stmt = conn
        .prepare("SELECT path, status FROM sync_state WHERE status != 'deleted'")
        .map_err(|e| e.to_string())?;
    let rows = out_stmt
        .query_map([], |row| {
            Ok(LocalFile {
                path: row.get(0)?,
                status: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    for file in rows.flatten() {
        files.push(file);
    }
    Ok(files)
}

// =======================
// SYNC ENGINE
// =======================

async fn fetch_manifest(
    client: &Client,
    url: &str,
    token: &str,
) -> Result<Vec<ManifestItem>, String> {
    let manifest_url = format!("{}/api/vault/manifest", url.trim_end_matches('/'));
    let res = client
        .get(&manifest_url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network Error: {}", e))?;
    let text = res.text().await.unwrap_or_default();

    match serde_json::from_str::<ManifestResponse>(&text) {
        Ok(wrapper) => Ok(wrapper.files),
        Err(_) => serde_json::from_str::<Vec<ManifestItem>>(&text)
            .map_err(|_| "Invalid Manifest".to_string()),
    }
}

pub async fn perform_sync(
    app_handle: &tauri::AppHandle,
    url: &str,
    token: &str,
) -> Result<(), String> {
    let state = app_handle.state::<AppState>();

    if state
        .syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let result = perform_sync_inner(app_handle, url, token).await;

    state.syncing.store(false, Ordering::SeqCst);
    result
}

struct PulledUpdate {
    path: String,
    new_hash: String,
    remote_hash: String,
}

struct PushedUpdate {
    path: String,
    hash: String,
}

async fn perform_sync_inner(
    app_handle: &tauri::AppHandle,
    url: &str,
    token: &str,
) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault path")?;
    let vault_root = PathBuf::from(&vault_path);

    // 1. Fetch manifest once; reused for pull, push & remote-delete detection
    let remote_files = fetch_manifest(&state.client, url, token).await?;

    // 2. Scan remote files & pull missing/changed ones
    let mut pulled_updates: Vec<PulledUpdate> = Vec::new();

    for remote in &remote_files {
        let rel_path = &remote.path;
        let remote_hash = remote.hash.clone().unwrap_or_default();

        let abs_path = match safe_join(&vault_root, rel_path) {
            Ok(p) => p,
            Err(e) => {
                log::warn!("{}", e);
                continue;
            }
        };

        let local_hash: Option<String> = {
            let db_guard = state.db.lock().unwrap();
            let conn = db_guard.as_ref().ok_or("DB not initialized")?;
            conn.query_row(
                "SELECT local_hash FROM sync_state WHERE path = ?",
                params![rel_path],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None)
            .unwrap_or(None)
        };

        if local_hash.as_deref() != Some(remote_hash.as_str()) {
            let pull_url = format!("{}/api/vault/sync/pull", url.trim_end_matches('/'));
            let payload = serde_json::json!({ "paths": vec![rel_path] });
            let pull_res = state
                .client
                .post(&pull_url)
                .header("Authorization", format!("Bearer {}", token))
                .json(&payload)
                .send()
                .await;

            if let Ok(pull_res) = pull_res
                && pull_res.status().is_success()
            {
                let p_text = pull_res.text().await.unwrap_or_default();
                if let Ok(wrapper) = serde_json::from_str::<PullResponseWrapper>(&p_text)
                    && let Some(item) = wrapper.files.into_iter().next()
                {
                    if let Some(parent) = abs_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    if let Err(e) = fs::write(&abs_path, item.content) {
                        log::warn!("Failed to write pulled file {}: {}", rel_path, e);
                        continue;
                    }

                    match compute_hash(&abs_path) {
                        Ok(new_hash) => pulled_updates.push(PulledUpdate {
                            path: rel_path.clone(),
                            new_hash,
                            remote_hash: remote_hash.clone(),
                        }),
                        Err(e) => log::warn!("Failed to hash pulled file {}: {}", rel_path, e),
                    }
                }
            }
        }
    }

    // Batch all pull-related DB writes into a single transaction
    if !pulled_updates.is_empty() {
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or("DB not initialized")?;
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for u in &pulled_updates {
            tx.execute(
                "INSERT OR REPLACE INTO sync_state (path, local_hash, local_mtime, remote_hash, remote_mtime, status) VALUES (?, ?, 0, ?, 0, 'Synced')",
                params![u.path, u.new_hash, u.remote_hash]
            ).ok();
        }

        tx.commit().map_err(|e| e.to_string()).ok();
    }

    // 3. Push local-only or modified files to the server
    let local_files = scan_local_md_files(&vault_root);

    let mut pushed_updates: Vec<PushedUpdate> = Vec::new();
    for rel_path in &local_files {
        let abs_path = vault_root.join(rel_path);
        let local_hash = match compute_hash(&abs_path) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("Failed to hash {}: {}", rel_path, e);
                continue;
            }
        };

        let db_status: Option<(String, Option<String>)> = {
            let db_guard = state.db.lock().unwrap();
            let conn = db_guard.as_ref().ok_or("DB not initialized")?;
            conn.query_row(
                "SELECT status, remote_hash FROM sync_state WHERE path = ?",
                params![rel_path],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .optional()
            .unwrap_or(None)
        };

        let should_push = match &db_status {
            None => true, // Not in DB at all
            Some((status, remote_hash)) => {
                status == "local"
                    || status == "modified"
                    || status == "PendingUpload"
                    || remote_hash.as_deref() != Some(&local_hash)
            }
        };

        if should_push && let Ok(content) = fs::read_to_string(&abs_path) {
            let push_url = format!("{}/api/vault/sync/push", url.trim_end_matches('/'));
            let payload = serde_json::json!({
                "files": [{ "path": rel_path, "content": content }]
            });
            let push_res = state
                .client
                .post(&push_url)
                .header("Authorization", format!("Bearer {}", token))
                .json(&payload)
                .send()
                .await;
            if let Ok(push_res) = push_res
                && push_res.status().is_success()
            {
                pushed_updates.push(PushedUpdate {
                    path: rel_path.clone(),
                    hash: local_hash,
                });
            }
        }
    }

    if !pushed_updates.is_empty() {
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or("DB not initialized")?;
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for u in &pushed_updates {
            tx.execute(
                "INSERT OR REPLACE INTO sync_state (path, local_hash, local_mtime, remote_hash, remote_mtime, status) VALUES (?, ?, 0, ?, 0, 'Synced')",
                params![u.path, u.hash, u.hash]
            ).ok();
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn sync_now(app_handle: tauri::AppHandle, url: String, token: String) -> Result<(), String> {
    perform_sync(&app_handle, &url, &token).await
}

#[tauri::command]
async fn start_background_sync(
    app_handle: tauri::AppHandle,
    url: String,
    token: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    *state.server_url.lock().unwrap() = Some(url.clone());
    *state.token.lock().unwrap() = Some(token.clone());

    let current_id = {
        let mut id_guard = state.sync_loop_id.lock().unwrap();
        *id_guard += 1;
        *id_guard
    };

    let app_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(10));
        loop {
            interval.tick().await;

            let is_active = {
                let state = app_clone.state::<AppState>();
                let id = *state.sync_loop_id.lock().unwrap();
                id == current_id
            };

            if !is_active {
                break;
            }

            let _ = perform_sync(&app_clone, &url, &token).await;
            let _ = app_clone.emit("sync-done", ());
        }
    });

    Ok(())
}

#[tauri::command]
async fn wipe_sync_db(state: State<'_, AppState>) -> Result<(), String> {
    let vault_path = {
        let guard = state.vault_path.lock().unwrap();
        guard.clone()
    };

    if let Some(path_str) = vault_path {
        let db_path = PathBuf::from(&path_str).join(".synap").join("sync.db");

        // 1. Close DB connection
        {
            let mut db_guard = state.db.lock().unwrap();
            *db_guard = None;
        }

        // 2. Delete file
        if db_path.exists() {
            fs::remove_file(&db_path).map_err(|e| format!("Failed to delete DB: {}", e))?;
        }
    }

    // Clear state
    *state.vault_path.lock().unwrap() = None;
    *state.server_url.lock().unwrap() = None;
    *state.token.lock().unwrap() = None;

    // Stop watcher if exists
    *state.watcher.lock().unwrap() = None;

    // Kill any background sync loops
    stop_background_sync(state).await.ok();

    Ok(())
}

#[tauri::command]
async fn stop_background_sync(state: State<'_, AppState>) -> Result<(), String> {
    *state.sync_loop_id.lock().unwrap() += 1;
    Ok(())
}

#[tauri::command]
async fn open_sticky(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let label = format!("sticky-{}", timestamp);
    let safe_path = path
        .replace("&", "%26")
        .replace("#", "%23")
        .replace("?", "%3F");
    let url = WebviewUrl::App(format!("/?sticky=true&file={}", safe_path).into());

    match WebviewWindowBuilder::new(&app_handle, label, url)
        .title(format!("Sticky: {}", path))
        .inner_size(350.0, 450.0)
        .always_on_top(true)
        .decorations(false)
        .build()
    {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}
impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

// ... Original Push/Pull Fallbacks ...
#[derive(Serialize, Deserialize, Debug)]
pub struct PullResponseItem {
    pub path: Option<String>,
    pub content: String,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct PullResponseWrapper {
    pub files: Vec<PullResponseItem>,
}

#[tauri::command]
async fn pull_file(
    _url: String,
    _token: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vault_path = state.vault_path.lock().unwrap().clone().unwrap_or_default();
    let abs_path = safe_join(&PathBuf::from(vault_path), &path)?;

    // Read from local disk first in Phase 1
    if abs_path.exists()
        && let Ok(content) = fs::read_to_string(&abs_path)
    {
        return Ok(content);
    }
    Err("File not found locally. Run sync first.".into())
}

#[derive(Deserialize)]
struct PushResponse {
    successes: Vec<serde_json::Value>,
    conflicts: Vec<serde_json::Value>,
    errors: Vec<serde_json::Value>,
}

#[tauri::command]
async fn push_file(
    app_handle: tauri::AppHandle,
    url: String,
    token: String,
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault_path = state.vault_path.lock().unwrap().clone().unwrap_or_default();
    let abs_path = safe_join(&PathBuf::from(vault_path), &path)?;

    // Save to local disk
    if let Some(parent) = abs_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&abs_path, &content).map_err(|e| format!("Disk error: {}", e))?;

    // Update local DB to PendingUpload
    let new_hash = compute_hash(&abs_path).map_err(|e| format!("Hash error: {}", e))?;
    {
        let db_guard = state.db.lock().unwrap();
        if let Some(conn) = db_guard.as_ref() {
            let _ = conn.execute(
                "UPDATE sync_state SET local_hash = ?, status = 'PendingUpload' WHERE path = ?",
                params![new_hash, &path],
            );
        }
    }

    let push_url = format!("{}/api/vault/sync/push", url.trim_end_matches('/'));
    let payload = serde_json::json!({
        "files": [
            {
                "path": &path,
                "content": content
            }
        ]
    });

    let res = state
        .client
        .post(&push_url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if status.is_success() {
        if let Ok(parsed) = serde_json::from_str::<PushResponse>(&text) {
            if !parsed.errors.is_empty() {
                return Err(format!("Server Error: {:?}", parsed.errors));
            }
            if !parsed.conflicts.is_empty() {
                use tauri_plugin_notification::NotificationExt;
                let _ = app_handle
                    .notification()
                    .builder()
                    .title("Sync-Konflikt erkannt")
                    .body(format!(
                        "Es gab {} Konflikt(e) beim Synchronisieren.",
                        parsed.conflicts.len()
                    ))
                    .show();
                return Err(format!("Server Conflict: {:?}", parsed.conflicts));
            }
            if parsed.successes.is_empty() {
                return Err("Server returned empty successes.".to_string());
            }
        } else {
            // Nuxt fallback
            if text.contains("\"error\":") || text.contains("\"error\":true") {
                return Err(format!("Server reported error: {}", text));
            }
        }

        let db_guard = state.db.lock().unwrap();
        if let Some(conn) = db_guard.as_ref() {
            let _ = conn.execute(
                "UPDATE sync_state SET status = 'Synced', remote_hash = ? WHERE path = ?",
                params![new_hash, path],
            );
        }
        Ok(())
    } else {
        Err(format!("HTTP Error {}: {}", status, text))
    }
}

#[tauri::command]
fn set_secure_token(token: String) -> Result<(), String> {
    let entry = keyring::Entry::new("synap_desktop", "auth_token").map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_secure_token() -> Result<String, String> {
    let entry = keyring::Entry::new("synap_desktop", "auth_token").map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_secure_token() -> Result<(), String> {
    let entry = keyring::Entry::new("synap_desktop", "auth_token").map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            client: Client::new(),
            db: Mutex::new(None),
            vault_path: Mutex::new(None),
            server_url: Mutex::new(None),
            token: Mutex::new(None),
            watcher: Mutex::new(None),
            sync_loop_id: Mutex::new(0),
            syncing: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            init_db,
            get_local_files,
            sync_now,
            start_background_sync,
            stop_background_sync,
            pull_file,
            push_file,
            wipe_sync_db,
            open_sticky,
            set_secure_token,
            get_secure_token,
            delete_secure_token
        ])
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};

            let show_i = MenuItem::with_id(app, "show", "Anzeigen", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let icon = app.default_window_icon().cloned().unwrap();
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button,
                        button_state,
                        ..
                    } = event
                        && button == MouseButton::Left
                        && button_state == MouseButtonState::Up
                        && let Some(window) = tray.app_handle().get_webview_window("main")
                    {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                })
                .build(app)?;

            // Run in background when closing window
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = window_clone.hide();
                        api.prevent_close();
                    }
                });
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
