let _token: string | null = null

const BASE = 'https://api.github.com'

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'fluxcodex-sidecar',
  }
  if (_token) h['Authorization'] = `Bearer ${_token}`
  return h
}

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API ${method} ${path}: ${res.status} ${err}`)
  }
  return res.json()
}

export function setToken(token: string) {
  _token = token
}

export function getToken(): string | null {
  return _token
}

export function isAuthenticated(): boolean {
  return !!_token
}

export interface GhUser {
  login: string
  avatar_url: string
  name: string | null
  email: string | null
}

export interface GhRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  default_branch: string
  updated_at: string
}

export interface GhBranch {
  name: string
  commit: { sha: string; url: string }
  protected: boolean
}

export interface GhPullRequest {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  user: { login: string }
  head: { ref: string; repo: { full_name: string } | null }
  base: { ref: string }
  created_at: string
  mergeable: boolean | null
}

export interface GhIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  user: { login: string }
  labels: Array<{ name: string; color: string }>
  created_at: string
  comments: number
}

export interface GhFile {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir'
  content?: string
  download_url: string | null
}

export async function getUser(): Promise<GhUser> {
  return gh<GhUser>('GET', '/user')
}

export async function listRepos(type: 'owner' | 'all' = 'owner', perPage: number = 50): Promise<GhRepo[]> {
  return gh<GhRepo[]>('GET', `/user/repos?type=${type}&per_page=${perPage}&sort=updated`)
}

export async function getRepo(owner: string, repo: string): Promise<GhRepo> {
  return gh<GhRepo>('GET', `/repos/${owner}/${repo}`)
}

export async function listBranches(owner: string, repo: string): Promise<GhBranch[]> {
  return gh<GhBranch[]>('GET', `/repos/${owner}/${repo}/branches`)
}

export async function listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GhPullRequest[]> {
  return gh<GhPullRequest[]>('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=20`)
}

export async function createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<GhPullRequest> {
  return gh<GhPullRequest>('POST', `/repos/${owner}/${repo}/pulls`, { title, head, base, body })
}

export async function listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GhIssue[]> {
  return gh<GhIssue[]>('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=20`)
}

export async function createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]): Promise<GhIssue> {
  return gh<GhIssue>('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels })
}

export async function getRepoContents(owner: string, repo: string, path: string = ''): Promise<GhFile[]> {
  return gh<GhFile[]>('GET', `/repos/${owner}/${repo}/contents/${path}`)
}

export async function createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string): Promise<{ content: GhFile; commit: { sha: string } }> {
  return gh('PUT', `/repos/${owner}/${repo}/contents/${path}`, {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
  })
}

export async function mergePullRequest(owner: string, repo: string, pullNumber: number, commitTitle?: string): Promise<{ sha: string; merged: boolean; message: string }> {
  return gh('PUT', `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
    commit_title: commitTitle,
  })
}
