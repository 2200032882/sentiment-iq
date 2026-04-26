import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function trendSummary(data) {
  if (!Array.isArray(data) || data.length < 2) return { icon: '→', text: 'Insufficient trend data.' }
  const first = (data[0].positive || 0) - (data[0].negative || 0)
  const last = (data[data.length - 1].positive || 0) - (data[data.length - 1].negative || 0)
  const delta = last - first
  if (delta > 0.05) return { icon: '↑', text: 'Sentiment is trending more positive over time.' }
  if (delta < -0.05) return { icon: '↓', text: 'Sentiment is trending more negative over time.' }
  return { icon: '→', text: 'Sentiment is relatively stable over time.' }
}

export default function TemporalTrendCard({ temporalTrend }) {
  if (!Array.isArray(temporalTrend) || temporalTrend.length === 0) {
    return <div className="text-sm text-slate-400">Data unavailable</div>
  }

  const trend = trendSummary(temporalTrend)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-100">Sentiment Over Time</h3>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
          {trend.icon} trend
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={temporalTrend}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="bucket" stroke="#94a3b8" />
          <YAxis domain={[0, 1]} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px'
            }}
          />
          <Area type="monotone" dataKey="positive" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
          <Area type="monotone" dataKey="neutral" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
          <Area type="monotone" dataKey="negative" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.4} />
        </AreaChart>
      </ResponsiveContainer>

      <p className="mt-3 text-sm text-slate-300">{trend.text}</p>
    </div>
  )
}

