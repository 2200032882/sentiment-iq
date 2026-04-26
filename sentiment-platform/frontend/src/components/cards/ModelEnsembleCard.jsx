import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Info } from 'lucide-react'

function dominant(model) {
  if (!model) return { label: 'unknown', score: 0 }
  const entries = Object.entries(model).filter(([k]) => k !== 'compound')
  if (!entries.length) return { label: 'unknown', score: 0 }
  const [label, score] = entries.sort((a, b) => b[1] - a[1])[0]
  return { label, score }
}

export default function ModelEnsembleCard({ modelEnsemble }) {
  if (!modelEnsemble) return <div className="text-sm text-slate-400">Data unavailable</div>

  const data = [
    {
      model: 'VADER',
      positive: modelEnsemble.vader?.positive || 0,
      neutral: modelEnsemble.vader?.neutral || 0,
      negative: modelEnsemble.vader?.negative || 0
    },
    {
      model: 'RoBERTa',
      positive: modelEnsemble.roberta?.positive || 0,
      neutral: modelEnsemble.roberta?.neutral || 0,
      negative: modelEnsemble.roberta?.negative || 0
    },
    {
      model: 'DistilBERT',
      positive: modelEnsemble.distilbert?.positive || 0,
      neutral: 0,
      negative: modelEnsemble.distilbert?.negative || 0
    }
  ]

  const dom = {
    VADER: dominant(modelEnsemble.vader),
    RoBERTa: dominant(modelEnsemble.roberta),
    DistilBERT: dominant(modelEnsemble.distilbert)
  }
  const labels = [dom.VADER.label, dom.RoBERTa.label, dom.DistilBERT.label]
  const consensus = labels.every((l) => l === labels[0])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-100">Model Ensemble Comparison</h3>
          <div className="group relative">
            <Info className="h-4 w-4 text-slate-400" />
            <div className="pointer-events-none absolute left-5 top-0 hidden w-56 rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-slate-300 group-hover:block">
              Shows model-level sentiment probabilities to compare agreement and divergence.
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            consensus ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'
          }`}
        >
          {consensus ? '✓ High Consensus' : '~ Mixed Signals'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barGap={6}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="model" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" domain={[0, 1]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
            formatter={(value) => `${Math.round(value * 100)}%`}
          />
          <Bar dataKey="positive" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="neutral" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="negative" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {Object.entries(dom).map(([name, val]) => (
          <div key={name} className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
            <div className="text-xs text-slate-400">{name}</div>
            <div className="mt-1 text-sm font-semibold capitalize text-slate-100">
              {val.label} ({Math.round((val.score || 0) * 100)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

