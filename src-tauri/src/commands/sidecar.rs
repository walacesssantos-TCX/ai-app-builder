use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::fs::OpenOptions;
use std::io::Write;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Health check timeout: Prisma migration + module load can take 10-15s
const SIDECAR_STARTUP_TIMEOUT_MS: u64 = 30_000;
const SIDECAR_HEALTH_POLL_MS: u64 = 300;

fn timestamp() -> String {
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = d.as_secs() % 86400;
    let h = secs / 3600;
    let m = (secs / 60) % 60;
    let s = secs % 60;
    let ms = d.subsec_millis();
    format!("{:02}:{:02}:{:02}.{:03}", h, m, s, ms)
}

fn get_log_path() -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push("aibuilder-sidecar.log");
    p
}

fn log_to_file(msg: &str) {
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(get_log_path())
    {
        let _ = writeln!(f, "[{}] {}", timestamp(), msg);
    }
}

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
    // Strategy 3: Linux .deb — resources at ../lib/<appname>/_up_/sidecar/
    if cfg!(target_os = "linux") {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let candidate = parent.join("..").join("lib").join("AI App Builder Studio").join("_up_").join("sidecar");
                if candidate.join("dist/index.js").exists() {
                    return candidate;
                }
            }
        }
    }
    // Strategy 4: fallback to relative
    PathBuf::from("sidecar")
}

