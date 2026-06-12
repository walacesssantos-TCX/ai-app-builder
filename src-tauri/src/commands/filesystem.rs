use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();

    for entry in dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
            children: None,
        });
    }

    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(entries)
}

#[tauri::command]
pub fn get_file_tree(path: String) -> Result<String, String> {
    fn build_tree(p: &Path, prefix: &str, is_last: bool) -> String {
        let mut result = String::new();
        let name = p.file_name().unwrap_or_default().to_string_lossy();
        let connector = if is_last { "└── " } else { "├── " };
        result.push_str(&format!("{}{}{}\n", prefix, connector, name));

        if p.is_dir() {
            let mut entries: Vec<_> = fs::read_dir(p)
                .map(|d| d.filter_map(|e| e.ok()).collect())
                .unwrap_or_default();
            entries.sort_by(|a, b| {
                let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
                let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
                if a_is_dir != b_is_dir {
                    b_is_dir.cmp(&a_is_dir)
                } else {
                    a.file_name().cmp(&b.file_name())
                }
            });

            let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
            for (i, entry) in entries.iter().enumerate() {
                let last = i == entries.len() - 1;
                result.push_str(&build_tree(&entry.path(), &new_prefix, last));
            }
        }

        result
    }

    let p = Path::new(&path);
    if p.exists() {
        Ok(build_tree(p, "", true))
    } else {
        Err("Path does not exist".to_string())
    }
}
