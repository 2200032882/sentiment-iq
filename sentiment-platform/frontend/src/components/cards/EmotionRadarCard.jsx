import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'

const emotionIcons = {
  joy: '😊',
  anger: '😠',
  fear: '😨',
  sadness: '😢',
  surprise: '😲',
  disgust: '🤢',
  trust: '🤝'
}

export default function EmotionRadarCard({ emotionDistribution }) {
  if (!emotionDistribution || Object.keys(emotionDistribution).length === 0) {
    return <div className="text-sm text-slate-400">Data unavailable</div>
  }

  const keys = ['joy', 'anger', 'fear', 'sadness', 'surprise', 'disgust', 'trust']
  const data = keys.map((key) => ({
    emotion: key,
    score: Math.round((emotionDistribution[key] || 0) * 100)
  }))
  const dominant = data.sort((a, b) => b.score - a.score)[0] || { emotion: 'trust', score: 0 }

  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-100">Emotion Analysis</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="emotion" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
          <Radar dataKey="score" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>

      <div className="mt-3 rounded-xl border border-indigo-300/20 bg-indigo-900/20 p-3 text-center">
        <div className="text-2xl">{emotionIcons[dominant.emotion] || '🎭'}</div>
        <div className="text-sm font-semibold capitalize text-indigo-100">{dominant.emotion}</div>
        <div className="text-xs text-indigo-200">{dominant.score}% dominant</div>
      </div>

      <div className="mt-4 space-y-2">
        {keys.map((emotion) => {
          const score = Math.round((emotionDistribution[emotion] || 0) * 100)
          return (
            <div key={emotion}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {emotionIcons[emotion]} {emotion}
                </span>
                <span>{score}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${score}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

