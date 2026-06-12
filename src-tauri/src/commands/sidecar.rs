use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::path::PathBuf;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

fn get_sidecar_dir() -> PathBuf {
    // Strategy 1: working directory (tauri dev from project root)
    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("sidecar");
        if candidate.join("dist/index.js").exists() || candidate.join("src/index.ts").exists() {
            return candidate;
        }
    }
    // Strategy 2: executable directory — walk ancestors
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            for ancestor in parent.ancestors() {
                // Dev mode: sidecar/ at project root
                let candidate = ancestor.join("sidecar");
                if candidate.join("dist/index.js").exists() || candidate.join("src/index.ts").exists() {
                    return candidate;
                }
                // Production (NSIS): _up_/sidecar/ next to the exe
                let nsis = ancestor.join("_up_").join("sidecar");
                if nsis.join("dist/index.js").exists() {
                    return nsis;
                }
                // Production (other bundlers): _resources/sidecar/
                let resource = ancestor.join("_resources").join("sidecar");
                if resource.join("dist/index.js").exists() {
                    return resource;
                }
            }
        }
    }
    // Strategy 3: fallback to relative
    PathBuf::from("sidecar")
}

fn get_node_executable() -> PathBuf {
    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("src-tauri").join("resources").join("node").join("node.exe");
        if candidate.exists() {
            return candidate;
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            for ancestor in parent.ancestors() {
                let candidate = ancestor.join("_resources").join("node").join("node.exe");
                if candidate.exists() {
                    return candidate;
                }

                let nsis = ancestor.join("_up_").join("node").join("node.exe");
                if nsis.exists() {
                    return nsis;
                }

                let bundled = ancestor.join("resources").join("node").join("node.exe");
                if bundled.exists() {
                    return bundled;
                }
            }
        }
    }

    PathBuf::from("node")
}

#[tauri::command]
pub fn start_sidecar() -> Result<(), String> {
    let mut process = SIDECAR_PROCESS.lock().map_err(|e| e.to_string())?;

    if process.is_some() {
        return Ok(());
    }

    let sidecar_dir = get_sidecar_dir();
    let dist_path = sidecar_dir.join("dist/index.js");
    let src_path = sidecar_dir.join("src/index.ts");
    let env_path = sidecar_dir.join(".env");
    let node_exe = get_node_executable();

    let db_url = format!("file:{}/prisma/aibuilder.db", sidecar_dir.to_string_lossy());

    #[cfg(windows)]
    let mut node_command = Command::new(node_exe);

    #[cfg(not(windows))]
    let mut node_command = Command::new(node_exe);

    #[cfg(windows)]
    node_command.creation_flags(CREATE_NO_WINDOW);

    let child = if dist_path.exists() {
        let env_arg = format!("--env-file={}", env_path.display());
        let dist = dist_path.to_string_lossy().to_string();
        node_command
            .args([&env_arg, &dist])
            .current_dir(&sidecar_dir)
            .env("DATABASE_URL", &db_url)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar (node): {}", e))?
    } else if src_path.exists() {
        let env_arg = format!("--env-file={}", env_path.display());
        let src = src_path.to_string_lossy().to_string();
        let mut npx_command = Command::new("npx");

        #[cfg(windows)]
        npx_command.creation_flags(CREATE_NO_WINDOW);

        npx_command
            .args(["tsx", &env_arg, &src])
            .current_dir(&sidecar_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar (tsx): {}", e))?
    } else {
        return Err(format!(
            "Sidecar not found at {:?} or {:?}",
            dist_path, src_path
        ));
    };

    *process = Some(child);

    // Wait briefly for sidecar to bind
    for _ in 0..20 {
        if std::net::TcpStream::connect_timeout(
            &"127.0.0.1:3001".parse().unwrap(),
            Duration::from_millis(200),
        )
        .is_ok()
        {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    eprintln!("Warning: Sidecar started but not yet listening on port 3001");
    Ok(())
}

#[tauri::command]
pub fn stop_sidecar() -> Result<(), String> {
    let mut process = SIDECAR_PROCESS.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = process.take() {
        child.kill().map_err(|e| format!("Failed to stop sidecar: {}", e))?;
        child.wait().ok();
        println!("Sidecar stopped");
    }

    Ok(())
}

#[tauri::command]
pub fn is_sidecar_running() -> bool {
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}
