import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates')

export interface Template {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  order: number
  files: TemplateFile[]
}

export interface TemplateFile {
  path: string
  content: string
  isDir?: boolean
}

export interface TemplateManifest {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  order?: number
}

async function scanTemplateDir(dirPath: string, basePath: string): Promise<TemplateFile[]> {
  const files: TemplateFile[] = []
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    const relPath = relative(basePath, fullPath)

    if (entry.isDirectory()) {
      files.push({ path: relPath, content: '', isDir: true })
      files.push(...await scanTemplateDir(fullPath, basePath))
    } else if (entry.name !== 'template.json') {
      const content = await readFile(fullPath, 'utf-8')
      files.push({ path: relPath, content })
    }
  }

  return files
}

export async function listTemplates(): Promise<Template[]> {
  try {
    await stat(TEMPLATES_DIR)
  } catch {
    return []
  }

  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true })
  const templates: Template[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const templateDir = join(TEMPLATES_DIR, entry.name)

    try {
      const manifestRaw = await readFile(join(templateDir, 'template.json'), 'utf-8')
      const manifest: TemplateManifest = JSON.parse(manifestRaw)
      const files = await scanTemplateDir(templateDir, templateDir)

      templates.push({
        id: entry.name,
        name: manifest.name,
        description: manifest.description,
        category: manifest.category,
        tags: manifest.tags || [],
        order: manifest.order || 0,
        files,
      })
    } catch {
      // skip malformed templates
    }
  }

  return templates.sort((a, b) => a.order - b.order)
}

export async function createFromTemplate(templateId: string, destPath: string, replacements?: Record<string, string>): Promise<{ filesCreated: number }> {
  const templates = await listTemplates()
  const template = templates.find(t => t.id === templateId)
  if (!template) throw new Error(`Template not found: ${templateId}`)

  let count = 0
  for (const file of template.files) {
    const targetPath = join(destPath, file.path)

    if (file.isDir) {
      await mkdir(targetPath, { recursive: true })
      continue
    }

    await mkdir(path.dirname(targetPath), { recursive: true })

    let content = file.content
    if (replacements) {
      for (const [key, value] of Object.entries(replacements)) {
        content = content.replaceAll(`{{${key}}}`, value)
      }
    }

    await writeFile(targetPath, content, 'utf-8')
    count++
  }

  return { filesCreated: count }
}
