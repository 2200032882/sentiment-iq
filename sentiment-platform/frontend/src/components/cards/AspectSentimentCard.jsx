import { useMemo, useState } from 'react'

function sentimentClass(sentiment) {
  if (sentiment === 'positive') return 'bg-emerald-500/20 text-emerald-200'
  if (sentiment === 'negative') return 'bg-rose-500/20 text-rose-200'
  return 'bg-slate-600/30 text-slate-200'
}

function barClass(sentiment) {
  if (sentiment === 'positive') return 'bg-emerald-400'
  if (sentiment === 'negative') return 'bg-rose-400'
  return 'bg-slate-400'
}

export default function AspectSentimentCard({ aspectSentiments }) {
  const [sortBy, setSortBy] = useState('mentions')
  const [expanded, setExpanded] = useState({})

  const sorted = useMemo(() => {
    if (!Array.isArray(aspectSentiments)) return []
    const cloned = [...aspectSentiments]
    if (sortBy === 'score') {
      cloned.sort((a, b) => Math.abs(b.score || 0) - Math.abs(a.score || 0))
    } else {
      cloned.sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
    }
    return cloned
  }, [aspectSentiments, sortBy])

  if (!sorted.length) return <div className="text-sm text-slate-400">Data unavailable</div>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">Aspect-Based Sentiment</h3>
        <div className="flex rounded-lg border border-white/10 bg-slate-900/50 p-1 text-xs">
          {['mentions', 'score'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`rounded-md px-2 py-1 capitalize ${
                sortBy === key ? 'bg-indigo-500 text-white' : 'text-slate-400'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((item, idx) => {
          const width = Math.max(6, Math.min(100, Math.round(Math.abs(item.score || 0) * 100)))
          const open = expanded[idx]
          return (
            <div key={`${item.aspect}-${idx}`} className="rounded-xl border border-white/10 bg-slate-900/40">
              <div className="grid grid-cols-12 items-center gap-2 p-3">
                <div className="col-span-3 text-sm font-semibold capitalize text-slate-100">{item.aspect}</div>
                <div className="col-span-2">
                  <span className={`rounded-full px-2 py-1 text-xs capitalize ${sentimentClass(item.sentiment)}`}>
                    {item.sentiment}
                  </span>
                </div>
                <div className="col-span-4">
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${barClass(item.sentiment)}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
                <div className="col-span-2 text-center text-xs text-slate-300">{item.mention_count} mentions</div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    className="text-slate-400 hover:text-slate-100"
                  >
                    {open ? '−' : '+'}
                  </button>
                </div>
              </div>
              {open && (
                <div className="border-t border-white/10 p-3 text-sm text-slate-300">
                  {(item.example_comments || []).slice(0, 2).map((comment, cidx) => (
                    <p key={cidx} className="mb-2 rounded-lg bg-slate-950/50 p-2 last:mb-0">
                      {comment}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

