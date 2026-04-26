import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const palette = {
  praise: '#10b981',
  complaint: '#f43f5e',
  question: '#3b82f6',
  suggestion: '#8b5cf6',
  spam: '#f97316',
  neutral: '#94a3b8'
}

const icons = {
  praise: '👏',
  complaint: '⚠️',
  question: '❓',
  suggestion: '💡',
  spam: '🚫',
  neutral: '💬'
}

export default function IntentCard({ intentBreakdown }) {
  if (!intentBreakdown || Object.keys(intentBreakdown).length === 0) {
    return <div className="text-sm text-slate-400">Data unavailable</div>
  }

  const data = Object.entries(intentBreakdown).map(([name, value]) => ({
    name,
    value: Number(value || 0)
  }))
  const dominant = data.sort((a, b) => b.value - a.value)[0] || { name: 'neutral', value: 0 }

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-100">Comment Intent Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            label={({ percent }) => `${Math.round(percent * 100)}%`}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={palette[entry.name] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${Math.round(value * 100)}%`, name]}
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {data.map((entry) => (
          <div key={entry.name} className="rounded-lg border border-white/10 bg-slate-900/40 px-2 py-1 text-slate-300">
            {icons[entry.name]} {entry.name}: {Math.round(entry.value * 100)}%
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-indigo-300/20 bg-indigo-900/20 p-3 text-center">
        <div className="text-xl">{icons[dominant.name]}</div>
        <div className="text-sm font-semibold capitalize text-indigo-100">{dominant.name}</div>
        <div className="text-xs text-indigo-200">Dominant intent</div>
      </div>
    </div>
  )
}

