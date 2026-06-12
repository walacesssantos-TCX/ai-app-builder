use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;
use tauri::ipc::Channel;

use super::runner::ToolDef;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

static OLLAMA_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
const LOCAL_MODEL_NAME: &str = "qwen3.5:4b";
const LOCAL_MODEL_ALIAS: &str = "fluxcodex-qwen35-native";
const DEFAULT_OLLAMA_HOST: &str = "http://127.0.0.1:11434";

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatStreamEvent {
    Chunk { content: String },
    TokenUsage { total: u32 },
}

#[derive(Deserialize, Clone)]
pub struct ActiveSkill {
    pub name: String,
    pub description: String,
    pub content: String,
    pub priority: i32,
    pub tools: Vec<ToolDef>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub message: String,
    pub mode: Option<String>,
    pub model: Option<String>,
    pub active_skills: Option<Vec<ActiveSkill>>,
}

#[derive(Serialize)]
pub struct ModelGroup {
    pub provider: String,
    pub models: Vec<String>,
}

fn get_ollama_host() -> String {
    let host = std::env::var("OLLAMA_HOST").unwrap_or_else(|_| DEFAULT_OLLAMA_HOST.into());
    if !host.starts_with("http://") && !host.starts_with("https://") {
        format!("http://{}", host)
    } else {
        host
    }
}

fn find_resource_path(app: &tauri::AppHandle, relative: &str) -> Option<PathBuf> {
    app.path()
        .resolve(relative, tauri::path::BaseDirectory::Resource)
        .ok()
}

fn find_ollama_executable(app: &tauri::AppHandle) -> PathBuf {
    let candidates = [
        find_resource_path(app, "ollama/ollama.exe"),
        find_resource_path(app, "resources/ollama/ollama.exe"),
        Some(PathBuf::from("D:\\Projeto Fluxcodex\\ai-app-builder\\src-tauri\\resources\\ollama\\ollama.exe")),
        Some(PathBuf::from("C:\\Users\\walace\\AppData\\Local\\Programs\\Ollama\\ollama.exe")),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from("ollama")
}

fn find_native_blob() -> Result<PathBuf, String> {
    let mut roots = Vec::new();

    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        roots.push(PathBuf::from(userprofile).join("Documents").join("blobs"));
    }
    roots.push(PathBuf::from("C:\\Users\\walace\\Documents\\blobs"));
    roots.push(PathBuf::from("D:\\Projeto Fluxcodex\\ai-app-builder\\Documents\\blobs"));
    roots.push(PathBuf::from("D:\\Projeto Fluxcodex\\ai-app-builder\\blobs"));

    for root in roots {
        if !root.exists() {
            continue;
        }

        let mut entries = fs::read_dir(&root).map_err(|e| e.to_string())?.filter_map(|e| e.ok()).collect::<Vec<_>>();
        entries.sort_by_key(|entry| std::cmp::Reverse(entry.metadata().map(|m| m.len()).unwrap_or(0)));

        for entry in entries {
            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(meta) => meta,
                Err(_) => continue,
            };
            if !metadata.is_file() || metadata.len() < 10_000_000 {
                continue;
            }

            if let Ok(mut file) = fs::File::open(&path) {
                let mut header = [0u8; 4];
                use std::io::Read;
                if file.read_exact(&mut header).is_ok() && &header == b"GGUF" {
                    return Ok(path);
                }
            }
        }
    }

    Err("Native GGUF blob not found in Documents/blobs".into())
}

