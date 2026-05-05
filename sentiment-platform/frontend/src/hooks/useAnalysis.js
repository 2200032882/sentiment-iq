import { useCallback, useState } from 'react'
import axios from 'axios'

const API_BASE = 'https://sentiment-iq-owur.onrender.com/api'

export function useAnalysis() {
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [activeRequest, setActiveRequest] = useState({ url: '', commentCount: 50, depth: 'deep' })

  const STEPS = [
    { label: 'Detecting platform', icon: '🔍' },
    { label: 'Extracting comments', icon: '💬' },
    { label: 'Running sentiment models', icon: '🧠' },
    { label: 'Analyzing emotions', icon: '😊' },
    { label: 'Scoring toxicity', icon: '☣️' },
    { label: 'Detecting aspects & themes', icon: '🎯' },
    { label: 'Generating insights', icon: '📊' }
  ]

  const analyze = useCallback(async ({ url, commentCount, depth }) => {
    setActiveRequest({ url, commentCount, depth })
    setStatus('loading')
    setError(null)
    setResult(null)
    setCurrentStep(0)

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1
        clearInterval(stepInterval)
        return prev
      })
    }, 1800)

    try {
      const response = await axios.post(
        `${API_BASE}/analyze`,
        { url, comment_count: commentCount, depth },
        { timeout: 300000 }
      )

      clearInterval(stepInterval)
      setCurrentStep(STEPS.length)
      setResult(response.data)
      setStatus('success')

      setHistory((prev) => [
        {
          url,
          title: response.data.content_title,
          platform: response.data.platform,
          timestamp: new Date().toISOString(),
          result: response.data
        },
        ...prev.slice(0, 4)
      ])
    } catch (err) {
      clearInterval(stepInterval)
      const message = err.response?.data?.detail || err.message || 'Analysis failed'
      setError(message)
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
    setCurrentStep(0)
  }, [])

  const loadFromHistory = useCallback((entry) => {
    if (!entry?.result) return
    setResult(entry.result)
    setError(null)
    setStatus('success')
    setCurrentStep(STEPS.length)
  }, [])

  return {
    status,
    result,
    error,
    history,
    currentStep,
    activeRequest,
    steps: STEPS,
    analyze,
    reset,
    loadFromHistory
  }
}
