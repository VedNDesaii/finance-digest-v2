// components/DoubtBox.js
'use client'
import { useState } from 'react'

export default function DoubtBox({ article, dark }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  const askDoubt = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')

    try {
      const res = await fetch('/api/voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question',
          text: question,
          articleContext: article?.simplified_text ?? article?.description ?? '',
        }),
      })
      const { result } = await res.json()
      setAnswer(result ?? "I couldn't find an answer.")
    } catch (e) {
      setAnswer('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      askDoubt()
    }
  }

  return (
    <div style={{
      marginTop: '12px',
      padding: '16px',
      borderRadius: '12px',
      background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{
        fontSize: '13px', fontWeight: '700', letterSpacing: '0.05em',
        textTransform: 'uppercase', marginBottom: '10px',
        color: dark ? '#E8C97A' : '#B8923C',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        💬 Ask a Doubt
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question about this article..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '99px',
            border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
            background: dark ? 'rgba(0,0,0,0.2)' : '#fff',
            color: dark ? '#F0EBE3' : '#1A1410',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        />
        <button
          onClick={askDoubt}
          disabled={loading || !question.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: '99px',
            border: 'none',
            background: loading || !question.trim()
              ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
              : 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: loading || !question.trim() ? (dark ? '#888' : '#999') : '#1A1410',
            fontSize: '14px', fontWeight: '700',
            cursor: loading || !question.trim() ? 'default' : 'pointer',
            fontFamily: 'var(--font-ui)',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>

      {answer && (
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: dark ? 'rgba(232,201,122,0.08)' : 'rgba(232,201,122,0.12)',
          borderLeft: `3px solid ${dark ? '#E8C97A' : '#C9A84C'}`,
          fontSize: '14px',
          lineHeight: '1.6',
          color: dark ? '#F0EBE3' : '#1A1410',
          fontFamily: 'var(--font-ui)',
        }}>
          {answer}
        </div>
      )}
    </div>
  )
}