'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_KEY

export default function NewsReader({ newsItems, currentIndex, onIndexChange, dark = false }) {
  const [isPaused, setIsPaused]           = useState(false)
  const [isListening, setIsListening]     = useState(false)
  const [hasStarted, setHasStarted]       = useState(false)
  const [transcript, setTranscript]       = useState('')
  const [agentAnswer, setAgentAnswer]     = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isLoadingVoice, setIsLoadingVoice] = useState(false)

  const recognitionRef  = useRef(null)
  const isListeningRef  = useRef(false)
  const hasStartedRef   = useRef(false)
  const audioRef        = useRef(null)
  const audioBlobUrlRef = useRef(null)

  useEffect(() => { isListeningRef.current = isListening }, [isListening])
  useEffect(() => { hasStartedRef.current  = hasStarted  }, [hasStarted])

  // ── Google Neural2 TTS ──
  async function fetchGoogleTTS(text) {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-F',  // warm, clear, natural female voice
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.92,
            pitch: 1.0,
            effectsProfileId: ['headphone-class-device'],
          },
        }),
      }
    )
    if (!response.ok) throw new Error('Google TTS failed')
    const data = await response.json()
    const binary = atob(data.audioContent)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: 'audio/mp3' })
  }

  function cleanupAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null }
    if (audioBlobUrlRef.current) { URL.revokeObjectURL(audioBlobUrlRef.current); audioBlobUrlRef.current = null }
  }

  const speak = useCallback(async (text, onEnd) => {
    if (!text?.trim()) return
    cleanupAudio()
    setIsLoadingVoice(true)
    try {
      const blob = await fetchGoogleTTS(text)
      const url = URL.createObjectURL(blob)
      audioBlobUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.oncanplaythrough = () => { setIsLoadingVoice(false); audio.play() }
      audio.onended = () => { cleanupAudio(); if (onEnd) onEnd() }
      audio.onerror = () => { setIsLoadingVoice(false); cleanupAudio() }
    } catch (err) {
      console.error('Google TTS error:', err)
      setIsLoadingVoice(false)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    cleanupAudio()
    setIsLoadingVoice(false)
  }, [])

  useEffect(() => {
    if (hasStarted && !isPaused && newsItems?.[currentIndex]?.simplified_article) {
      speak(newsItems[currentIndex].simplified_article)
      document.getElementById(`article-${currentIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentIndex, hasStarted])

  const detectIntentLocally = (text) => {
    const t = text.toLowerCase().trim()
    if (!hasStartedRef.current && /\b(start|begin|play|read|let's go|lets go|yes|yeah|sure|okay|ok|yep|go ahead|read out|read the news|read news|read it|start reading)\b/.test(t)) return 'start'
    if (hasStartedRef.current && /\b(read out|read the news|read it|read this|read again)\b/.test(t)) return 'resume'
    if (/\b(next|forward|skip|after|move on)\b/.test(t)) return 'next'
    if (/\b(previous|back|before|prior|last one|go back)\b/.test(t)) return 'previous'
    if (/\b(stop|pause|hold|wait|freeze|quiet|enough)\b/.test(t)) return 'pause'
    if (/\b(resume|continue|go on|carry on|unpause|keep going)\b/.test(t)) return 'resume'
    if (/\b(what|why|how|when|who|where|explain|tell me|what is|what are|what does|what happened|what was|what will|can you|could you|define|meaning of|means)\b/.test(t) || t.endsWith('?')) return 'question'
    return 'ignore'
  }

  const handleCommand = useCallback(async (spokenText) => {
    if (!spokenText?.trim()) return
    const localIntent = detectIntentLocally(spokenText)
    if (localIntent === 'ignore') return

    if (localIntent === 'start') {
      setHasStarted(true); hasStartedRef.current = true
      setStatusMessage('Starting…')
      speak(newsItems[currentIndex]?.simplified_article ?? '')
      return
    }
    if (localIntent === 'next') {
      stopSpeaking(); setStatusMessage('Next article')
      setTimeout(() => onIndexChange(i => Math.min(i + 1, newsItems.length - 1)), 200)
      return
    }
    if (localIntent === 'previous') {
      stopSpeaking(); setStatusMessage('Previous article')
      setTimeout(() => onIndexChange(i => Math.max(i - 1, 0)), 200)
      return
    }
    if (localIntent === 'pause') {
      setIsPaused(true); stopSpeaking(); setStatusMessage('Paused'); return
    }
    if (localIntent === 'resume') {
      setIsPaused(false); setStatusMessage('Resuming…')
      speak(newsItems[currentIndex]?.simplified_article ?? ''); return
    }
    if (localIntent === 'question') {
      stopSpeaking(); setStatusMessage('Thinking…')
      try {
        const res = await fetch('/api/voice-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'question', text: spokenText, articleContext: newsItems[currentIndex]?.simplified_article }),
        })
        const data = await res.json()
        const answer = data.result ?? "I had trouble answering. Please try again."
        setAgentAnswer(answer); setStatusMessage('')
        speak(answer)
      } catch (e) {
        speak('Something went wrong. Please try again.'); setStatusMessage('')
      }
    }
  }, [currentIndex, newsItems, speak, stopSpeaking, onIndexChange])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Please use Chrome for speech recognition.'); return }
    if (isListeningRef.current) return
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text) { setTranscript(text); handleCommand(text) }
    }
    recognition.onerror = (e) => {
      if (e.error === 'no-speech' && isListeningRef.current) { try { recognition.start() } catch (_) {} }
      else if (e.error !== 'aborted') { setIsListening(false); isListeningRef.current = false }
    }
    recognition.onend = () => {
      if (isListeningRef.current) { try { recognition.start() } catch (_) {} }
    }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true); isListeningRef.current = true
  }, [handleCommand])

  const stopListening = useCallback(() => {
    isListeningRef.current = false; setIsListening(false)
    try { recognitionRef.current?.stop() } catch (_) {}
  }, [])

  // ── Styles ──
  const btnBase = {
    padding: '6px 14px', borderRadius: '99px',
    fontFamily: 'var(--font-ui)', fontSize: '12px',
    fontWeight: '500', cursor: 'pointer',
    transition: 'all 0.15s', letterSpacing: '0.02em',
    display: 'inline-flex', alignItems: 'center', gap: '5px',
  }
  const navBtn = {
    ...btnBase,
    border: `1px solid ${dark ? '#2C2822' : '#E0D8CF'}`,
    background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    color: dark ? '#A89880' : '#7A6B5A',
  }
  const voiceBtn = {
    ...btnBase,
    padding: '7px 16px', border: 'none',
    background: isListening ? '#DC2626' : (dark ? '#E8973E' : '#D4873C'),
    color: '#fff', fontWeight: '600',
    boxShadow: isListening ? '0 0 0 3px rgba(220,38,38,0.2)' : 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

      {/* Agent answer bubble */}
      {agentAnswer && (
        <div style={{
          background: dark ? 'rgba(232,151,62,0.1)' : 'rgba(212,135,60,0.08)',
          border: `1px solid ${dark ? 'rgba(232,151,62,0.25)' : 'rgba(212,135,60,0.25)'}`,
          borderRadius: '10px', padding: '9px 14px',
          color: dark ? '#F0EBE3' : '#1A1410',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}>
          <span>🤖</span>
          <span style={{ flex: 1, lineHeight: 1.5 }}>{agentAnswer}</span>
          <button onClick={() => setAgentAnswer('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#6B6055' : '#B8AFA3', fontSize: '13px', padding: '0' }}>✕</button>
        </div>
      )}

      {/* Status */}
      {(statusMessage || isLoadingVoice) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
          {isLoadingVoice && (
            <div style={{ width: '10px', height: '10px', border: '1.5px solid var(--border-accent)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
          {isLoadingVoice ? 'Preparing voice...' : `⏳ ${statusMessage}`}
        </div>
      )}

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button style={voiceBtn} onClick={() => {
          if (isListeningRef.current) { stopListening(); return }
          if (!hasStartedRef.current) {
            speak('How can I help you?').then?.(() => startListening())
            setTimeout(() => startListening(), 2000)
          } else { startListening() }
        }}>
          {isListening ? '🎙️ Listening…' : '🎤 Voice Agent'}
        </button>

        <button style={navBtn} onClick={() => { stopSpeaking(); onIndexChange(i => Math.max(i - 1, 0)) }}>◀ Prev</button>

        <button style={navBtn} onClick={() => {
          if (isPaused) { setIsPaused(false); speak(newsItems[currentIndex]?.simplified_article ?? '') }
          else { setIsPaused(true); stopSpeaking() }
        }}>
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button style={navBtn} onClick={() => { stopSpeaking(); onIndexChange(i => Math.min(i + 1, newsItems.length - 1)) }}>Next ▶</button>

        <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', color: dark ? '#4A4438' : '#C4B9AE', letterSpacing: '0.04em' }}>
          Article {currentIndex + 1} of {newsItems.length}
        </span>
      </div>

      {/* Transcript */}
      {transcript && (
        <span style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
          🎤 "{transcript}"
        </span>
      )}

      {/* Hint */}
      <p style={{ fontSize: '11px', color: dark ? '#3C3530' : '#C4B9AE', fontFamily: 'var(--font-ui)', margin: 0 }}>
        {hasStarted ? 'Say: "Next", "Previous", "Pause", "Resume", or ask a question' : 'Click Voice Agent — say "Read out the news" to start'}
      </p>
    </div>
  )
}