import { useState } from 'react'

function ringColor(value) {
  if (value < 10) return '#10b981'
  if (value <= 30) return '#f59e0b'
  return '#f43f5e'
}

export default function ToxicityCard({ toxicity }) {
  const [revealed, setRevealed] = useState(false)

  if (!toxicity) return <div className="text-sm text-slate-400">Data unavailable</div>

  const percentage = Number(toxicity.toxic_comment_percentage || 0)
  const ring = ringColor(percentage)
  const severity = toxicity.severity_breakdown || {}
  const toxicComment = toxicity.most_toxic_comment

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-100">☣️ Toxicity Analysis</h3>

      <div className="mx-auto mb-5 flex h-36 w-36 items-center justify-center rounded-full border-8" style={{ borderColor: ring }}>
        <div className="text-center">
          <div className="text-2xl font-black" style={{ color: ring }}>
            {percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400">toxic comments</div>
        </div>
      </div>

      <div className="space-y-2">
        {[
          ['clean', 'bg-emerald-400'],
          ['mild', 'bg-yellow-400'],
          ['moderate', 'bg-orange-400'],
          ['severe', 'bg-rose-500']
        ].map(([name, color]) => {
          const value = Number(severity[name] || 0)
          return (
            <div key={name}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span className="capitalize">{name}</span>
                <span>{value.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {toxicComment?.text && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900/50 p-3 text-left"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Most toxic comment</span>
            <span className="rounded-full bg-rose-500/20 px-2 py-1 text-rose-200">
              {Math.round((toxicComment.score || 0) * 100)}%
            </span>
          </div>
          <p
            className="text-sm text-slate-200 transition"
            style={{
              filter: revealed ? 'none' : 'blur(4px)',
              userSelect: revealed ? 'text' : 'none'
            }}
          >
            {toxicComment.text}
          </p>
          {!revealed && <div className="mt-2 text-xs text-slate-400">Click to reveal</div>}
        </button>
      )}
    </div>
  )
}

