use serde::{Deserialize, Serialize};
use std::io::Read;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

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
    pub timed_out: bool,
}

#[tauri::command]
pub fn run_tool(
    exec: String,
    cwd: String,
    params: Vec<ToolParam>,
    timeout_secs: Option<u64>,
) -> Result<ToolResult, String> {
    let timeout = Duration::from_secs(timeout_secs.unwrap_or(30));
    let deadline = Instant::now() + timeout;

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

    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn tool: {}", e))?;

    let mut child_stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut child_stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let exit_code = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.code(),
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Ok(ToolResult {
                        stdout: String::new(),
                        stderr: "Tool execution timed out".into(),
                        exit_code: -1,
                        timed_out: true,
                    });
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("Process wait error: {}", e)),
        }
    };

    let mut stdout_buf = String::new();
    let mut stderr_buf = String::new();
    let _ = child_stdout.read_to_string(&mut stdout_buf);
    let _ = child_stderr.read_to_string(&mut stderr_buf);

    Ok(ToolResult {
        stdout: truncate(&stdout_buf, 5000),
        stderr: truncate(&stderr_buf, 2000),
        exit_code: exit_code.unwrap_or(-1),
        timed_out: false,
    })
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() > max {
        let mut truncated = s.chars().take(max).collect::<String>();
        truncated.push_str("... (truncated)");
        truncated
    } else {
        s.to_string()
    }
}
