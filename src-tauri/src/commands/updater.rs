use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
struct UpdaterManifest {
    version: String,
    notes: Option<String>,
    pub_date: Option<String>,
    platforms: std::collections::HashMap<String, PlatformEntry>,
}

#[derive(Deserialize)]
struct PlatformEntry {
    signature: Option<String>,
    url: String,
}

#[derive(Serialize)]
pub struct LocalUpdateInfo {
    pub version: String,
    pub notes: String,
    pub installer_path: String,
}

fn parse_version(v: &str) -> Vec<u32> {
    v.trim_start_matches('v')
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect()
}

fn is_newer(local: &str, current: &str) -> bool {
    let lv = parse_version(local);
    let cv = parse_version(current);
    lv > cv
}

fn get_default_updater_paths() -> Vec<String> {
    let mut paths = Vec::new();

    // 1. Same directory as the executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            paths.push(exe_dir.join("updater.json").to_string_lossy().to_string());
        }
    }

    // 2. Hardcoded dev path
    paths.push("D:\\Projeto Fluxcodex\\ai-app-builder\\updater.json".into());

    // 3. Working directory
    paths.push("./updater.json".into());

    paths
}

fn get_resource_updater_path(app: &AppHandle) -> Option<String> {
    let path = app
        .path()
        .resolve("updater.json", tauri::path::BaseDirectory::Resource)
        .ok()?;

    Some(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn check_local_update(app: AppHandle) -> Result<Option<LocalUpdateInfo>, String> {
    let current_version = env!("CARGO_PKG_VERSION");

    let mut paths = get_default_updater_paths();
    if let Some(resource_path) = get_resource_updater_path(&app) {
        paths.insert(0, resource_path);
    }

    for path in paths {
        if !std::path::Path::new(&path).exists() {
            continue;
        }

        let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
        let manifest: UpdaterManifest =
            serde_json::from_str(&content).map_err(|e| format!("Invalid updater.json: {}", e))?;

        if !is_newer(&manifest.version, current_version) {
            continue;
        }

        let win_key = manifest
            .platforms
            .keys()
            .find(|k| k.contains("windows"))
            .ok_or_else(|| "No windows platform entry in updater.json".to_string())?;

        let entry = &manifest.platforms[win_key];

        let installer_path = entry
            .url
            .trim_start_matches("file:///")
            .to_string();

        return Ok(Some(LocalUpdateInfo {
            version: manifest.version,
            notes: manifest.notes.unwrap_or_default(),
            installer_path,
        }));
    }

    Ok(None)
}

#[tauri::command]
pub fn install_update(path: String) -> Result<(), String> {
    let installer_path = path.trim_start_matches("file:///").to_string();

    std::process::Command::new(&installer_path)
        .args(["/S", "/RUN"]) // NSIS: silent + launch after install
        .spawn()
        .map_err(|e| format!("Falha ao iniciar instalador: {}", e))?;

    // Exit immediately — the installer runs independently and will launch the new version
    std::process::exit(0);
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
