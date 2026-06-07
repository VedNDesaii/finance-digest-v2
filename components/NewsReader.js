'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

export default function NewsReader({ newsItems, currentIndex, onIndexChange, dark = false }) {
  const [isPaused, setIsPaused]             = useState(false)
  const [isListening, setIsListening]       = useState(false)
  const [hasStarted, setHasStarted]         = useState(false)
  const [transcript, setTranscript]         = useState('')
  const [agentAnswer, setAgentAnswer]       = useState('')
  const [statusMessage, setStatusMessage]   = useState('')
  const [isSpeaking, setIsSpeaking]         = useState(false)

  const recognitionRef  = useRef(null)
  const isListeningRef  = useRef(false)
  const hasStartedRef   = useRef(false)
  const voiceRef        = useRef(null)
  const utteranceRef    = useRef(null)

  // ── Load best Apple voice ─────────────────────────────────────────────────
  useEffect(() => {
    function loadVoice() {
      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return
      const preferred = ['Samantha', 'Karen', 'Victoria', 'Moira', 'Tessa']
      let picked = null
      for (const name of preferred) {
        picked = voices.find(v => v.name === name)
        if (picked) break
      }
      if (!picked) {
        picked = voices.find(v => v.lang === 'en-US' && v.localService) ||
                 voices.find(v => v.lang.startsWith('en'))
      }
      voiceRef.current = picked || null
    }
    loadVoice()
    window.speechSynthesis.onvoiceschanged = loadVoice
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // ── Speak using Apple voice ───────────────────────────────────────────────
  const speak = useCallback((text, onEnd) => {
    if (!text?.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.rate   = 0.93
    utterance.pitch  = 1.0
    utterance.volume = 1.0
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => { setIsSpeaking(false); onEnd?.() }
    utterance.onerror = () => setIsSpeaking(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  // ── Auto-read when article changes ────────────────────────────────────────
  useEffect(() => {
    if (hasStarted && !isPaused && newsItems?.[currentIndex]?.simplified_article) {
      speak(newsItems[currentIndex].simplified_article)
      document.getElementById(`article-${currentIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentIndex, hasStarted])

  // ── Local intent detection ────────────────────────────────────────────────
  const detectIntent = (text) => {
    const t = text.toLowerCase().trim()
    if (!hasStartedRef.current && /\b(start|begin|play|read|yes|yeah|sure|okay|ok|go ahead|read out|read the news)\b/.test(t)) return 'start'
    if (hasStartedRef.current && /\b(read out|read the news|read it|read this|read again)\b/.test(t)) return 'resume'
    if (/\b(next|forward|skip|after|move on)\b/.test(t)) return 'next'
    if (/\b(previous|back|before|prior|last one|go back)\b/.test(t)) return 'previous'
    if (/\b(stop|pause|hold|wait|freeze|quiet|enough)\b/.test(t)) return 'pause'
    if (/\b(resume|continue|go on|carry on|unpause|keep going)\b/.test(t)) return 'resume'
    if (/\b(what|why|how|when|who|where|explain|tell me|what is|what are|what does|what happened|define|meaning of)\b/.test(t) || t.endsWith('?')) return 'question'
    return 'ignore'
  }

  // ── Handle command ────────────────────────────────────────────────────────
  const handleCommand = useCallback(async (spokenText) => {
    if (!spokenText?.trim()) return
    const intent = detectIntent(spokenText)
    if (intent === 'ignore') return

    if (intent === 'start') {
      setHasStarted(true); hasStartedRef.current = true
      setStatusMessage('Starting…')
      speak(newsItems[currentIndex]?.simplified_article ?? '')
      return
    }
    if (intent === 'next') {
      stopSpeaking(); setStatusMessage('Next article')
      setTimeout(() => onIndexChange(i => Math.min(i + 1, newsItems.length - 1)), 200)
      return
    }
    if (intent === 'previous') {
      stopSpeaking(); setStatusMessage('Previous article')
      setTimeout(() => onIndexChange(i => Math.max(i - 1, 0)), 200)
      return
    }
    if (intent === 'pause') {
      setIsPaused(true); stopSpeaking(); setStatusMessage('Paused'); return
    }
    if (intent === 'resume') {
      setIsPaused(false); setStatusMessage('Resuming…')
      speak(newsItems[currentIndex]?.simplified_article ?? ''); return
    }
    if (intent === 'question') {
      stopSpeaking(); setStatusMessage('Thinking…')
      speak('Let me find that for you.')
      try {
        const res = await fetch('/api/voice-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'question',
            text: spokenText,
            articleContext: newsItems[currentIndex]?.simplified_article,
          }),
        })
        const data = await res.json()
        const answer = data.result ?? "I had trouble answering. Please try again."
        setAgentAnswer(answer); setStatusMessage('')
        speak(answer)
      } catch {
        speak('Something went wrong. Please try again.'); setStatusMessage('')
      }
    }
  }, [currentIndex, newsItems, speak, stopSpeaking, onIndexChange])

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Please use Chrome for voice features.'); return }
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
      if (e.error === 'no-speech' && isListeningRef.current) {
        try { recognition.start() } catch (_) {}
      } else if (e.error !== 'aborted') {
        setIsListening(false); isListeningRef.current = false
      }
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
    stopSpeaking()
  }, [stopSpeaking])

  // ── Toggle voice agent ────────────────────────────────────────────────────
  const toggleVoiceAgent = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
      return
    }
    // Greet first, then start listening
    speak('Hi! How may I help you? You can say next, pause, go back, or ask me anything about the news.')
    setTimeout(() => startListening(), 3500)
  }, [speak, startListening, stopListening])

  // ── Styles ────────────────────────────────────────────────────────────────
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
      {(statusMessage || isSpeaking) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
          {isSpeaking && (
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              {[0, 0.15, 0.3].map((delay, i) => (
                <div key={i} style={{ width: '3px', height: '10px', background: 'var(--accent)', borderRadius: '2px', animation: `pulse 0.8s ease ${delay}s infinite` }} />
              ))}
            </div>
          )}
          {statusMessage || (isSpeaking ? 'Speaking...' : '')}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button style={voiceBtn} onClick={toggleVoiceAgent}>
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
        {hasStarted
          ? 'Say: "Next", "Previous", "Pause", "Resume", or ask a question'
          : 'Click Voice Agent — say "Read out the news" to start'}
      </p>

      <style>{`@keyframes pulse { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.4); } }`}</style>
    </div>
  )
}