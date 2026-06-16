use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use serde::Serialize;
use tauri::Emitter;
use tauri::Manager;

#[derive(Serialize, Clone)]
pub struct TerminalEvent {
    pub output: String,
    pub stream: String,
}

#[derive(Serialize, Clone)]
pub struct FluxcodexPaths {
    pub project_root: String,
    pub skills_dir: String,
    pub app_dir: String,
}

pub struct Session {
    pub stdin: std::process::ChildStdin,
    pub child: Option<Child>,
}

pub struct TerminalState {
    pub sessions: Arc<Mutex<HashMap<String, Session>>>,
    pub paths: FluxcodexPaths,
}

impl TerminalState {
    pub fn new() -> Self {
        let paths = get_dev_paths();
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            paths,
        }
    }
}

fn get_dev_paths() -> FluxcodexPaths {
    #[cfg(debug_assertions)]
    {
        let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
        let fluxcodex_root = manifest
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        if !fluxcodex_root.is_empty() {
            let skills_dir = Path::new(&fluxcodex_root)
                .join("memoria de conversa").join("skills")
                .to_string_lossy().to_string();
            let app_dir = Path::new(&fluxcodex_root)
                .join("ai-app-builder")
                .to_string_lossy().to_string();
            return FluxcodexPaths { project_root: fluxcodex_root, skills_dir, app_dir };
        }
    }
    FluxcodexPaths {
        project_root: String::new(),
        skills_dir: String::new(),
        app_dir: String::new(),
    }
}

#[tauri::command]
pub async fn get_fluxcodex_paths(
    app: tauri::AppHandle,
) -> Result<FluxcodexPaths, String> {
    let state = app.state::<TerminalState>();
    Ok(state.paths.clone())
}

#[tauri::command]
pub async fn create_terminal(
    app: tauri::AppHandle,
    session_id: String,
    cwd: String,
) -> Result<(), String> {
    let paths = {
        let state = app.state::<TerminalState>();
        state.paths.clone()
    };

    let mut cmd = Command::new("cmd.exe");
    cmd.args(["/Q"])
        .env("TERM", "xterm-256color")
        .env("FORCE_COLOR", "1")
        .env("CLICOLOR", "1")
        .current_dir(&cwd);

    if !paths.skills_dir.is_empty() {
        cmd.env("AI_BUILDER_SKILLS_DIR", &paths.skills_dir);
    }
    if !paths.project_root.is_empty() {
        cmd.env("AI_BUILDER_PROJECT_ROOT", &paths.project_root);
    }
    if !paths.app_dir.is_empty() {
        cmd.env("AI_BUILDER_APP_DIR", &paths.app_dir);
    }

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao criar terminal: {}", e))?;

    let stdin = child.stdin.take().ok_or("Falha ao capturar stdin")?;
    let stdout = child.stdout.take().ok_or("Falha ao capturar stdout")?;
    let stderr = child.stderr.take().ok_or("Falha ao capturar stderr")?;

    let sid = session_id.clone();
    let app_stdout = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    let _ = app_stdout.emit(
                        &format!("terminal:{}", sid),
                        TerminalEvent {
                            output: format!("{}\n", l),
                            stream: "stdout".into(),
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let sid2 = session_id.clone();
    let app_stderr = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    let _ = app_stderr.emit(
                        &format!("terminal:{}", sid2),
                        TerminalEvent {
                            output: format!("{}\n", l),
                            stream: "stderr".into(),
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let state = app.state::<TerminalState>();
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(
        session_id,
        Session {
            stdin,
            child: Some(child),
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn write_terminal(
    app: tauri::AppHandle,
    session_id: String,
    input: String,
) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    if let Some(session) = sessions.get_mut(&session_id) {
        writeln!(session.stdin, "{}", input)
            .map_err(|e| format!("Erro ao escrever no terminal: {}", e))?;
        session
            .stdin
            .flush()
            .map_err(|e| format!("Erro ao flush: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn kill_terminal(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;

    if let Some(mut session) = sessions.remove(&session_id) {
        if let Some(mut child) = session.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let _ = session.stdin.flush();
        drop(session.stdin);
    }

    Ok(())
}

#[tauri::command]
pub async fn resize_terminal(
    _app: tauri::AppHandle,
    _session_id: String,
    _cols: u16,
    _rows: u16,
) -> Result<(), String> {
    Ok(())
}