fn get_node_executable() -> PathBuf {
    #[cfg(not(windows))]
    {
        // On Linux, always use system node
        return PathBuf::from("node");
    }

    #[cfg(windows)]
    {
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
}

#[tauri::command]
pub fn start_sidecar() -> Result<(), String> {
    let mut process = SIDECAR_PROCESS.lock().map_err(|e| e.to_string())?;

    let child_alive = process.as_mut().and_then(|c| c.try_wait().ok()).flatten().is_none();
    if process.is_some() && child_alive {
        log_to_file("start_sidecar: already running, skipping");
        return Ok(());
    }

    if process.is_some() {
        log_to_file("start_sidecar: previous process died, cleaning up");
        if let Some(mut dead) = process.take() {
            let _ = dead.kill();
            let _ = dead.wait();
        }
    }

    // Check if port 3001 is in use by a stale sidecar (e.g., from a previous app version)
    let port_busy = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        std::time::Duration::from_millis(200),
    )
    .is_ok();
    if port_busy {
        log_to_file("start_sidecar: port 3001 is in use — killing stale processes");
        #[cfg(windows)]
        let _ = Command::new("taskkill")
            .args(["/f", "/im", "node.exe"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        #[cfg(not(windows))]
        {
            let _ = Command::new("pkill")
                .args(["-f", "node.*sidecar"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            let _ = Command::new("pkill")
                .args(["-f", "tsx.*index.ts"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
        }
        // Wait for port to be released
        std::thread::sleep(std::time::Duration::from_secs(1));
    }

    let sidecar_dir = get_sidecar_dir();
    let dist_path = sidecar_dir.join("dist/index.js");
    let src_path = sidecar_dir.join("src/index.ts");
    let env_path = sidecar_dir.join(".env");
    let node_exe = get_node_executable();
    let log_path = get_log_path();

    log_to_file(&format!(
        "Starting sidecar | dir={} | dist_exists={} | src_exists={} | env_exists={} | node={}",
        sidecar_dir.display(),
        dist_path.exists(),
        src_path.exists(),
        env_path.exists(),
        node_exe.display()
    ));

    let db_dir = {
        let base = if cfg!(windows) {
            std::env::var("APPDATA").ok()
                .map(PathBuf::from)
        } else {
            std::env::var("XDG_DATA_HOME").ok()
                .map(PathBuf::from)
                .or_else(|| {
                    std::env::var("HOME").ok().map(|h| PathBuf::from(h).join(".local").join("share"))
                })
        };
        if let Some(mut p) = base {
            p.push("Fluxcodex");
            p.push("aibuilder");
            let _ = std::fs::create_dir_all(&p);
            p
        } else {
            std::env::temp_dir()
        }
    };
    let db_dir_str = db_dir.to_string_lossy().replace("\\", "/");
    let db_url = format!("file:{}/aibuilder.db", db_dir_str);

    // Open log file for stderr capture
    let stderr_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();
    if let Some(ref f) = stderr_file {
        let _ = f.set_len(0);
    }

    #[cfg(windows)]
    let mut node_command = Command::new(&node_exe);

    #[cfg(not(windows))]
    let mut node_command = Command::new(&node_exe);

    #[cfg(windows)]
    node_command.creation_flags(CREATE_NO_WINDOW);

    // Pass critical env vars to the sidecar child process
    fn set_sidecar_env(cmd: &mut Command, db_url: &str, sidecar_dir: &PathBuf) {
        cmd.env("DATABASE_URL", db_url);
        // Pass WHISPER_PYTHON if set in parent process
        if let Ok(val) = std::env::var("WHISPER_PYTHON") {
            cmd.env("WHISPER_PYTHON", val);
        }
        // Pass GROQ API keys if set in parent
        for key in &["GROQ_API_KEY", "TOKEN_GROQ", "TOKEN_GROQ02"] {
            if let Ok(val) = std::env::var(key) {
                cmd.env(key, val);
            }
        }
        // Pass other common API keys
        for key in &["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY",
                     "GEMINI_API_KEY", "DEEPSEEK_API_KEY", "MISTRAL_API_KEY", "COHERE_API_KEY"] {
            if let Ok(val) = std::env::var(key) {
                cmd.env(key, val);
            }
        }
        // Set HOME so the sidecar finds the correct user config
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", home);
        }
        cmd.current_dir(sidecar_dir);
    }

    let child = if dist_path.exists() {
        let mut args = Vec::new();
        if env_path.exists() {
            args.push(format!("--env-file={}", env_path.display()));
        }
        args.push(dist_path.to_string_lossy().to_string());
        log_to_file(&format!("Spawning: {} {}", node_exe.display(), args.join(" ")));
        set_sidecar_env(&mut node_command, &db_url, &sidecar_dir);
        node_command
            .args(&args)
            .stdout(if let Some(ref f) = stderr_file {
                Stdio::from(f.try_clone().unwrap())
            } else {
                Stdio::null()
            })
            .stderr(if let Some(ref f) = stderr_file {
                Stdio::from(f.try_clone().unwrap())
            } else {
                Stdio::null()
            })
            .spawn()
            .map_err(|e| {
                let msg = format!("Failed to start sidecar (node): {}", e);
                log_to_file(&msg);
                msg
            })?
    } else if src_path.exists() {
        let mut args = vec!["tsx".to_string()];
        if env_path.exists() {
            args.push(format!("--env-file={}", env_path.display()));
        }
        args.push(src_path.to_string_lossy().to_string());
        log_to_file(&format!("Spawning: npx {} (dev mode)", args.join(" ")));
        let mut npx_command = Command::new("npx");

        #[cfg(windows)]
        npx_command.creation_flags(CREATE_NO_WINDOW);

        set_sidecar_env(&mut npx_command, &db_url, &sidecar_dir);
        npx_command
            .args(&args)
            .stderr(if let Some(ref f) = stderr_file {
                Stdio::from(f.try_clone().unwrap())
            } else {
                Stdio::null()
            })
            .spawn()
            .map_err(|e| {
                let msg = format!("Failed to start sidecar (tsx): {}", e);
                log_to_file(&msg);
                msg
            })?
    } else {
        let msg = format!("Sidecar not found at {:?} or {:?}", dist_path, src_path);
        log_to_file(&msg);
        return Err(msg);
    };

    let pid = child.id();
    *process = Some(child);

    log_to_file(&format!("Sidecar spawned, PID={}, waiting for health...", pid));

    let max_attempts = (SIDECAR_STARTUP_TIMEOUT_MS / SIDECAR_HEALTH_POLL_MS) as u32;
    for attempt in 0..max_attempts {
        // Check if process died
        {
            let mut guard = SIDECAR_PROCESS.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut c) = *guard {
                if let Some(status) = c.try_wait().ok().flatten() {
                    let msg = format!("Sidecar PID={} exited prematurely with status {}", pid, status);
                    log_to_file(&msg);
                    guard.take();
                    return Err(msg);
                }
            }
        }

        if std::net::TcpStream::connect_timeout(
            &"127.0.0.1:3001".parse().unwrap(),
            Duration::from_millis(SIDECAR_HEALTH_POLL_MS),
        )
        .is_ok()
        {
            log_to_file(&format!("Sidecar ready after {}ms", attempt as u64 * SIDECAR_HEALTH_POLL_MS));
            // Notify frontend via event — captured in setup hook
            // (events emitted from lib.rs level)
            return Ok(());
        }
    }

    log_to_file(&format!(
        "Sidecar PID={} started but NOT listening on port 3001 after {}ms — check log at {}",
        pid, SIDECAR_STARTUP_TIMEOUT_MS, log_path.display()
    ));
    eprintln!(
        "Warning: Sidecar started but not listening on port 3001. Check log: {}",
        log_path.display()
    );
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
    let port_open = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok();

    if port_open {
        return true;
    }

    // Port closed: check if our tracked child died
    if let Ok(mut guard) = SIDECAR_PROCESS.lock() {
        if let Some(ref mut c) = *guard {
            if let Some(status) = c.try_wait().ok().flatten() {
                log_to_file(&format!("is_sidecar_running: tracked child exited with {}", status));
                guard.take();
            } else {
                // Process alive but port closed — it likely hasn't finished starting
                return false;
            }
        }
    }

    false
}
