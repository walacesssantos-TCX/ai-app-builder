import type { FastifyInstance } from 'fastify'
import * as gh from '../services/github.js'

export function registerGitHubRoutes(fastify: FastifyInstance): void {
  fastify.post('/github/token', async (req) => {
    const { token } = req.body as { token: string }
    if (!token) return { error: 'Token is required' }
    gh.setToken(token)
    return { success: true }
  })

  fastify.get('/github/user', async () => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const user = await gh.getUser()
    return user
  })

  fastify.get('/github/repos', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { type, per_page } = req.query as { type?: string; per_page?: string }
    const repos = await gh.listRepos(type as any, per_page ? parseInt(per_page) : 50)
    return repos
  })

  fastify.get('/github/repos/:owner/:repo', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    return gh.getRepo(owner, repo)
  })

  fastify.get('/github/repos/:owner/:repo/branches', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    return gh.listBranches(owner, repo)
  })

  fastify.get('/github/repos/:owner/:repo/pulls', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    const { state } = req.query as { state?: string }
    return gh.listPullRequests(owner, repo, state as any)
  })

  fastify.post('/github/repos/:owner/:repo/pulls', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    const { title, head, base, body } = req.body as { title: string; head: string; base: string; body?: string }
    return gh.createPullRequest(owner, repo, title, head, base, body)
  })

  fastify.post('/github/repos/:owner/:repo/pulls/:number/merge', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo, number } = req.params as { owner: string; repo: string; number: string }
    const { commit_title } = req.body as { commit_title?: string }
    return gh.mergePullRequest(owner, repo, parseInt(number), commit_title)
  })

  fastify.get('/github/repos/:owner/:repo/issues', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    const { state } = req.query as { state?: string }
    return gh.listIssues(owner, repo, state as any)
  })

  fastify.post('/github/repos/:owner/:repo/issues', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo } = req.params as { owner: string; repo: string }
    const { title, body, labels } = req.body as { title: string; body?: string; labels?: string[] }
    return gh.createIssue(owner, repo, title, body, labels)
  })

  fastify.get('/github/repos/:owner/:repo/contents/*', async (req) => {
    if (!gh.isAuthenticated()) return { error: 'Not authenticated' }
    const { owner, repo, '*': filePath } = req.params as { owner: string; repo: string; '*': string }
    return gh.getRepoContents(owner, repo, filePath || '')
  })

  fastify.get('/github/status', async () => ({
    authenticated: gh.isAuthenticated(),
    user: gh.isAuthenticated() ? await gh.getUser().catch(() => null) : null,
  }))
}
