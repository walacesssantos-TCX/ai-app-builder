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
    if cfg!(debug_assertions) {
        paths.push("D:\\Projeto Fluxcodex\\ai-app-builder\\updater.json".into());
    }
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

    // 1. GitHub releases first (primary source)
    match check_github_release(current_version) {
        Ok(Some(info)) => return Ok(Some(info)),
        Ok(None) => {}
        Err(e) => eprintln!("[updater] GitHub check failed: {}", e),
    }

    // 2. Fallback: local updater.json files (dev/test)
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
        let content = strip_bom(&content);
        let manifest: UpdaterManifest = match serde_json::from_str(content) {
            Ok(m) => m,
            Err(_) => continue,
        };

        if !is_newer(&manifest.version, current_version) {
            continue;
        }

        let win_key_option = manifest
            .platforms
            .keys()
            .find(|k| k.contains("windows"));

        let win_key = match win_key_option {
            Some(k) => k,
            None => continue,
        };

        let entry = &manifest.platforms[win_key];
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
pub fn install_update(path: String) -> Result<String, String> {
    // Download from URL if needed, return local path
    let installer_path = if path.starts_with("http://") || path.starts_with("https://") {
        let client = reqwest::blocking::Client::builder()
            .user_agent("ai-app-builder-updater")
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let resp = client
            .get(&path)
            .send()
            .map_err(|e| format!("Falha ao baixar atualização: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Falha ao baixar atualização: servidor retornou HTTP {}",
                resp.status()
            ));
        }

        let temp_dir = std::env::temp_dir().join("ai-app-builder-update");
        fs::create_dir_all(&temp_dir).map_err(|e| format!("Falha ao criar diretório temporário: {}", e))?;

        let filename = path.rsplit('/').next().unwrap_or("installer.exe");
        let dest = temp_dir.join(filename);

        let bytes = resp.bytes().map_err(|e| format!("Falha ao ler resposta: {}", e))?;
        fs::write(&dest, &bytes).map_err(|e| format!("Falha ao salvar instalador: {}", e))?;

        dest.to_string_lossy().to_string()
    } else {
        resolve_installer_path(&path)
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

    // Kill only the sidecar (node.exe) so Prisma engine DLL is unlocked
    let _ = std::process::Command::new("taskkill")
        .args(["/f", "/t", "/im", "node.exe"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();

    std::thread::sleep(std::time::Duration::from_secs(3));

    // Spawn installer detached with /RUN so it auto-launches after install
    std::process::Command::new(&path)
        .args(["/S", "/RUN"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Falha ao executar instalador: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
