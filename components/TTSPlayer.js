'use client'
import { useState, useRef } from 'react'

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TTS_KEY

export default function TTSPlayer({ article }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSegment, setCurrentSegment] = useState(null)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [nextSegment, setNextSegment] = useState(null)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const audioBlobUrlRef = useRef(null)

  const segments = []
  segments.push({ label: 'Article', text: article.simplified_article })
  if (article.glossary && article.glossary.length > 0) {
    const glossaryText = article.glossary
      .map(item => `${item.word}: ${item.meaning}`)
      .join('. ')
    segments.push({ label: 'Word meanings', text: `Word meanings. ${glossaryText}` })
  }

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
            name: 'en-US-Neural2-F',
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
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err?.error?.message || 'Google TTS failed')
    }
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

  async function playSegment(index) {
    if (index >= segments.length) { setIsPlaying(false); setCurrentSegment(null); setAwaitingConfirm(false); return }
    const segment = segments[index]
    setCurrentSegment(segment.label); setIsLoading(true); setAwaitingConfirm(false); setError(null)
    try {
      const blob = await fetchGoogleTTS(segment.text)
      const url = URL.createObjectURL(blob)
      cleanupAudio(); audioBlobUrlRef.current = url
      const audio = new Audio(url); audioRef.current = audio
      audio.oncanplaythrough = () => { setIsLoading(false); setIsPlaying(true); audio.play() }
      audio.onended = () => {
        cleanupAudio()
        if (index + 1 < segments.length) { setAwaitingConfirm(true); setNextSegment({ label: segments[index + 1].label, index: index + 1 }); setIsPlaying(false) }
        else { setIsPlaying(false); setCurrentSegment(null) }
      }
      audio.onerror = () => { setError('Playback failed. Please try again.'); setIsLoading(false); setIsPlaying(false) }
    } catch (err) {
      setError('Voice unavailable. Check your API key.'); setIsLoading(false); setIsPlaying(false)
    }
  }

  function handleStop() {
    cleanupAudio()
    setIsPlaying(false); setIsPaused(false); setIsLoading(false)
    setCurrentSegment(null); setAwaitingConfirm(false); setNextSegment(null); setError(null)
  }

  function handlePause() {
    if (!audioRef.current) return
    if (isPaused) { audioRef.current.play(); setIsPaused(false) }
    else { audioRef.current.pause(); setIsPaused(true) }
  }

  const btnBase = { border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: '600', borderRadius: 'var(--radius-pill)', transition: 'all 0.18s ease', display: 'inline-flex', alignItems: 'center', gap: '6px', letterSpacing: '0.03em' }
  const listenBtn = { ...btnBase, background: 'transparent', border: '1.5px solid var(--border-accent)', color: 'var(--accent)', fontSize: '12px', padding: '7px 16px' }
  const stopBtn = { ...btnBase, background: 'transparent', border: '1.5px solid var(--border-main)', color: 'var(--text-muted)', fontSize: '12px', padding: '7px 14px' }
  const pauseBtn = { ...btnBase, background: 'var(--accent-light)', border: '1.5px solid var(--border-accent)', color: 'var(--accent)', fontSize: '12px', padding: '7px 14px' }
  const continueBtn = { ...btnBase, background: 'var(--accent)', color: '#fff', fontSize: '12px', padding: '7px 16px', border: 'none' }

  return (
    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
      {error && <p style={{ fontSize: '12px', color: 'var(--down)', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>{error}</p>}

      {!isPlaying && !isLoading && !awaitingConfirm && (
        <button style={listenBtn}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-accent)' }}
          onClick={() => playSegment(0)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h2" /></svg>
          Listen
        </button>
      )}

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', border: '2px solid var(--border-accent)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Preparing audio...</span>
        </div>
      )}

      {isPlaying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '20px' }}>
            {[0, 0.15, 0.3, 0.1, 0.2].map((delay, i) => (
              <div key={i} style={{ width: '3px', height: isPaused ? '6px' : `${[10,18,14,20,12][i]}px`, background: 'var(--accent)', borderRadius: '2px', animation: isPaused ? 'none' : `pulse 0.8s ease ${delay}s infinite`, transition: 'height 0.2s ease', opacity: isPaused ? 0.4 : 1 }} />
            ))}
          </div>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontStyle: 'italic' }}>{isPaused ? 'Paused' : currentSegment}</span>
          <button style={pauseBtn} onMouseEnter={e => e.currentTarget.style.opacity='0.8'} onMouseLeave={e => e.currentTarget.style.opacity='1'} onClick={handlePause}>
            {isPaused ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Resume</> : <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>}
          </button>
          <button style={stopBtn} onMouseEnter={e => { e.currentTarget.style.background='var(--bg-detail)'; e.currentTarget.style.color='var(--text-secondary)' }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)' }} onClick={handleStop}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>Stop
          </button>
        </div>
      )}

      {awaitingConfirm && nextSegment && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>Continue to <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{nextSegment.label}</span>?</span>
          <button style={continueBtn} onMouseEnter={e => e.currentTarget.style.background='var(--accent-dark)'} onMouseLeave={e => e.currentTarget.style.background='var(--accent)'} onClick={() => playSegment(nextSegment.index)}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>Continue
          </button>
          <button style={stopBtn} onMouseEnter={e => { e.currentTarget.style.background='var(--bg-detail)'; e.currentTarget.style.color='var(--text-secondary)' }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)' }} onClick={handleStop}>Stop</button>
        </div>
      )}
    </div>
  )
}