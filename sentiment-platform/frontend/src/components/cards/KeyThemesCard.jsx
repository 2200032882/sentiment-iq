function sentimentBadge(sentiment) {
  if (sentiment === 'pos') return 'bg-emerald-500/20 text-emerald-200'
  if (sentiment === 'neg') return 'bg-rose-500/20 text-rose-200'
  return 'bg-slate-500/30 text-slate-200'
}

function rotationForWord(word) {
  let hash = 0
  for (let i = 0; i < word.length; i += 1) hash += word.charCodeAt(i)
  return (hash % 7) - 3
}

export default function KeyThemesCard({ keyThemes, wordFrequency }) {
  if (!Array.isArray(wordFrequency) || wordFrequency.length === 0) {
    return <div className="text-sm text-slate-400">Data unavailable</div>
  }

  const topWords = wordFrequency.slice(0, 20)
  const maxFreq = Math.max(...topWords.map((w) => w.frequency || 1), 1)
  const themeWords = (keyThemes || []).slice(0, 12)

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-100">Key Themes & Word Cloud</h3>
      <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-900/30 p-3">
        {themeWords.length === 0 && <span className="text-sm text-slate-400">Data unavailable</span>}
        {themeWords.map((theme) => {
          const wf = wordFrequency.find((w) => w.word === theme) || { frequency: 1, sentiment: 'neu' }
          const size = 12 + ((wf.frequency || 1) / maxFreq) * 12
          return (
            <span
              key={theme}
              className={`inline-flex rounded-full px-3 py-1 font-semibold ${sentimentBadge(wf.sentiment)}`}
              style={{ fontSize: `${size}px`, transform: `rotate(${rotationForWord(theme)}deg)` }}
            >
              {theme}
            </span>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-3 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span>Word</span>
          <span className="text-center">Frequency</span>
          <span className="text-right">Sentiment</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {topWords.map((row) => (
            <div key={row.word} className="grid grid-cols-3 border-t border-white/5 px-3 py-2 text-sm">
              <span className="truncate text-slate-200">{row.word}</span>
              <span className="text-center text-slate-300">{row.frequency}</span>
              <span className="text-right">
                <span className={`rounded-full px-2 py-1 text-xs ${sentimentBadge(row.sentiment)}`}>{row.sentiment}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

