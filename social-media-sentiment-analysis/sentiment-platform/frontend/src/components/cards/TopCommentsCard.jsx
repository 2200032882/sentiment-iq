import { useMemo, useState } from 'react'

const tabs = [
  { id: 'most_positive', label: '👍 Most Positive' },
  { id: 'most_negative', label: '👎 Most Negative' },
  { id: 'most_impactful', label: '🔥 Most Impactful' }
]

function platformIcon(platform) {
  if (platform === 'youtube') return '🔴'
  if (platform === 'reddit') return '🟠'
  if (platform === 'twitter') return '🔵'
  return '⚪'
}

function sentimentTint(label) {
  if (label === 'positive') return 'bg-emerald-500/10 border-emerald-500/20'
  if (label === 'negative') return 'bg-rose-500/10 border-rose-500/20'
  return 'bg-slate-700/20 border-white/10'
}

export default function TopCommentsCard({ topComments, platform }) {
  const [active, setActive] = useState('most_positive')
  const [expanded, setExpanded] = useState({})

  const comments = useMemo(() => {
    if (!topComments) return []
    return topComments[active] || []
  }, [topComments, active])

  if (!topComments) return <div className="text-sm text-slate-400">Data unavailable</div>

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-100">Notable Comments</h3>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-lg px-3 py-2 text-xs transition ${
              active === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {comments.slice(0, 5).map((comment, idx) => {
          const key = `${active}-${idx}`
          const isOpen = expanded[key]
          const author = comment.author || 'Unknown'
          return (
            <div
              key={key}
              className={`animate-fade-in rounded-xl border p-3 transition ${sentimentTint(comment.sentiment_label)}`}
            >
              <div className="mb-2 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 font-semibold text-indigo-100">
                  {author.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs text-slate-400">{author}</div>
                  <p
                    className="text-sm text-slate-200"
                    style={
                      isOpen
                        ? {}
                        : {
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }
                    }
                  >
                    {comment.text}
                  </p>
                  {comment.text?.length > 140 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="mt-1 text-xs text-indigo-300 hover:text-indigo-200"
                    >
                      {isOpen ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-slate-900/60 px-2 py-1">
                  score {Number(comment.compound || 0).toFixed(2)}
                </span>
                <span className="rounded-full bg-slate-900/60 px-2 py-1">❤ {comment.likes || comment.score || 0}</span>
                <span className="rounded-full bg-slate-900/60 px-2 py-1">
                  {platformIcon(platform)} {platform}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

