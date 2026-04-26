import { useMemo, useState } from 'react'
import { Download, FileText, User } from 'lucide-react'
import { jsPDF } from 'jspdf'
import OverallScoreCard from './cards/OverallScoreCard'
import ModelEnsembleCard from './cards/ModelEnsembleCard'
import EmotionRadarCard from './cards/EmotionRadarCard'
import ToxicityCard from './cards/ToxicityCard'
import AspectSentimentCard from './cards/AspectSentimentCard'
import TemporalTrendCard from './cards/TemporalTrendCard'
import IntentCard from './cards/IntentCard'
import TopCommentsCard from './cards/TopCommentsCard'
import KeyThemesCard from './cards/KeyThemesCard'
import SummaryCard from './cards/SummaryCard'

function CardShell({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-card p-6 shadow-lg ${className}`}>{children}</div>
  )
}

function sanitizeFilename(value) {
  return String(value || 'analysis')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function titleCase(value) {
  const str = String(value || '').trim()
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : 'Unknown'
}

function toPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`
}

function toFixed(value, digits = 2) {
  return (Number(value) || 0).toFixed(digits)
}

function platformBadge(platform) {
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'reddit') return 'Reddit'
  if (platform === 'twitter') return 'Twitter/X'
  return 'Unknown'
}

