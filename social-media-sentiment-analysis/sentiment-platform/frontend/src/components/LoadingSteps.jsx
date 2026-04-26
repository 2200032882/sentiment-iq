import { Loader2 } from 'lucide-react'

function truncateUrl(url) {
  if (!url) return 'Preparing request...'
  return url.length > 70 ? `${url.slice(0, 67)}...` : url
}

function detectPlatform(url) {
  const lower = (url || '').toLowerCase()
  if (lower.includes('youtu')) return { icon: '🔴', name: 'YouTube' }
  if (lower.includes('reddit')) return { icon: '🟠', name: 'Reddit' }
  if (lower.includes('twitter.com') || lower.includes('x.com')) return { icon: '🔵', name: 'Twitter/X' }
  return { icon: '⚪', name: 'Detecting' }
}

export default function LoadingSteps({ steps, currentStep, url, commentCount }) {
  const progress = Math.min(100, Math.round((currentStep / steps.length) * 100))
  const platform = detectPlatform(url)

  return (
    <div className="animate-fade-in mx-auto mt-8 max-w-3xl">
      <div className="glass rounded-3xl border border-white/10 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-100">
            Analyzing Content<span className="animate-pulse">...</span>
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            <span className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1">
              {platform.icon} {platform.name}
            </span>{' '}
            <span className="ml-2">{truncateUrl(url)}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Target comments: {commentCount || 'Auto'} </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep
            const isCurrent = idx === currentStep
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isCompleted
                    ? 'border-emerald-400/30 bg-emerald-900/20 opacity-100'
                    : isCurrent
                    ? 'scale-[1.01] border-indigo-400/40 bg-indigo-900/20 opacity-100'
                    : 'border-white/10 bg-slate-900/30 opacity-60'
                }`}
              >
                <div className="w-6 text-center text-lg">
                  {isCompleted ? (
                    '✅'
                  ) : isCurrent ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin text-indigo-300" />
                  ) : (
                    '⚪'
                  )}
                </div>
                <div className="flex-1">
                  <span className="mr-2">{step.icon}</span>
                  <span className="text-sm font-medium text-slate-100">{step.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          This may take 30-90 seconds for HuggingFace model warm-up.
        </p>
      </div>
    </div>
  )
}