async fn wait_for_ollama(host: &str, timeout_ms: u64) -> Result<(), String> {
    let client = reqwest::Client::new();
    let started = std::time::Instant::now();

    while started.elapsed() < Duration::from_millis(timeout_ms) {
        if let Ok(response) = client.get(format!("{host}/api/tags")).send().await {
            if response.status().is_success() {
                return Ok(());
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Err("Ollama server did not become ready in time".into())
}

async fn ensure_ollama_server(app: &tauri::AppHandle) -> Result<(), String> {
    let host = get_ollama_host();
    let client = reqwest::Client::new();

    if let Ok(response) = client.get(format!("{host}/api/tags")).send().await {
        if response.status().is_success() {
            return Ok(());
        }
    }

    let process_running = {
        let process = OLLAMA_PROCESS.lock().map_err(|e| e.to_string())?;
        process.is_some()
    };

    if process_running {
        return wait_for_ollama(&host, 30_000).await;
    }

    let executable = find_ollama_executable(app);
    let mut command = Command::new(executable);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let clean_host = host.replace("http://", "").replace("https://", "");
    let child = command
        .args(["serve"])
        .env("OLLAMA_HOST", &clean_host)
        .env("OLLAMA_DISABLE_GPU", "1")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start Ollama server: {}", e))?;

    {
        let mut process = OLLAMA_PROCESS.lock().map_err(|e| e.to_string())?;
        *process = Some(child);
    }

    wait_for_ollama(&host, 30_000).await
}

async fn ensure_native_model(app: &tauri::AppHandle) -> Result<(), String> {
    ensure_ollama_server(app).await?;

    let host = get_ollama_host();
    let client = reqwest::Client::new();
    let tags = client
        .get(format!("{host}/api/tags"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| e.to_string())?;

    let model_exists = tags
        .get("models")
        .and_then(|v| v.as_array())
        .map(|models| {
            models.iter().any(|item| {
                item.get("name").and_then(|v| v.as_str()) == Some(LOCAL_MODEL_NAME)
                    || item.get("name").and_then(|v| v.as_str()) == Some(LOCAL_MODEL_ALIAS)
                    || item.get("model").and_then(|v| v.as_str()) == Some(LOCAL_MODEL_NAME)
                    || item.get("model").and_then(|v| v.as_str()) == Some(LOCAL_MODEL_ALIAS)
            })
        })
        .unwrap_or(false);

    if model_exists {
        return Ok(());
    }

    let blob_path = find_native_blob()?;
    let modelfile_dir = std::env::temp_dir().join("fluxcodex-ollama");
    fs::create_dir_all(&modelfile_dir).map_err(|e| e.to_string())?;
    let modelfile_path = modelfile_dir.join("Modelfile");

    let content = format!(
        "FROM \"{}\"\nPARAMETER temperature 1\nPARAMETER top_p 0.95\nPARAMETER top_k 20\nPARAMETER presence_penalty 1.5\n",
        blob_path.to_string_lossy().replace('\\', "/")
    );
    fs::write(&modelfile_path, content).map_err(|e| e.to_string())?;

    let executable = find_ollama_executable(app);
    let clean_host = host.replace("http://", "").replace("https://", "");
    let status = Command::new(executable)
        .args(["create", LOCAL_MODEL_NAME, "-f"])
        .arg(&modelfile_path)
        .env("OLLAMA_HOST", &clean_host)
        .env("OLLAMA_DISABLE_GPU", "1")
        .status()
        .map_err(|e| format!("Failed to create native model: {}", e))?;

    if !status.success() {
        return Err(format!("Ollama create failed with status {:?}", status.code()));
    }

    Ok(())
}

fn build_system_prompt(mode: &str, active_skills: &[ActiveSkill]) -> String {
    let mut prompt = String::from("# Identidade\nVocê é o AI App Builder Studio — um assistente nativo do Fluxcodex. Responda em português brasileiro.\n");

    if mode == "think" {
        prompt.push_str("\n## Modo Think\nAntes de responder, organize a solução em etapas curtas, verifique riscos e entregue a resposta final de forma objetiva.\n");
    }

    if !active_skills.is_empty() {
        prompt.push_str("\n## Skills Ativas\n");
        for skill in active_skills {
            prompt.push_str(&format!(
                "### {}\n{}\n{}\n",
                skill.name, skill.description, skill.content
            ));
        }
    }

    prompt
}

#[tauri::command]
pub async fn ai_models() -> Result<Vec<ModelGroup>, String> {
    Ok(vec![ModelGroup {
        provider: "Local".into(),
        models: vec![LOCAL_MODEL_NAME.into(), LOCAL_MODEL_ALIAS.into()],
    }])
}

#[tauri::command]
pub async fn chat_completion(
    app: tauri::AppHandle,
    request: ChatRequest,
    on_event: Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let mode = request.mode.unwrap_or_else(|| "chat".into());
    let model = request.model.unwrap_or_else(|| LOCAL_MODEL_NAME.into());
    let active_skills = request.active_skills.unwrap_or_default();

    let resolved_model = match model.as_str() {
        LOCAL_MODEL_NAME | LOCAL_MODEL_ALIAS => LOCAL_MODEL_NAME,
        _ => LOCAL_MODEL_NAME,
    };

    if model != LOCAL_MODEL_NAME && model != LOCAL_MODEL_ALIAS {
        return Err("Only the native local model is enabled in the Tauri backend for now.".into());
    }

    ensure_native_model(&app).await?;

    let host = get_ollama_host();
    let client = reqwest::Client::new();
    let mut response = client
        .post(format!("{host}/api/chat"))
        .json(&serde_json::json!({
            "model": resolved_model,
            "stream": true,
            "messages": [
                {
                    "role": "user",
                    "content": request.message,
                }
            ],
            "system": build_system_prompt(&mode, &active_skills),
            "options": {
                "num_predict": 4096,
            }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Ollama chat failed: {}", response.status()));
    }

    let mut buffer = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        buffer.extend_from_slice(&chunk);

        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes = buffer.drain(..=pos).collect::<Vec<u8>>();
            if let Ok(line_str) = String::from_utf8(line_bytes) {
                let trimmed = line_str.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    if let Some(msg) = val.get("message") {
                        if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                            if !content.is_empty() {
                                on_event
                                    .send(ChatStreamEvent::Chunk {
                                        content: content.to_string(),
                                    })
                                    .map_err(|e| e.to_string())?;
                            }
                        }
                    }
                    if let Some(done) = val.get("done").and_then(|d| d.as_bool()) {
                        if done {
                            let prompt_eval = val.get("prompt_eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
                            let eval = val.get("eval_count").and_then(|v| v.as_u64()).unwrap_or(0);
                            if prompt_eval > 0 || eval > 0 {
                                on_event
                                    .send(ChatStreamEvent::TokenUsage {
                                        total: (prompt_eval + eval) as u32,
                                    })
                                    .map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
