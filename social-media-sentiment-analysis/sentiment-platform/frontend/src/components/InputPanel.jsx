import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { History, Link as LinkIcon, Loader2, Sparkles, X } from 'lucide-react'

const depthOptions = [
  { id: 'quick', label: 'Quick', desc: 'VADER only (instant)' },
  { id: 'deep', label: 'Deep', desc: 'RoBERTa + VADER' }
]

const platformMeta = {
  youtube: { icon: '🔴', label: 'YouTube' },
  reddit: { icon: '🟠', label: 'Reddit' },
  twitter: { icon: '🔵', label: 'Twitter/X' }
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--'
  }
}

export default function InputPanel({ onAnalyze, status, history, onSelectHistory }) {
  const [url, setUrl] = useState('')
  const [commentCount, setCommentCount] = useState(50)
  const [depth, setDepth] = useState('deep')
  const [platformInfo, setPlatformInfo] = useState(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!url.trim()) {
      setPlatformInfo(null)
      return
    }

    let active = true
    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get('/api/platform-check', { params: { url }, timeout: 7000 })
        if (active) setPlatformInfo(data)
      } catch {
        if (active) setPlatformInfo({ valid: false, platform: 'unknown' })
      } finally {
        if (active) setChecking(false)
      }
    }, 500)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [url])

  const canAnalyze = useMemo(
    () => status !== 'loading' && Boolean(url.trim()) && platformInfo?.valid,
    [status, url, platformInfo]
  )

  const platformBadge = platformInfo?.valid ? platformMeta[platformInfo.platform] : null

  const handleAnalyze = () => {
    if (!canAnalyze) return
    onAnalyze({ url: url.trim(), commentCount, depth })
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-6 shadow-2xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-100">Analyze Content</h2>
        <p className="mt-1 text-sm text-slate-400">Paste a social URL and generate full sentiment intelligence.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-300">Content URL</label>
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube, Reddit, or Twitter URL..."
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-10 py-4 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
          />
          {url && (
            <button
              type="button"
              onClick={() => {
                setUrl('')
                setPlatformInfo(null)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
              aria-label="Clear URL"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 min-h-8">
          {checking && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Detecting platform...
            </div>
          )}
          {!checking && platformBadge && (
            <div className="animate-fade-in inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-900/20 px-3 py-1 text-xs text-emerald-300">
              <span>{platformBadge.icon}</span>
              <span>{platformBadge.label} detected</span>
            </div>
          )}
          {!checking && url && platformInfo && !platformInfo.valid && (
            <div className="animate-fade-in inline-flex rounded-lg border border-rose-400/20 bg-rose-900/20 px-3 py-1 text-xs text-rose-300">
              Unsupported URL
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">Comments to analyze</label>
          <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-200">{commentCount}</span>
        </div>
        <input
          type="range"
          min={10}
          max={200}
          step={10}
          value={commentCount}
          onChange={(e) => setCommentCount(Number(e.target.value))}
          className="w-full accent-indigo-400"
          style={{ accentColor: '#818cf8' }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {[25, 50, 100, 200].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCommentCount(v)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                commentCount === v ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-300">Analysis depth</label>
        <div className="grid gap-2">
          {depthOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDepth(option.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                depth === option.id
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/10 bg-slate-900/50 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="font-semibold">{option.label}</div>
              <div className="text-xs opacity-80">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canAnalyze}
        onClick={handleAnalyze}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
          !canAnalyze
            ? 'cursor-not-allowed bg-slate-700/70'
            : 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-purple-500 hover:brightness-110'
        } ${canAnalyze && status === 'idle' ? 'animate-pulse' : ''}`}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Analyze
          </>
        )}
      </button>

      {history.length > 0 && (
        <div className="mt-7 border-t border-white/10 pt-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <History className="h-4 w-4" />
            Recent Analyses
          </div>
          <div className="space-y-2">
            {history.slice(0, 5).map((item, idx) => {
              const meta = platformMeta[item.platform] || { icon: '🧩', label: item.platform || 'Unknown' }
              return (
                <button
                  key={`${item.url}-${idx}`}
                  type="button"
                  onClick={() => onSelectHistory(item)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-left hover:border-indigo-400/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-200">
                      {meta.icon} {item.title || 'Untitled content'}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(item.timestamp)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
