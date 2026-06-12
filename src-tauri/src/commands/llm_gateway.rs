use aes_gcm::{
    aead::Aead,
    Aes256Gcm, Key, KeyInit, Nonce,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::ipc::Channel;

use super::ai::ChatStreamEvent;

const CRYPTO_KEY_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn decrypt_key(ciphertext_b64: &str) -> Result<String, String> {
    let key_bytes = hex::decode(CRYPTO_KEY_HEX).map_err(|e| format!("Invalid crypto key hex: {}", e))?;
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);

    let data = base64::engine::general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    if data.len() < 32 {
        return Err("Ciphertext too short".into());
    }

    let (iv_bytes, rest) = data.split_at(16);
    let (tag_bytes, encrypted) = rest.split_at(16);

    let nonce = Nonce::from_slice(iv_bytes);
    let mut payload = encrypted.to_vec();
    payload.extend_from_slice(tag_bytes);

    let plaintext = cipher
        .decrypt(nonce, payload.as_ref())
        .map_err(|e| format!("Decryption failed: {:?}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

fn find_db_path() -> PathBuf {
    let candidates = [
        PathBuf::from("D:\\Projeto Fluxcodex\\ai-app-builder\\sidecar\\prisma\\aibuilder.db"),
        {
            let mut p = std::env::current_dir().unwrap_or_default();
            p.push("sidecar/prisma/aibuilder.db");
            p
        },
        {
            let mut p = std::env::current_dir().unwrap_or_default();
            p.push("prisma/aibuilder.db");
            p
        },
    ];

    for c in &candidates {
        if c.exists() {
            return c.clone();
        }
    }

    candidates[0].clone()
}

fn load_api_keys() -> Result<HashMap<String, String>, String> {
    let db_path = find_db_path();
    if !db_path.exists() {
        return Ok(HashMap::new());
    }

    let conn = rusqlite::Connection::open(&db_path).map_err(|e| format!("DB open: {}", e))?;
    let mut stmt = conn
        .prepare("SELECT provider, keyHash FROM ApiKey")
        .map_err(|e| format!("SQL prepare: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            let provider: String = row.get(0)?;
            let key_hash: String = row.get(1)?;
            Ok((provider, key_hash))
        })
        .map_err(|e| format!("SQL query: {}", e))?;

    let mut keys = HashMap::new();
    for row in rows {
        let (provider, key_hash) = row.map_err(|e| format!("Row read: {}", e))?;
        if let Ok(decrypted) = decrypt_key(&key_hash) {
            keys.insert(provider, decrypted);
        }
    }

    Ok(keys)
}

#[derive(Deserialize)]
pub struct CloudChatRequest {
    pub message: String,
    pub mode: Option<String>,
    pub model: String,
    pub active_skills: Option<Vec<super::ai::ActiveSkill>>,
}

#[derive(Serialize)]
pub struct ModelGroup {
    pub provider: String,
    pub models: Vec<String>,
}

fn build_system_prompt(mode: &str, active_skills: &[super::ai::ActiveSkill]) -> String {
    let mut prompt = String::from(
        "# Identidade\nVocê é o AI App Builder Studio — um assistente nativo do Fluxcodex. Responda em português brasileiro.\n",
    );

    if mode == "think" {
        prompt.push_str(
            "\n## Modo Think\nAntes de responder, organize a solução em etapas curtas, verifique riscos e entregue a resposta final de forma objetiva.\n",
        );
    }

    if !active_skills.is_empty() {
        prompt.push_str("\n## Skills Ativas\n");
        for skill in active_skills {
            prompt.push_str(&format!("### {}\n{}\n{}\n", skill.name, skill.description, skill.content));
        }
    }

    prompt
}

fn get_provider_for_model(model: &str) -> &str {
    if model.starts_with("claude-") {
        "anthropic"
    } else if model.starts_with("gpt-") || model.starts_with("o1") || model.starts_with("o3") {
        "openai"
    } else if model.starts_with("gemini-") {
        "gemini"
    } else if model.starts_with("deepseek-") {
        "deepseek"
    } else if model.contains("mistral") || model.contains("codestral") {
        "mistral"
    } else if model.contains("llama") || model.contains("mixtral") || model.contains("gemma") {
        "groq"
    } else {
        "openai"
    }
}

fn get_provider_base_url(provider: &str) -> &str {
    match provider {
        "deepseek" => "https://api.deepseek.com/v1",
        "mistral" => "https://api.mistral.ai/v1",
        "groq" => "https://api.groq.com/openai/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        _ => "https://api.openai.com/v1",
    }
}

async fn stream_anthropic(
    api_key: &str,
    model: &str,
    message: &str,
    system_prompt: &str,
    on_event: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client build: {}", e))?;
    let mut response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": model,
            "max_tokens": 8192,
            "system": system_prompt,
            "messages": [{"role": "user", "content": message}],
            "stream": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Anthropic request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API {}: {}", status, body));
    }

    super::ai::reset_cancel();

    let mut buffer = String::new();
    let mut input_tokens = 0u64;
    let mut output_tokens = 0u64;

    loop {
        if super::ai::is_cancelled() {
            return Ok(());
        }

        let chunk = response
            .chunk()
            .await
            .map_err(|e| format!("Anthropic stream: {}", e))?;
        let chunk = match chunk {
            Some(c) => c,
            None => break,
        };

        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            buffer.push_str(&text);
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer = buffer[pos + 1..].to_string();

                if !line.starts_with("data: ") {
                    continue;
                }
                let data = line[6..].trim();
                if data == "[DONE]" {
                    break;
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(msg) = parsed.get("message") {
                        if let Some(usage) = msg.get("usage") {
                            input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        }
                    }
                    if parsed.get("type").and_then(|v| v.as_str()) == Some("message_delta") {
                        if let Some(usage) = parsed.get("usage") {
                            output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        }
                    }
                    if let Some(delta) = parsed.get("delta") {
                        if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                            if !text.is_empty() {
                                on_event
                                    .send(ChatStreamEvent::Chunk {
                                        content: text.to_string(),
                                    })
                                    .map_err(|e| e.to_string())?;
                            }
                        }
                    }
                }
            }
        }
    }

    if input_tokens > 0 || output_tokens > 0 {
        on_event
            .send(ChatStreamEvent::TokenUsage {
                total: (input_tokens + output_tokens) as u32,
            })
            .ok();
    }

    Ok(())
}

