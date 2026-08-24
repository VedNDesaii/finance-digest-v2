'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import ArticleCard from './ArticleCard'

/* One-card-at-a-time swipe feed.
   Swipe the card LEFT (or → arrow / ArrowRight) = next article.
   Swipe the card RIGHT (or ← arrow / ArrowLeft) = previous article.
   Vertical scrolling of a tall card is preserved (touchAction: pan-y +
   horizontal-dominance check), so swipe never fights the page scroll. */
export default function SwipeDeck({ articles, dark, isPro, isBasic, isMobile, onArticleView }) {
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)   // live drag translate (px)
  const [anim, setAnim] = useState(false)   // whether to animate the transform
  const wrapRef = useRef(null)
  const drag = useRef(null)                 // { x0, y0, axis: null|'x'|'y' }
  const busy = useRef(false)

  const total = articles.length
  const clampedIdx = Math.min(idx, Math.max(0, total - 1))

  // Reset to the first card whenever the article set changes (new section).
  useEffect(() => { setIdx(0); setOffset(0); setAnim(false) }, [articles])

  // Count each newly-viewed article as read.
  useEffect(() => { if (total > 0 && onArticleView) onArticleView() }, [clampedIdx, total])

  const width = () => wrapRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth : 360)

  const go = useCallback((dir) => {
    if (busy.current) return
    const next = clampedIdx + dir
    // Bounce at the ends.
    if (next < 0 || next >= total) {
      setAnim(true); setOffset(dir > 0 ? -26 : 26)
      setTimeout(() => setOffset(0), 130)
      return
    }
    busy.current = true
    const w = width()
    setAnim(true); setOffset(dir > 0 ? -w : w)
    setTimeout(() => {
      setAnim(false); setOffset(dir > 0 ? w : -w); setIdx(next)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { setAnim(true); setOffset(0); busy.current = false })
      })
    }, 200)
  }, [clampedIdx, total])

  // Keyboard arrows (desktop). Ignore while typing or when a modal took focus.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // ─── Touch ───
  const onTouchStart = (e) => { drag.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, axis: null } }
  const onTouchMove = (e) => {
    if (!drag.current || busy.current) return
    const dx = e.touches[0].clientX - drag.current.x0
    const dy = e.touches[0].clientY - drag.current.y0
    if (!drag.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      drag.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (drag.current.axis === 'x') { setAnim(false); setOffset(dx) }
  }
  const endTouch = () => {
    if (!drag.current) return
    const dx = drag.current.axis === 'x' ? offset : 0
    drag.current = null
    if (dx < -70) go(1)
    else if (dx > 70) go(-1)
    else { setAnim(true); setOffset(0) }
  }

  // ─── Mouse (desktop drag) ───
  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current || busy.current || !drag.current.mouse) return
      const dx = e.clientX - drag.current.x0
      const dy = e.clientY - drag.current.y0
      if (!drag.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        drag.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (drag.current.axis === 'x') { e.preventDefault(); setAnim(false); setOffset(dx) }
    }
    const onUp = () => {
      if (!drag.current || !drag.current.mouse) return
      const dx = drag.current.axis === 'x' ? offset : 0
      drag.current = null
      if (dx < -70) go(1)
      else if (dx > 70) go(-1)
      else { setAnim(true); setOffset(0) }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [offset, go])

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    drag.current = { x0: e.clientX, y0: e.clientY, axis: null, mouse: true }
  }

  if (total === 0) return null
  const article = articles[clampedIdx]
  const dragOpacity = 1 - Math.min(Math.abs(offset) / 700, 0.32)
  const atStart = clampedIdx === 0
  const atEnd = clampedIdx === total - 1

  const arrowBtn = (dir, disabled) => (
    <button
      onClick={() => go(dir)}
      disabled={disabled}
      aria-label={dir > 0 ? 'Next article' : 'Previous article'}
      style={{
        width: '42px', height: '42px', borderRadius: '50%',
        border: '1px solid var(--border-main)',
        background: disabled ? 'transparent' : 'var(--bg-card)',
        color: disabled ? 'var(--text-muted)' : 'var(--accent)',
        cursor: disabled ? 'default' : 'pointer', fontSize: '18px',
        opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: disabled ? 'none' : 'var(--shadow-card)',
      }}>{dir > 0 ? '→' : '←'}</button>
  )

  return (
    <div>
      {/* Progress + counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ flex: 1, height: '4px', background: 'var(--border-light)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${((clampedIdx + 1) / total) * 100}%`,
            background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.25s ease',
          }} />
        </div>
        <span style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--text-muted)', minWidth: '52px', textAlign: 'right' }}>
          {clampedIdx + 1} / {total}
        </span>
      </div>

      {/* Card viewport */}
      <div
        ref={wrapRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endTouch}
        onMouseDown={onMouseDown}
        style={{ overflowX: 'clip', touchAction: 'pan-y' }}>
        <div style={{
          transform: `translateX(${offset}px)`,
          opacity: dragOpacity,
          transition: anim ? 'transform 0.2s ease, opacity 0.2s ease' : 'none',
          willChange: 'transform',
        }}>
          <ArticleCard article={article} dark={dark} isPro={isPro} isBasic={isBasic} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginTop: '18px' }}>
        {arrowBtn(-1, atStart)}
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', letterSpacing: '0.04em', minWidth: '90px', textAlign: 'center' }}>
          {isMobile ? 'swipe or tap' : 'swipe · ← → keys'}
        </span>
        {arrowBtn(1, atEnd)}
      </div>
    </div>
  )
}