export default function Dashboard({ result }) {
  const [exportState, setExportState] = useState('')
  if (!result) return null

  const fileBase = useMemo(() => {
    const title = sanitizeFilename(result.content_title || result.platform || 'analysis')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `sentimentiq-${title}-${timestamp}`
  }, [result.content_title, result.platform])

  const showExportState = (message) => {
    setExportState(message)
    setTimeout(() => setExportState(''), 2800)
  }

  const handleExportJson = () => {
    try {
      const payload = JSON.stringify(result, null, 2)
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
      downloadBlob(blob, `${fileBase}.json`)
      showExportState('JSON exported')
    } catch {
      showExportState('JSON export failed')
    }
  }

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const marginX = 14
      const marginTop = 14
      const marginBottom = 14
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const maxWidth = pageWidth - marginX * 2
      let y = marginTop

      const ensureSpace = (space = 6) => {
        if (y + space > pageHeight - marginBottom) {
          doc.addPage()
          y = marginTop
        }
      }

      const addText = (text, options = {}) => {
        const { size = 11, style = 'normal', color = [15, 23, 42], lineHeight = 5 } = options
        doc.setFont('helvetica', style)
        doc.setFontSize(size)
        doc.setTextColor(color[0], color[1], color[2])
        const lines = doc.splitTextToSize(String(text || ''), maxWidth)
        lines.forEach((line) => {
          ensureSpace(lineHeight)
          doc.text(line, marginX, y)
          y += lineHeight
        })
      }

      const addSection = (title) => {
        y += 1
        ensureSpace(8)
        doc.setDrawColor(129, 140, 248)
        doc.setLineWidth(0.4)
        doc.line(marginX, y, marginX + maxWidth, y)
        y += 4
        addText(title, { size: 13, style: 'bold', color: [30, 41, 59], lineHeight: 6 })
      }

      addText('SentimentIQ Analysis Report', { size: 18, style: 'bold', color: [30, 64, 175], lineHeight: 8 })
      addText(result.content_title || 'Untitled Content', { size: 12, style: 'bold', lineHeight: 6 })
      addText(
        `Platform: ${titleCase(result.platform)} | Author: ${result.author || 'Unknown'} | Comments: ${
          result.total_comments_analyzed || 0
        } | Processing: ${toFixed(result.processing_time_seconds)}s`,
        { size: 10, color: [71, 85, 105], lineHeight: 5 }
      )
      addText(`Generated: ${new Date().toLocaleString()} | URL: ${result.content_url || '-'}`, {
        size: 9,
        color: [100, 116, 139],
        lineHeight: 4.5
      })

      addSection('Overall Sentiment')
      addText(
        `Label: ${titleCase(result.overall_sentiment?.label)} | Confidence: ${toPercent(
          result.overall_sentiment?.confidence
        )} | Compound Score: ${toFixed(result.overall_sentiment?.compound_score)}`
      )

      addSection('Summary')
      addText(result.summary || 'No summary available.', { lineHeight: 5.2 })

      addSection('Emotion Distribution')
      const emotionEntries = Object.entries(result.emotion_distribution || {})
      if (emotionEntries.length === 0) {
        addText('No emotion data available.')
      } else {
        emotionEntries.forEach(([name, score]) => {
          addText(`${titleCase(name)}: ${toPercent(score)}`, { lineHeight: 4.8 })
        })
      }

      addSection('Intent Breakdown')
      const intentEntries = Object.entries(result.intent_breakdown || {})
      if (intentEntries.length === 0) {
        addText('No intent data available.')
      } else {
        intentEntries.forEach(([name, score]) => {
          addText(`${titleCase(name)}: ${toPercent(score)}`, { lineHeight: 4.8 })
        })
      }

      addSection('Toxicity')
      addText(
        `Average Score: ${toFixed(result.toxicity?.average_score)} | Toxic Comment %: ${toFixed(
          result.toxicity?.toxic_comment_percentage
        )}%`
      )
      if (result.toxicity?.most_toxic_comment?.text) {
        const toxic = result.toxicity.most_toxic_comment
        addText(
          `Most Toxic Comment (${toPercent(toxic.score)} by ${toxic.author || 'Unknown'}): ${toxic.text}`,
          { lineHeight: 5 }
        )
      }

      addSection('Top Aspects')
      const aspectRows = Array.isArray(result.aspect_sentiments) ? result.aspect_sentiments.slice(0, 10) : []
      if (aspectRows.length === 0) {
        addText('No aspect data available.')
      } else {
        aspectRows.forEach((row, index) => {
          addText(
            `${index + 1}. ${titleCase(row.aspect)} | ${titleCase(row.sentiment)} | Score ${toFixed(
              row.score
            )} | Mentions ${row.mention_count || 0}`,
            { lineHeight: 4.8 }
          )
        })
      }

      addSection('Recommendations')
      const recommendationRows = Array.isArray(result.recommendations) ? result.recommendations : []
      if (recommendationRows.length === 0) {
        addText('No recommendations available.')
      } else {
        recommendationRows.forEach((item, index) => {
          addText(`${index + 1}. ${item}`, { lineHeight: 5 })
        })
      }

      addSection('Top Comments (Impactful)')
      const impactful = result.top_comments?.most_impactful || []
      if (!impactful.length) {
        addText('No notable comments available.')
      } else {
        impactful.slice(0, 3).forEach((comment, index) => {
          addText(
            `${index + 1}. (${toFixed(comment.compound)}) ${comment.author || 'Unknown'}: ${
              comment.text || ''
            }`,
            { lineHeight: 5 }
          )
        })
      }

      doc.save(`${fileBase}.pdf`)
      showExportState('PDF exported')
    } catch {
      showExportState('PDF export failed')
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="glass rounded-2xl border border-white/10 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1 text-xs text-slate-300">
              {platformBadge(result.platform)}
            </div>
            <h2 className="text-xl font-bold text-slate-100">{result.content_title || 'Untitled Content'}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {result.author || 'Unknown author'}
              </span>
              <span>{result.total_comments_analyzed || 0} comments</span>
              <span>{result.processing_time_seconds || 0}s processing</span>
              <span>{new Date(result.extraction_timestamp).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300/30 bg-indigo-500/20 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-500/30"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
            {exportState ? <span className="text-xs text-slate-300">{exportState}</span> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <CardShell className="lg:col-span-12">
          <OverallScoreCard
            overallSentiment={result.overall_sentiment}
            totalComments={result.total_comments_analyzed}
            platform={result.platform}
            modelEnsemble={result.model_ensemble}
          />
        </CardShell>

        <CardShell className="lg:col-span-8">
          <ModelEnsembleCard modelEnsemble={result.model_ensemble} />
        </CardShell>
        <CardShell className="lg:col-span-4">
          <EmotionRadarCard emotionDistribution={result.emotion_distribution} />
        </CardShell>

        <CardShell className="lg:col-span-4">
          <ToxicityCard toxicity={result.toxicity} />
        </CardShell>
        <CardShell className="lg:col-span-4">
          <IntentCard intentBreakdown={result.intent_breakdown} />
        </CardShell>
        <CardShell className="lg:col-span-4">
          <TemporalTrendCard temporalTrend={result.temporal_trend} />
        </CardShell>

        <CardShell className="lg:col-span-6">
          <AspectSentimentCard aspectSentiments={result.aspect_sentiments} />
        </CardShell>
        <CardShell className="lg:col-span-6">
          <TopCommentsCard topComments={result.top_comments} platform={result.platform} />
        </CardShell>

        <CardShell className="lg:col-span-6">
          <KeyThemesCard keyThemes={result.key_themes} wordFrequency={result.word_frequency} />
        </CardShell>
        <CardShell className="lg:col-span-6">
          <SummaryCard
            summary={result.summary}
            recommendations={result.recommendations}
            processingTime={result.processing_time_seconds}
            totalComments={result.total_comments_analyzed}
          />
        </CardShell>
      </div>
    </div>
  )
}

