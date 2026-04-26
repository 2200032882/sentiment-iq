import { Clipboard } from 'lucide-react'

function iconForRecommendation(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('consider') || lower.includes('harm') || lower.includes('negative')) return '⚠️'
  if (lower.includes('leverage') || lower.includes('continue') || lower.includes('balanced')) return '✅'
  return '💡'
}

export default function SummaryCard({ summary, recommendations, processingTime, totalComments }) {
  if (!summary) return <div className="text-sm text-slate-400">Data unavailable</div>

  const recs = Array.isArray(recommendations) ? recommendations : []
  const fullText = `${summary}\n\nRecommendations:\n${recs.map((r, i) => `${i + 1}. ${r}`).join('\n')}`

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">Executive Summary & Insights</h3>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(fullText)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>

      <blockquote className="rounded-xl border-l-4 border-indigo-400 bg-slate-900/40 p-4 text-sm italic text-slate-200">
        {summary}
      </blockquote>

      <div className="mt-4 space-y-2">
        {recs.map((rec, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-slate-900/35 p-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-xs font-semibold text-indigo-100">
                {idx + 1}
              </span>
              <div className="flex-1 text-sm text-slate-200">
                <span className="mr-2">{iconForRecommendation(rec)}</span>
                {rec}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-center text-xs text-slate-300">
        <div>
          <div className="text-slate-400">Processing</div>
          <div className="mt-1 font-semibold">{processingTime || 0}s</div>
        </div>
        <div>
          <div className="text-slate-400">Comments</div>
          <div className="mt-1 font-semibold">{totalComments || 0}</div>
        </div>
        <div>
          <div className="text-slate-400">Models</div>
          <div className="mt-1 font-semibold">VADER + HF</div>
        </div>
      </div>
    </div>
  )
}

