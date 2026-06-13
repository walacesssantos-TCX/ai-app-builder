import { useState, useEffect } from 'react'
import { Github, LogIn, LogOut, Check, X, Eye, EyeOff, RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

export function GitHubSection() {
  const [token, setToken] = useState('')
  const [savedToken, setSavedToken] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ authenticated: boolean; user: { login: string; name: string | null } | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const s = await api.github.status()
      setStatus(s)
      setSavedToken(s.authenticated)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!token.trim()) return
    setSaving(true)
    try {
      await api.github.setToken(token.trim())
      setSavedToken(true)
      setToken('')
      await checkStatus()
    } catch {
      // error
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await api.github.setToken('')
    setSavedToken(false)
    setStatus(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Github className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-medium text-zinc-100">GitHub Integration</h3>
        {loading && <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />}
      </div>

      {status?.authenticated && status.user ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-gold-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200">{status.user.name || status.user.login}</p>
                <p className="text-[10px] text-zinc-500">@{status.user.login}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-brand-400 transition-colors px-2 py-1 rounded hover:bg-zinc-700/50"
            >
              <LogOut className="w-3 h-3" /> Desconectar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Conecte sua conta GitHub para gerenciar repositórios, pull requests e issues diretamente do AI App Builder.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">GitHub Personal Access Token</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={!token.trim() || saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0',
                  token.trim() && !saving
                    ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                {saving ? '...' : 'Conectar'}
              </button>
            </div>
            <p className="text-[10px] text-zinc-600">
              Crie um token em{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-400 hover:text-gold-300 underline"
              >
                github.com/settings/tokens
              </a>
              {' '}com permissões <code className="text-zinc-400 bg-zinc-800 px-1 rounded">repo</code> e <code className="text-zinc-400 bg-zinc-800 px-1 rounded">read:user</code>.
            </p>
          </div>
        </div>
      )}

      {status?.authenticated && (
        <div>
          <button
            onClick={checkStatus}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Verificar status
          </button>
        </div>
      )}
    </div>
  )
}
