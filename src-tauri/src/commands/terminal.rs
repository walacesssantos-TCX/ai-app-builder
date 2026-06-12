use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct TerminalEvent {
    pub output: String,
    pub stream: String,
}

#[tauri::command]
pub async fn run_command(
    window: tauri::Window,
    command: String,
    working_dir: String,
    session_id: String,
) -> Result<(), String> {
    let mut child = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &command])
        .current_dir(&working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        window
            .emit(
                &format!("terminal:{}", session_id),
                TerminalEvent {
                    output: line,
                    stream: "stdout".into(),
                },
            )
            .ok();
    }

    let stderr = child.stderr.take().unwrap();
    let err_reader = BufReader::new(stderr);

    for line in err_reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        window
            .emit(
                &format!("terminal:{}", session_id),
                TerminalEvent {
                    output: line,
                    stream: "stderr".into(),
                },
            )
            .ok();
    }

    let status = child.wait().map_err(|e| e.to_string())?;

    window
        .emit(
            &format!("terminal:{}", session_id),
            TerminalEvent {
                output: format!("[exit: {}]", status.code().unwrap_or(-1)),
                stream: "status".into(),
            },
        )
        .ok();

    Ok(())
}
