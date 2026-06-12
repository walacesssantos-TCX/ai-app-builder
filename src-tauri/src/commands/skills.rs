use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct SkillFrontmatter {
    pub name: String,
    pub description: String,
    pub tools: Option<Vec<String>>,
    pub priority: Option<i32>,
}

#[derive(Serialize)]
pub struct SkillMeta {
    pub name: String,
    pub description: String,
    pub content: String,
    pub path: String,
    pub priority: i32,
}

#[derive(Serialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub content: String,
    pub path: String,
    pub priority: i32,
    pub pinned: bool,
}

pub fn parse_skill_md(path: &str) -> Result<SkillMeta, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return Err("Invalid SKILL.md format".into());
    }

    let frontmatter: SkillFrontmatter =
        serde_yaml::from_str(parts[1]).map_err(|e| format!("YAML parse error: {}", e))?;

    let body = parts[2].trim().to_string();

    Ok(SkillMeta {
        name: frontmatter.name,
        description: frontmatter.description,
        content: body,
        path: path.to_string(),
        priority: frontmatter.priority.unwrap_or(5),
    })
}

fn read_skills_dir(dir: &str) -> Result<Vec<SkillMeta>, String> {
    let mut skills = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let skill_file = path.join("SKILL.md");
            if skill_file.exists() {
                if let Ok(skill) = parse_skill_md(&skill_file.to_string_lossy()) {
                    skills.push(skill);
                }
            }
        } else if path.extension().map(|e| e == "md").unwrap_or(false) {
            if let Ok(skill) = parse_skill_md(&path.to_string_lossy()) {
                skills.push(skill);
            }
        }
    }

    Ok(skills)
}

fn get_global_skills_path() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    Path::new(&home).join(".aibuilder").join("skills")
}

fn get_builtin_skills() -> Vec<SkillMeta> {
    crate::skills_data::get_builtin_skills()
}

#[tauri::command]
pub fn discover_skills(project_path: String) -> Result<Vec<SkillMeta>, String> {
    let mut skills = Vec::new();

    // 1. Skills do projeto
    let project_skills = format!("{}/skills", project_path);
    if Path::new(&project_skills).exists() {
        if let Ok(mut s) = read_skills_dir(&project_skills) {
            skills.append(&mut s);
        }
    }

    // 2. Skills globais do usuário
    let global_skills = get_global_skills_path();
    if global_skills.exists() {
        if let Ok(mut s) = read_skills_dir(&global_skills.to_string_lossy()) {
            skills.append(&mut s);
        }
    }

    // 3. Skills built-in
    skills.extend(get_builtin_skills());

    Ok(skills)
}

#[tauri::command]
pub fn read_skill(skill_path: String) -> Result<SkillMeta, String> {
    if skill_path.starts_with("builtin://") {
        let name = skill_path.trim_start_matches("builtin://");
        let builtin = get_builtin_skills();
        builtin
            .into_iter()
            .find(|s| s.name == name)
            .ok_or_else(|| "Built-in skill not found".into())
    } else {
        parse_skill_md(&skill_path)
    }
}
