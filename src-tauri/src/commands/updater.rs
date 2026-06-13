use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const GH_OWNER: &str = "walacesssantos-TCX";
const GH_REPO: &str = "ai-app-builder";

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

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
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

fn resolve_installer_path(raw: &str) -> String {
    let without_prefix = raw.trim_start_matches("file:///");
    let decoded = urlencoding_decode(without_prefix);
    decoded.replace('/', "\\")
}

fn strip_bom(s: &str) -> &str {
    s.strip_prefix('\u{feff}').unwrap_or(s)
}

fn urlencoding_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                    continue;
                }
            }
            // invalid percent sequence — push raw chars
            result.push('%');
            result.push_str(&hex);
            continue;
        }
        result.push(c);
    }
    result
}

fn get_default_updater_paths() -> Vec<String> {
    let mut paths = Vec::new();
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            paths.push(exe_dir.join("updater.json").to_string_lossy().to_string());
        }
    }
    paths.push("D:\\Projeto Fluxcodex\\ai-app-builder\\updater.json".into());
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

    // 1. Check local paths
    let mut paths = get_default_updater_paths();
    if let Some(resource_path) = get_resource_updater_path(&app) {
        paths.insert(0, resource_path);
    }

    for path in paths {
        if !std::path::Path::new(&path).exists() {
            continue;
        }

        let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
        let content = strip_bom(&content);
        let manifest: UpdaterManifest =
            serde_json::from_str(content).map_err(|e| format!("Invalid updater.json: {}", e))?;

        if !is_newer(&manifest.version, current_version) {
            continue;
        }

        let win_key_option = manifest
            .platforms
            .keys()
            .find(|k| k.contains("windows"));

        if win_key_option.is_none() {
            continue;
        }

        let entry = &manifest.platforms[win_key_option.unwrap()];
        let installer_path = if entry.url.starts_with("http://") || entry.url.starts_with("https://") {
            entry.url.clone()
        } else {
            resolve_installer_path(&entry.url)
        };

        return Ok(Some(LocalUpdateInfo {
            version: manifest.version,
            notes: manifest.notes.unwrap_or_default(),
            installer_path,
        }));
    }

    // 2. Check GitHub releases
    match check_github_release(current_version) {
        Ok(Some(info)) => return Ok(Some(info)),
        Ok(None) => {}
        Err(e) => eprintln!("[updater] GitHub check failed: {}", e),
    }

    Ok(None)
}

fn check_github_release(current: &str) -> Result<Option<LocalUpdateInfo>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        GH_OWNER, GH_REPO
    );

    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-app-builder-updater")
        .connect_timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client.get(&url).send().map_err(|e| format!("HTTP error: {}", e))?;
    if !resp.status().is_success() {
        return Ok(None);
    }

    let release: GithubRelease = resp.json().map_err(|e| format!("JSON parse error: {}", e))?;

    let tag_version = release.tag_name.trim_start_matches('v');
    if !is_newer(tag_version, current) {
        return Ok(None);
    }

    // Find the NSIS installer asset
    let installer = release.assets.iter().find(|a| a.name.ends_with("-setup.exe"));
    let url = match installer {
        Some(a) => a.browser_download_url.clone(),
        None => {
            // fallback: construct the URL from tag
            format!(
                "https://github.com/{}/{}/releases/download/{}/AI.App.Builder.Studio_{}_x64-setup.exe",
                GH_OWNER, GH_REPO, release.tag_name, tag_version
            )
        }
    };

    Ok(Some(LocalUpdateInfo {
        version: tag_version.to_string(),
        notes: release.body.unwrap_or_default(),
        installer_path: url,
    }))
}

#[tauri::command]
pub fn install_update(path: String) -> Result<(), String> {
    // If path is a URL, download it first
    let installer_path = if path.starts_with("http://") || path.starts_with("https://") {
        let client = reqwest::blocking::Client::builder()
            .user_agent("ai-app-builder-updater")
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let resp = client
            .get(&path)
            .send()
            .map_err(|e| format!("Failed to download: {}", e))?;

        let temp_dir = std::env::temp_dir().join("ai-app-builder-update");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

        // Extract filename from URL
        let filename = path.rsplit('/').next().unwrap_or("installer.exe");
        let dest = temp_dir.join(filename);

        let bytes = resp.bytes().map_err(|e| format!("Failed to read response: {}", e))?;
        fs::write(&dest, &bytes).map_err(|e| format!("Failed to write installer: {}", e))?;

        dest.to_string_lossy().to_string()
    } else {
        resolve_installer_path(&path)
    };

    let p = PathBuf::from(&installer_path);
    if !p.exists() {
        return Err(format!("Instalador não encontrado: {}", installer_path));
    }

    // Write a cleanup script that runs after this process exits
    let script_dir = std::env::temp_dir().join("ai-app-builder-update");
    fs::create_dir_all(&script_dir).ok();
    let script_path = script_dir.join("install_update.bat");

    let app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".to_string());
    let install_dir = format!("{}\\AI App Builder Studio", app_data);

    let script_content = format!(
        "@echo off\r\n\
        title Instalando atualizacao...\r\n\
        echo Fechando processos...\r\n\
        taskkill /f /t /im node.exe >nul 2>&1\r\n\
        taskkill /f /t /im ai-app-builder.exe >nul 2>&1\r\n\
        timeout /t 3 /nobreak >nul\r\n\
        \r\n\
        echo Removendo arquivos travados...\r\n\
        if exist \"{install_dir}\\_up_\\sidecar\\node_modules\\.prisma\" (\r\n\
          rmdir /s /q \"{install_dir}\\_up_\\sidecar\\node_modules\\.prisma\" >nul 2>&1\r\n\
        )\r\n\
        if exist \"{install_dir}\\_up_\" (\r\n\
          rmdir /s /q \"{install_dir}\\_up_\" >nul 2>&1\r\n\
        )\r\n\
        \r\n\
        echo Instalando...\r\n\
        start \"\" /wait \"{installer_path}\" /S /RUN\r\n\
        \r\n\
        echo Concluido!\r\n\
        del \"%~f0\" >nul 2>&1\r\n\
        ",
        install_dir = install_dir,
        installer_path = installer_path
    );

    fs::write(&script_path, &script_content)
        .map_err(|e| format!("Failed to write update script: {}", e))?;

    // Launch the cleanup script detached from this process
    std::process::Command::new("cmd")
        .args(["/c", "start", "/b", "", &script_path.to_string_lossy().to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar script de atualização: {}", e))?;

    std::process::exit(0);
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
