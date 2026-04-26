import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Activity, RadioTower } from 'lucide-react'
import { useAnalysis } from './hooks/useAnalysis'
import InputPanel from './components/InputPanel'
import Dashboard from './components/Dashboard'
import LoadingSteps from './components/LoadingSteps'

const badgeByPlatform = [
  { name: 'YouTube', icon: '🔴' },
  { name: 'Reddit', icon: '🟠' },
  { name: 'Twitter/X', icon: '🔵' }
]

function PlatformCard({ title, icon, text }) {
  return (
    <div className="glass rounded-2xl p-5 shadow-xl transition hover:-translate-y-1 hover:border-indigo-300/40">
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  )
}

export default function App() {
  const analysis = useAnalysis()
  const [health, setHealth] = useState({ status: 'unknown', timestamp: null })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const { data } = await axios.get('/api/health', { timeout: 7000 })
        if (mounted) setHealth({ status: data.status || 'ok', timestamp: data.timestamp || null })
      } catch {
        if (mounted) setHealth({ status: 'down', timestamp: null })
      }
    }

    run()
    const interval = setInterval(run, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const healthColor = useMemo(() => (health.status === 'ok' ? 'bg-emerald-400' : 'bg-rose-500'), [health.status])

  return (
    <div className="min-h-screen text-slate-100">
      <header className="glass sticky top-0 z-30 border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <h1 className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-emerald-300 bg-clip-text text-3xl font-extrabold text-transparent">
              🧠 SentimentIQ
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI-Powered Social Sentiment</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 md:flex">
              {badgeByPlatform.map((item) => (
                <span key={item.name} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-200">
                  {item.icon} {item.name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${healthColor}`} />
              <Activity className="h-4 w-4 text-slate-300" />
              <span className="text-slate-300">{health.status === 'ok' ? 'API Healthy' : 'API Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-86px)] max-w-[1600px] gap-6 px-4 py-5 md:px-6">
        <aside className="w-full shrink-0 overflow-y-auto md:w-[320px]">
          <InputPanel
            onAnalyze={analysis.analyze}
            status={analysis.status}
            history={analysis.history}
            onSelectHistory={analysis.loadFromHistory}
          />
        </aside>

        <section className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:p-6">
          {analysis.status === 'loading' && (
            <LoadingSteps
              steps={analysis.steps}
              currentStep={analysis.currentStep}
              url={analysis.activeRequest?.url || ''}
              commentCount={analysis.activeRequest?.commentCount || 0}
            />
          )}

          {analysis.status === 'error' && (
            <div className="animate-fade-in mx-auto mt-24 max-w-2xl rounded-2xl border border-rose-400/30 bg-rose-950/30 p-8 text-center">
              <RadioTower className="mx-auto h-10 w-10 text-rose-300" />
              <h3 className="mt-4 text-xl font-semibold">Analysis failed</h3>
              <p className="mt-2 text-slate-300">{analysis.error}</p>
              <button
                type="button"
                onClick={analysis.reset}
                className="mt-5 rounded-xl border border-white/15 bg-slate-900/70 px-4 py-2 text-sm hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
          )}

          {analysis.status === 'success' && analysis.result && <Dashboard result={analysis.result} />}

          {analysis.status === 'idle' && (
            <div className="animate-fade-in flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
              <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 via-indigo-400/10 to-emerald-400/20 shadow-2xl ring-1 ring-indigo-300/20">
                <span className="text-5xl">🧠</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-100">Paste a URL to begin analysis</h2>
              <p className="mt-3 max-w-2xl text-slate-400">
                Analyze sentiment, emotion, toxicity, aspects, intent, and thematic trends from social conversations in
                one run.
              </p>
              <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
                <PlatformCard
                  title="YouTube Comments"
                  icon="🔴"
                  text="Extract top comments without API keys and score audience reaction instantly."
                />
                <PlatformCard
                  title="Reddit Threads"
                  icon="🟠"
                  text="Flatten nested discussions and detect sentiment by aspects and intent."
                />
                <PlatformCard
                  title="Twitter/X Threads"
                  icon="🔵"
                  text="Use resilient Nitter scraping fallback for tweet and reply sentiment mapping."
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
