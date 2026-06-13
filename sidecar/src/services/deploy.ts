import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '../lib/prisma.js'

export interface DeploymentInfo {
  id: string
  name: string
  projectPath: string
  platform: string
  url: string | null
  status: string
  branch: string | null
  buildLog: string | null
  createdAt: string
  updatedAt: string
}

export async function listDeployments(): Promise<DeploymentInfo[]> {
  const rows = await prisma.deployment.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function createDeployment(data: {
  name: string
  projectPath: string
  platform: string
  branch?: string
}): Promise<DeploymentInfo> {
  const row = await prisma.deployment.create({
    data: {
      name: data.name,
      projectPath: data.projectPath,
      platform: data.platform,
      branch: data.branch || null,
      status: 'created',
    },
  })
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function runBuild(projectPath: string): Promise<{ success: boolean; log: string }> {
  const log: string[] = []

  try {
    // Check for package.json
    const pkgPath = path.join(projectPath, 'package.json')
    if (!existsSync(pkgPath)) {
      return { success: false, log: 'No package.json found in project path' }
    }

    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
    const buildScript = pkg.scripts?.build

    if (!buildScript) {
      return { success: false, log: 'No "build" script found in package.json' }
    }

    log.push(`[build] Found build script: ${buildScript}`)
    log.push(`[build] Running npm install...`)

    execSync('npm install --prefer-offline', { cwd: projectPath, stdio: 'pipe', timeout: 120000 })
    log.push(`[build] npm install completed`)

    log.push(`[build] Running build...`)
    const buildOutput = execSync('npm run build', {
      cwd: projectPath,
      stdio: 'pipe',
      timeout: 300000,
      encoding: 'utf-8',
    })
    log.push(buildOutput)
    log.push(`[build] Build completed successfully`)

    return { success: true, log: log.join('\n') }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    log.push(err.stdout || '')
    log.push(err.stderr || err.message || 'Build failed')
    return { success: false, log: log.join('\n') }
  }
}

export async function updateDeploymentStatus(
  id: string,
  status: string,
  url?: string,
  buildLog?: string
): Promise<DeploymentInfo> {
  const row = await prisma.deployment.update({
    where: { id },
    data: { status, url: url || null, buildLog: buildLog || null },
  })
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function deleteDeployment(id: string): Promise<void> {
  await prisma.deployment.delete({ where: { id } })
}
