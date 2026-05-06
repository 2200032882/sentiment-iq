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
  if (!ts) return '--'
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--'
  }
}

export default function InputPanel({ onAnalyze, status, history = [], onSelectHistory }) {
  const [url, setUrl] = useState('')
  const [commentCount, setCommentCount] = useState(50)
  const [depth, setDepth] = useState('deep')
  const [platformInfo, setPlatformInfo] = useState(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    // Reset state immediately when URL is cleared
    if (!url.trim()) {
      setPlatformInfo(null)
      setChecking(false)
      return
    }

    let active = true
    setChecking(true)

    // Debounce the API call to prevent spamming the backend
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get('/api/platform-check', { 
          params: { url }, 
          timeout: 7000 
        })
        
        if (active) {
          setPlatformInfo(data)
          setChecking(false)
        }
      } catch (err) {
        if (active) {
          setPlatformInfo({ valid: false, platform: 'unknown' })
          setChecking(false)
        }
      }
    }, 600) // Slightly longer debounce for better UX

    return () => {
      active = false
      clearTimeout(timer) // CRITICAL: Clear the timeout on cleanup
    }
  }, [url])

  const canAnalyze = useMemo(
  () => status !== 'loading' && Boolean(url.trim()),
  [status, url]
)

  const platformBadge = platformInfo?.valid ? platformMeta[platformInfo.platform] : null

  const handleAnalyze = () => {
    if (!canAnalyze) return
    onAnalyze({ url: url.trim(), commentCount, depth })
  }

  const handleClear = () => {
    setUrl('')
    setPlatformInfo(null)
    setChecking(false)
  }

  return (
    <div className="glass rounded-2xl border border-white/10 p-6 shadow-2xl bg-slate-900/40 backdrop-blur-md">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-100">Analyze Content</h2>
        <p className="mt-1 text-sm text-slate-400">Paste a social URL and generate full sentiment intelligence.</p>
      </div>

      <div className="space-y-4">
        {/* URL Input */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Content URL</label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube, Reddit, or Twitter URL..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-10 py-4 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50"
            />
            {url && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-2 min-h-[32px]">
            {checking && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-1 text-xs text-slate-300 w-fit animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Detecting platform...
              </div>
            )}
            {!checking && platformBadge && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-900/30 px-3 py-1 text-xs text-emerald-300 transition-all">
                <span>{platformBadge.icon}</span>
                <span>{platformBadge.label} detected</span>
              </div>
            )}
          </div>
        </div>

        {/* Comment Slider */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">Comments to analyze</label>
            <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs font-bold text-indigo-300">
              {commentCount}
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={200}
            step={10}
            value={commentCount}
            onChange={(e) => setCommentCount(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-indigo-500"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {[25, 50, 100, 200].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCommentCount(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  commentCount === v 
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Analysis Depth */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-slate-300">Analysis depth</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {depthOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDepth(option.id)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  depth === option.id
                    ? 'border-indigo-400 bg-indigo-500/10 text-indigo-100 ring-1 ring-indigo-400/30'
                    : 'border-white/5 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-60">{option.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          disabled={!canAnalyze}
          onClick={handleAnalyze}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold text-white transition-all ${
            !canAnalyze
              ? 'cursor-not-allowed bg-slate-800 text-slate-500 border border-white/5'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-indigo-500/20'
          } ${canAnalyze && status === 'idle' ? 'animate-pulse' : ''}`}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Intelligence
            </>
          )}
        </button>

        {/* History Section */}
        {history?.length > 0 && (
          <div className="mt-8 border-t border-white/5 pt-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <History className="h-4 w-4 text-indigo-400" />
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
                    className="group w-full rounded-xl border border-white/5 bg-slate-900/30 px-3 py-3 text-left transition-all hover:border-indigo-500/30 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-sm">{meta.icon}</span>
                        <span className="truncate text-sm text-slate-300 group-hover:text-slate-100">
                          {item.title || 'Untitled Report'}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-slate-500">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}