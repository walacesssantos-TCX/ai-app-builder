import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioWaveform, Upload, FileAudio, Loader2, Download, RotateCcw, AlertCircle, CheckCircle2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

type PageState = 'idle' | 'file_selected' | 'uploading' | 'transcribing' | 'done' | 'error'

const ALLOWED_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
const MAX_FILE_SIZE = 75 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function TranscriptionPanel() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [resultText, setResultText] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
  }, [])

  const startPolling = useCallback((id: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const st = await api.transcription.status(id)
        if (st.status === 'done') {
          stopPolling()
          const res = await api.transcription.result(id)
          setResultText(res.text)
          setPageState('done')
        } else if (st.status === 'error') {
          stopPolling()
          setErrorMsg(st.errorMessage || 'Erro desconhecido durante a transcrição.')
          setPageState('error')
        }
      } catch {
        stopPolling()
        setErrorMsg('Servidor indisponível. Verifique se o sidecar está rodando.')
        setPageState('error')
      }
    }, 4000)
  }, [stopPolling])

  const handleFileSelect = useCallback(async (selected: File | null) => {
    if (!selected) return
    const parts = selected.name.split('.')
    const rawExt = parts.length > 1 ? parts.pop()?.toLowerCase() : ''
    const ext = '.' + rawExt
    if (!ALLOWED_EXTS.includes(ext)) {
      setErrorMsg(`Formato não suportado${ext ? `: ${ext}` : ''}. Use: ${ALLOWED_EXTS.join(', ')}`)
      setPageState('error')
      return
    }
    if (selected.size === 0) {
      setErrorMsg('O arquivo está vazio.')
      setPageState('error')
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      const maxMb = MAX_FILE_SIZE / (1024 * 1024)
      setErrorMsg(`Arquivo muito grande (${formatSize(selected.size)}). Máximo permitido: ${maxMb} MB.`)
      setPageState('error')
      return
    }
    setFile(selected)
    setErrorMsg('')
    setResultText('')
    setPageState('file_selected')
  }, [])

  const handleTranscribe = useCallback(async () => {
    if (!file) return
    setPageState('uploading')
    setElapsed(0)

    elapsedRef.current = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    try {
      const base64 = await toBase64(file)
      setPageState('transcribing')

      const uploadRes = await api.transcription.upload(base64, file.name)
      setJobId(uploadRes.jobId)

      await api.transcription.start(uploadRes.jobId)
      startPolling(uploadRes.jobId)
    } catch (err) {
      stopPolling()
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao iniciar transcrição.')
      setPageState('error')
    }
  }, [file, startPolling, stopPolling])

  const handleReset = useCallback(() => {
    stopPolling()
    setFile(null)
    setJobId(null)
    setResultText('')
    setErrorMsg('')
    setElapsed(0)
    setPageState('idle')
    if (inputRef.current) inputRef.current.value = ''
  }, [stopPolling])

  const handleDownload = useCallback(() => {
    if (!jobId) return
    const url = api.transcription.downloadUrl(jobId)
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [jobId])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
          <div className="p-2 rounded-lg bg-brand/10 border border-brand/20">
            <AudioWaveform className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Transcrição de Áudio</h1>
            <p className="text-sm text-zinc-500">Transcreva áudio para texto usando Whisper local</p>
          </div>
        </div>

        {/* Drop zone - visible in idle state */}
        {(pageState === 'idle' || (pageState === 'error' && !file)) && (
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]) }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
              dragOver
                ? 'border-brand bg-brand/5'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900'
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.flac"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                'p-4 rounded-full transition-colors',
                dragOver ? 'bg-brand/20' : 'bg-zinc-800'
              )}>
                <Upload className={cn('w-8 h-8', dragOver ? 'text-brand' : 'text-zinc-400')} />
              </div>
              <div>
                <p className="text-zinc-300 font-medium">
                  {dragOver ? 'Solte o arquivo aqui' : 'Solte o áudio aqui ou clique para selecionar'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">MP3, WAV, M4A, OGG, FLAC</p>
              </div>
            </div>
          </div>
        )}

        {/* File info - visible when file selected */}
        {file && pageState !== 'idle' && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="p-2 rounded-lg bg-brand/10">
              <FileAudio className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
              <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
            </div>
            {pageState !== 'transcribing' && pageState !== 'uploading' && (
              <button
                onClick={handleReset}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Remover arquivo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Transcribe button */}
        {pageState === 'file_selected' && (
          <button
            onClick={handleTranscribe}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand/90 text-white font-medium transition-all shadow-lg shadow-brand/20"
          >
            <Play className="w-4 h-4" />
            Transcrever Áudio
          </button>
        )}

        {/* Progress states */}
        {(pageState === 'uploading' || pageState === 'transcribing') && (
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
            <div className="text-center">
              <p className="text-zinc-200 font-medium">
                {pageState === 'uploading' ? 'Enviando arquivo...' : 'Transcrevendo áudio...'}
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                {pageState === 'transcribing'
                  ? `Processando... ${formatElapsed(elapsed)}`
                  : 'Preparando arquivo para transcrição'}
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                Isso pode levar alguns minutos dependendo do tamanho do áudio.
              </p>
            </div>
          </div>
        )}

        {/* Done state */}
        {pageState === 'done' && resultText && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Transcrição concluída!
            </div>

            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-hidden">
              <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Prévia do texto</p>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{resultText}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand hover:bg-brand/90 text-white font-medium transition-all shadow-lg shadow-brand/20"
              >
                <Download className="w-4 h-4" />
                Baixar .docx
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Nova Transcrição
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {pageState === 'error' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
