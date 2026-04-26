import { useEffect, useMemo, useState } from 'react'

function sentimentColor(label) {
  if (label === 'positive') return '#10b981'
  if (label === 'negative') return '#f43f5e'
  return '#94a3b8'
}

function scoreLabel(label) {
  if (!label) return 'Neutral'
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function OverallScoreCard({ overallSentiment, totalComments, platform, modelEnsemble }) {
  if (!overallSentiment) {
    return <div className="text-sm text-slate-400">Data unavailable</div>
  }

  const [progress, setProgress] = useState(0)
  const compound = Number(overallSentiment.compound_score ?? 0)
  const normalized = Math.max(0, Math.min(1, (compound + 1) / 2))
  const radius = 84
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)
  const label = overallSentiment.label || 'neutral'
  const color = sentimentColor(label)

  useEffect(() => {
    const id = setTimeout(() => setProgress(normalized), 120)
    return () => clearTimeout(id)
  }, [normalized])

  const mix = useMemo(() => {
    const vader = modelEnsemble?.vader || {}
    const roberta = modelEnsemble?.roberta || {}
    return {
      positive: ((vader.positive || 0) + (roberta.positive || 0)) / 2,
      negative: ((vader.negative || 0) + (roberta.negative || 0)) / 2,
      neutral: ((vader.neutral || 0) + (roberta.neutral || 0)) / 2
    }
  }, [modelEnsemble])

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} stroke="#1e293b" strokeWidth="14" fill="transparent" />
            <circle
              cx="100"
              cy="100"
              r={radius}
              stroke={color}
              strokeWidth="14"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 100 100)"
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-black" style={{ color }}>
              {compound > 0 ? '+' : ''}
              {compound.toFixed(2)}
            </div>
            <div className="mt-2 rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">
              {scoreLabel(label)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-100">Overall Sentiment Score</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-900/60 p-3">
            <div className="text-xs text-slate-400">Label</div>
            <div className="mt-1 text-sm font-semibold" style={{ color }}>
              {scoreLabel(label)}
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <div className="text-xs text-slate-400">Confidence</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {Math.round((overallSentiment.confidence || 0) * 100)}%
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <div className="text-xs text-slate-400">Comments</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{totalComments || 0}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <div className="text-xs text-slate-400">Platform</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{platform || 'Unknown'}</div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {[
            { key: 'positive', color: 'bg-emerald-400' },
            { key: 'negative', color: 'bg-rose-400' },
            { key: 'neutral', color: 'bg-slate-400' }
          ].map((item) => (
            <div key={item.key}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span className="capitalize">{item.key}</span>
                <span>{Math.round((mix[item.key] || 0) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(mix[item.key] || 0) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

