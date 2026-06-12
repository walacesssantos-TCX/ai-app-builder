use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub changes: Vec<String>,
    pub staged: Vec<String>,
    pub ahead: i32,
    pub behind: i32,
}

fn git(args: &[&str], dir: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Git error: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let branch = git(&["rev-parse", "--abbrev-ref", "HEAD"], &path)?;

    let changes_output = git(&["status", "--porcelain"], &path)?;
    let mut changes = Vec::new();
    let mut staged = Vec::new();

    for line in changes_output.lines() {
        if line.len() > 3 {
            let status = &line[..2];
            let file = &line[3..];
            match status {
                "?? " => changes.push(format!("untracked: {}", file)),
                "M " => staged.push(format!("modified: {}", file)),
                "A " => staged.push(format!("added: {}", file)),
                _ if status.contains('M') => changes.push(format!("modified: {}", file)),
                _ => changes.push(format!("{}: {}", status.trim(), file)),
            }
        }
    }

    let ahead_behind = git(&["rev-list", "--count", "--left-right", "@{upstream}...HEAD"], &path);
    let (ahead, behind) = match ahead_behind {
        Ok(output) => {
            let parts: Vec<&str> = output.split('\t').collect();
            if parts.len() == 2 {
                (parts[0].parse().unwrap_or(0), parts[1].parse().unwrap_or(0))
            } else {
                (0, 0)
            }
        }
        Err(_) => (0, 0),
    };

    Ok(GitStatus {
        branch,
        changes,
        staged,
        ahead,
        behind,
    })
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    git(&["commit", "-m", &message], &path).map(|_| ())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    git(&["push"], &path).map(|_| ())
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<(), String> {
    git(&["pull"], &path).map(|_| ())
}

#[tauri::command]
pub fn git_clone(url: String, destination: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(["clone", &url, &destination])
        .output()
        .map_err(|e| format!("Git clone error: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
