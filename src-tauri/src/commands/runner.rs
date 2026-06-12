use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;

#[derive(Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub exec: String,
    pub permissions: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ToolParam {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
pub struct ToolResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn run_tool(
    exec: String,
    cwd: String,
    params: Vec<ToolParam>,
    timeout_secs: Option<u64>,
) -> Result<ToolResult, String> {
    let _timeout = Duration::from_secs(timeout_secs.unwrap_or(30));

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(&exec);
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c").arg(&exec);
        c
    };

    for param in &params {
        cmd.env(format!("TOOL_{}", param.key.to_uppercase()), &param.value);
    }

    cmd.current_dir(&cwd);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute tool: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(ToolResult {
        stdout: truncate(&stdout, 5000),
        stderr: truncate(&stderr, 2000),
        exit_code,
    })
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() > max {
        format!("{}... (truncated)", &s[..max])
    } else {
        s.to_string()
    }
}
