import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

type Format = 'md' | 'docx' | 'pdf' | 'xlsx' | 'csv'

const FORMATS: { id: Format; label: string }[] = [
  { id: 'md', label: '.MD' },
  { id: 'docx', label: '.DOCX' },
  { id: 'pdf', label: '.PDF' },
  { id: 'xlsx', label: '.XLSX' },
  { id: 'csv', label: '.CSV' },
]

function detectDocType(content: string): string | null {
  const firstLine = content.trim().split('\n')[0].toLowerCase()
  const headings = [
    '# prd', '# product requirements', '# specification', '# spec',
    '# documento de requisitos', '# documentação', '# documentacao',
    '# design doc', '# technical specification', '# tech spec',
    '# architecture', '# arquitetura',
    '# api specification', '# api spec',
  ]
  if (headings.some(h => firstLine.includes(h))) return firstLine.replace(/^#\s*/, '').trim()
  if (content.length > 500 && content.includes('## ') && content.includes('- **')) return firstLine.replace(/^#\s*/, '').trim()
  return null
}

function getDocTitle(content: string): string {
  const firstLine = content.trim().split('\n')[0].replace(/^#+\s*/, '').trim()
  return firstLine || 'documento'
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
}

export function DocumentDownload({ content }: { content: string }) {
  const [format, setFormat] = useState<Format>('md')
  const [downloading, setDownloading] = useState(false)

  const docType = detectDocType(content)
  if (!docType) return null

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const title = sanitizeFilename(getDocTitle(content))

      if (format === 'md') {
        const blob = new Blob([content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }

      const res = await fetch('http://127.0.0.1:3001/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, format, title }),
      })
      if (!res.ok) throw new Error(`Conversion failed: ${res.statusText}`)

      if (format === 'docx') {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error('Download failed:', e)
    } finally {
      setDownloading(false)
    }
  }, [content, format])

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700/50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-zinc-500">Baixar documento:</span>
        <div className="flex gap-1">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[11px] font-medium transition-all',
                format === f.id
                  ? 'bg-brand/20 text-brand-300 border border-brand/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={cn(
            'flex items-center gap-1 ml-auto px-2 py-1 rounded text-[11px] font-medium transition-all',
            'bg-brand hover:bg-brand-600 text-white',
            downloading && 'opacity-50 cursor-wait'
          )}
        >
          <Download className="w-3 h-3" />
          {downloading ? '...' : 'Download'}
        </button>
      </div>
    </div>
  )
}