async fn stream_openai_compatible(
    api_key: &str,
    base_url: &str,
    model: &str,
    message: &str,
    system_prompt: &str,
    on_event: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client build: {}", e))?;
    let mut response = client
        .post(format!("{}/chat/completions", base_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            "max_tokens": 8192,
            "stream": true,
            "stream_options": {"include_usage": true},
        }))
        .send()
        .await
        .map_err(|e| format!("OpenAI request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API {}: {}", status, body));
    }

    super::ai::reset_cancel();

    let mut buffer = String::new();
    let mut input_tokens = 0u64;
    let mut output_tokens = 0u64;

    loop {
        if super::ai::is_cancelled() {
            return Ok(());
        }

        let chunk = response
            .chunk()
            .await
            .map_err(|e| format!("OpenAI stream: {}", e))?;
        let chunk = match chunk {
            Some(c) => c,
            None => break,
        };

        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            buffer.push_str(&text);
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer = buffer[pos + 1..].to_string();

                if !line.starts_with("data: ") {
                    continue;
                }
                let data = line[6..].trim();
                if data == "[DONE]" {
                    break;
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(usage) = parsed.get("usage") {
                        input_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                        output_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                    }
                    if let Some(choices) = parsed.get("choices").and_then(|v| v.as_array()) {
                        if let Some(choice) = choices.first() {
                            if let Some(delta) = choice.get("delta") {
                                if let Some(content) = delta.get("content").and_then(|v| v.as_str()) {
                                    if !content.is_empty() {
                                        on_event
                                            .send(ChatStreamEvent::Chunk {
                                                content: content.to_string(),
                                            })
                                            .map_err(|e| e.to_string())?;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if input_tokens > 0 || output_tokens > 0 {
        on_event
            .send(ChatStreamEvent::TokenUsage {
                total: (input_tokens + output_tokens) as u32,
            })
            .ok();
    }

    Ok(())
}

async fn stream_gemini(
    api_key: &str,
    model: &str,
    message: &str,
    system_prompt: &str,
    on_event: &Channel<ChatStreamEvent>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client build: {}", e))?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}",
        model, api_key
    );

    let mut response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "contents": [{"role": "user", "parts": [{"text": message}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "generationConfig": {"maxOutputTokens": 8192},
        }))
        .send()
        .await
        .map_err(|e| format!("Gemini request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API {}: {}", status, body));
    }

    super::ai::reset_cancel();

    let mut buffer = String::new();
    let mut input_tokens = 0u64;
    let mut output_tokens = 0u64;

    loop {
        if super::ai::is_cancelled() {
            return Ok(());
        }

        let chunk = response
            .chunk()
            .await
            .map_err(|e| format!("Gemini stream: {}", e))?;
        let chunk = match chunk {
            Some(c) => c,
            None => break,
        };

        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            buffer.push_str(&text);
            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer = buffer[pos + 1..].to_string();

                if !line.starts_with("data: ") {
                    continue;
                }
                let data = line[6..].trim();
                if data == "[DONE]" {
                    break;
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(meta) = parsed.get("usageMetadata") {
                        input_tokens = meta.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
                        output_tokens = meta.get("candidatesTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
                    }
                    if let Some(candidates) = parsed.get("candidates").and_then(|v| v.as_array()) {
                        if let Some(candidate) = candidates.first() {
                            if let Some(content) = candidate.get("content") {
                                if let Some(parts) = content.get("parts").and_then(|v| v.as_array()) {
                                    for part in parts {
                                        if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                            if !text.is_empty() {
                                                on_event
                                                    .send(ChatStreamEvent::Chunk {
                                                        content: text.to_string(),
                                                    })
                                                    .map_err(|e| e.to_string())?;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if input_tokens > 0 || output_tokens > 0 {
        on_event
            .send(ChatStreamEvent::TokenUsage {
                total: (input_tokens + output_tokens) as u32,
            })
            .ok();
    }

    Ok(())
}

#[tauri::command]
pub async fn cloud_chat_completion(
    request: CloudChatRequest,
    on_event: Channel<ChatStreamEvent>,
) -> Result<(), String> {
    super::ai::reset_cancel();

    let mode = request.mode.unwrap_or_else(|| "chat".into());
    let model = request.model;
    let active_skills = request.active_skills.unwrap_or_default();
    let system_prompt = build_system_prompt(&mode, &active_skills);

    let provider_name = get_provider_for_model(&model);
    let keys = load_api_keys()?;

    let api_key = keys.get(provider_name).ok_or_else(|| {
        format!(
            "API key não encontrada para '{}'. Adicione em Configurações > API Keys.",
            provider_name
        )
    })?;

    if super::ai::is_cancelled() {
        return Ok(());
    }

    match provider_name {
        "anthropic" => stream_anthropic(api_key, &model, &request.message, &system_prompt, &on_event).await,
        "gemini" => stream_gemini(api_key, &model, &request.message, &system_prompt, &on_event).await,
        _ => {
            let base_url = get_provider_base_url(provider_name);
            stream_openai_compatible(api_key, base_url, &model, &request.message, &system_prompt, &on_event).await
        }
    }
}

#[tauri::command]
pub fn cloud_models() -> Vec<ModelGroup> {
    vec![
        ModelGroup {
            provider: "Anthropic".into(),
            models: vec![
                "claude-sonnet-4-20250514".into(),
                "claude-3-5-sonnet-20241022".into(),
                "claude-opus-4-20250514".into(),
            ],
        },
        ModelGroup {
            provider: "OpenAI".into(),
            models: vec!["gpt-4o".into(), "gpt-4o-mini".into(), "o1".into(), "o3-mini".into()],
        },
        ModelGroup {
            provider: "Gemini".into(),
            models: vec![
                "gemini-2.0-flash".into(),
                "gemini-2.0-flash-lite".into(),
                "gemini-2.5-pro-exp-03-25".into(),
            ],
        },
        ModelGroup {
            provider: "DeepSeek".into(),
            models: vec!["deepseek-chat".into(), "deepseek-reasoner".into()],
        },
        ModelGroup {
            provider: "Mistral".into(),
            models: vec![
                "mistral-large-latest".into(),
                "codestral-latest".into(),
                "mistral-small-latest".into(),
            ],
        },
        ModelGroup {
            provider: "Groq".into(),
            models: vec![
                "llama3-70b-8192".into(),
                "llama3-8b-8192".into(),
                "mixtral-8x7b-32768".into(),
                "gemma2-9b-it".into(),
            ],
        },
    ]
}
