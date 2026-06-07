'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

export default function TTSPlayer({ article }) {
  const [isPlaying, setIsPlaying]         = useState(false)
  const [isPaused, setIsPaused]           = useState(false)
  const [currentSegment, setCurrentSegment] = useState(null)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [nextSegment, setNextSegment]     = useState(null)

  const voiceRef      = useRef(null)
  const utteranceRef  = useRef(null)

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

  const segments = []
  segments.push({ label: 'Article', text: article.simplified_article })
  if (article.glossary?.length > 0) {
    const glossaryText = article.glossary
      .map(item => `${item.word || item.term}: ${item.meaning || item.definition}`)
      .join('. ')
    segments.push({ label: 'Word meanings', text: `Word meanings. ${glossaryText}` })
  }

  // ── Speak a segment ───────────────────────────────────────────────────────
  const speakSegment = useCallback((index) => {
    if (index >= segments.length) {
      setIsPlaying(false); setCurrentSegment(null); setAwaitingConfirm(false)
      return
    }
    const segment = segments[index]
    setCurrentSegment(segment.label); setAwaitingConfirm(false)

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(segment.text)
    if (voiceRef.current) utterance.voice = voiceRef.current
    utterance.rate   = 0.92
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsPlaying(true)
    utterance.onend   = () => {
      if (index + 1 < segments.length) {
        setAwaitingConfirm(true)
        setNextSegment({ label: segments[index + 1].label, index: index + 1 })
        setIsPlaying(false)
      } else {
        setIsPlaying(false); setCurrentSegment(null)
      }
    }
    utterance.onerror = () => { setIsPlaying(false); setCurrentSegment(null) }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [segments])

  function handleStop() {
    window.speechSynthesis.cancel()
    setIsPlaying(false); setIsPaused(false)
    setCurrentSegment(null); setAwaitingConfirm(false); setNextSegment(null)
  }

  function handlePause() {
    if (isPaused) {
      window.speechSynthesis.resume(); setIsPaused(false)
    } else {
      window.speechSynthesis.pause(); setIsPaused(true)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const btnBase = {
    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
    fontWeight: '600', borderRadius: 'var(--radius-pill)',
    transition: 'all 0.18s ease', display: 'inline-flex',
    alignItems: 'center', gap: '6px', letterSpacing: '0.03em',
  }
  const listenBtn  = { ...btnBase, background: 'transparent', border: '1.5px solid var(--border-accent)', color: 'var(--accent)', fontSize: '12px', padding: '7px 16px' }
  const stopBtn    = { ...btnBase, background: 'transparent', border: '1.5px solid var(--border-main)', color: 'var(--text-muted)', fontSize: '12px', padding: '7px 14px' }
  const pauseBtn   = { ...btnBase, background: 'var(--accent-light)', border: '1.5px solid var(--border-accent)', color: 'var(--accent)', fontSize: '12px', padding: '7px 14px' }
  const continueBtn = { ...btnBase, background: 'var(--accent)', color: '#fff', fontSize: '12px', padding: '7px 16px', border: 'none' }

  return (
    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>

      {/* Listen button */}
      {!isPlaying && !awaitingConfirm && (
        <button style={listenBtn}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          onClick={() => speakSegment(0)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h2" />
          </svg>
          Listen
        </button>
      )}

      {/* Playing state */}
      {isPlaying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '20px' }}>
            {[0, 0.15, 0.3, 0.1, 0.2].map((delay, i) => (
              <div key={i} style={{
                width: '3px',
                height: isPaused ? '6px' : `${[10,18,14,20,12][i]}px`,
                background: 'var(--accent)', borderRadius: '2px',
                animation: isPaused ? 'none' : `pulse 0.8s ease ${delay}s infinite`,
                transition: 'height 0.2s ease', opacity: isPaused ? 0.4 : 1,
              }} />
            ))}
          </div>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {isPaused ? 'Paused' : currentSegment}
          </span>
          <button style={pauseBtn} onClick={handlePause}>
            {isPaused
              ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Resume</>
              : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
            }
          </button>
          <button style={stopBtn} onClick={handleStop}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            Stop
          </button>
        </div>
      )}

      {/* Continue to next segment */}
      {awaitingConfirm && nextSegment && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
            Continue to <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{nextSegment.label}</span>?
          </span>
          <button style={continueBtn} onClick={() => speakSegment(nextSegment.index)}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            Continue
          </button>
          <button style={stopBtn} onClick={handleStop}>Stop</button>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.4); } }
      `}</style>
    </div>
  )
}