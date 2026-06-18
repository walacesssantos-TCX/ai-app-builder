use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::io::Write;
use tauri::{AppHandle, Manager};

const GH_OWNER: &str = "walacesssantos-TCX";
const GH_REPO: &str = "ai-app-builder";

#[derive(Deserialize)]
struct UpdaterManifest {
    version: String,
    notes: Option<String>,
    platforms: std::collections::HashMap<String, PlatformEntry>,
}

#[derive(Deserialize)]
struct PlatformEntry {
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

fn is_newer(candidate: &str, current: &str) -> bool {
    parse_version(candidate) > parse_version(current)
}

fn strip_bom(s: &str) -> &str {
    s.strip_prefix('\u{feff}').unwrap_or(s)
}

fn log_updater(msg: &str) {
    let log_path = std::env::temp_dir().join("aibuilder-updater.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "{}", msg);
    }
}

fn is_url_accessible(url: &str) -> bool {
    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-app-builder-updater")
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(10))
        .build();
    match client {
        Ok(c) => match c.head(url).send() {
            Ok(resp) => resp.status().as_u16() < 400,
            Err(_) => false,
        },
        Err(_) => false,
    }
}

fn check_github_release(current: &str) -> Result<Option<LocalUpdateInfo>, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        GH_OWNER, GH_REPO
    );

    log_updater(&format!("Checking GitHub: current={} url={}", current, url));

    let client = reqwest::blocking::Client::builder()
        .user_agent("ai-app-builder-updater")
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client.get(&url).send().map_err(|e| {
        let msg = format!("HTTP error: {}", e);
        log_updater(&msg);
        msg
    })?;

    if !resp.status().is_success() {
        log_updater(&format!("GitHub returned HTTP {}", resp.status()));
        return Ok(None);
    }

    let release: GithubRelease = resp.json().map_err(|e| format!("JSON parse error: {}", e))?;
    let tag_version = release.tag_name.trim_start_matches('v');

    if !is_newer(tag_version, current) {
        log_updater(&format!("GitHub latest={} not newer than current={}", tag_version, current));
        return Ok(None);
    }

    log_updater(&format!("Update found: v{}", tag_version));

    // Find Linux .deb asset
    let installer = release.assets.iter().find(|a| a.name.ends_with("_amd64.deb"))
        .or_else(|| release.assets.iter().find(|a| a.name.contains(tag_version) && a.name.ends_with(".deb")));

    let url = match installer {
        Some(a) => a.browser_download_url.clone(),
        None => {
            log_updater(&format!("No .deb asset found in release {} — skipping", tag_version));
            return Ok(None);
        }
    };

    Ok(Some(LocalUpdateInfo {
        version: tag_version.to_string(),
        notes: release.body.unwrap_or_default(),
        installer_path: url,
    }))
}

fn get_resource_updater_path(app: &AppHandle) -> Option<String> {
    let path = app
        .path()
        .resolve("updater.json", tauri::path::BaseDirectory::Resource)
        .ok()?;
    Some(path.to_string_lossy().to_string())
}

fn get_default_updater_paths() -> Vec<String> {
    let mut paths = Vec::new();
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            paths.push(exe_dir.join("updater.json").to_string_lossy().to_string());
        }
    }
    if cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            paths.push(cwd.join("updater.json").to_string_lossy().to_string());
        }
    }
    paths.push("./updater.json".into());
    paths
}

#[tauri::command]
pub fn check_local_update(app: AppHandle) -> Result<Option<LocalUpdateInfo>, String> {
    let current_version = env!("CARGO_PKG_VERSION");

    // 1. GitHub releases (primary)
    match check_github_release(current_version) {
        Ok(Some(info)) => return Ok(Some(info)),
        Ok(None) => log_updater("GitHub returned no newer version"),
        Err(e) => log_updater(&format!("GitHub check error: {}", e)),
    }

    // 2. Fallback: bundled updater.json
    let mut paths = get_default_updater_paths();
    if let Some(resource_path) = get_resource_updater_path(&app) {
        paths.insert(0, resource_path);
    }

    for path in paths {
        if !std::path::Path::new(&path).exists() {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let manifest: UpdaterManifest = match serde_json::from_str(strip_bom(&content)) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !is_newer(&manifest.version, current_version) {
            continue;
        }
        let entry = match manifest.platforms.get("linux-x86_64") {
            Some(e) => e,
            None => continue,
        };
        if !is_url_accessible(&entry.url) {
            log_updater(&format!("Installer URL not accessible — skipping: {}", entry.url));
            continue;
        }
        return Ok(Some(LocalUpdateInfo {
            version: manifest.version,
            notes: manifest.notes.unwrap_or_default(),
            installer_path: entry.url.clone(),
        }));
    }

    Ok(None)
}

#[tauri::command]
pub fn install_update(path: String) -> Result<String, String> {
    let installer_path = if path.starts_with("http://") || path.starts_with("https://") {
        let temp_dir = std::env::temp_dir().join("ai-app-builder-update");
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Falha ao criar diretório temporário: {}", e))?;

        let filename = path.rsplit('/').next().unwrap_or("installer.deb");
        let dest = temp_dir.join(filename);

        let status = std::process::Command::new("curl")
            .args([
                "-sL",
                "--fail",
                "--max-time", "300",
                "-o", &dest.to_string_lossy().to_string(),
                &path,
            ])
            .status()
            .map_err(|e| format!("curl não encontrado: {}", e))?;

        if !status.success() {
            return Err("Falha ao baixar atualização (curl falhou — verifique a conexão)".to_string());
        }

        dest.to_string_lossy().to_string()
    } else {
        path.clone()
    };

    let p = PathBuf::from(&installer_path);
    if !p.exists() {
        return Err(format!("Instalador não encontrado: {}", installer_path));
    }

    Ok(installer_path)
}

#[tauri::command]
pub fn run_installer(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Instalador não encontrado: {}", path));
    }

    // Kill sidecar before install to unlock files
    let _ = std::process::Command::new("pkill")
        .args(["-f", "node.*sidecar"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    let _ = std::process::Command::new("pkill")
        .args(["-f", "tsx.*index.ts"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();

    std::thread::sleep(std::time::Duration::from_secs(2));

    // Try apt-get install first (resolves deps), fall back to dpkg -i
    let apt_result = std::process::Command::new("pkexec")
        .args(["apt-get", "install", "-y", &path])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    let success = match apt_result {
        Ok(s) if s.success() => true,
        _ => {
            let s = std::process::Command::new("pkexec")
                .args(["dpkg", "-i", &path])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .map_err(|e| format!("Falha ao executar instalador: {}", e))?;
            s.success()
        }
    };

    if !success {
        return Err("Instalação falhou. Tente manualmente: sudo dpkg -i <arquivo>.deb".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
