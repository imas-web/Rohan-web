import { useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import type { Vec2 } from '../game/types'

interface Props {
  onMove: (v: Vec2) => void
  onAttackStart: () => void
  onAttackEnd: () => void
  onBlockStart: () => void
  onBlockEnd: () => void
}

const STICK_RADIUS = 52

export default function TouchControls({ onMove, onAttackStart, onAttackEnd, onBlockStart, onBlockEnd }: Props) {
  const baseRef = useRef<HTMLDivElement | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const activeTouch = useRef<number | null>(null)

  function handleStart(e: ReactTouchEvent<HTMLDivElement>) {
    const t = e.changedTouches[0]
    activeTouch.current = t.identifier
  }

  function updateFromTouch(t: React.Touch) {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = t.clientX - cx
    let dy = t.clientY - cy
    const len = Math.hypot(dx, dy)
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS
      dy = (dy / len) * STICK_RADIUS
    }
    setKnob({ x: dx, y: dy })
    onMove({ x: dx / STICK_RADIUS, y: dy / STICK_RADIUS })
  }

  function handleMove(e: ReactTouchEvent<HTMLDivElement>) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeTouch.current) updateFromTouch(t)
    }
  }

  function handleEnd(e: ReactTouchEvent<HTMLDivElement>) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === activeTouch.current) {
        activeTouch.current = null
        setKnob({ x: 0, y: 0 })
        onMove({ x: 0, y: 0 })
      }
    }
  }

  return (
    <div className="touch-controls">
      <div
        ref={baseRef}
        className="joystick-base"
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="action-buttons">
        <button
          className="block-btn"
          onTouchStart={(e) => {
            e.preventDefault()
            onBlockStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            onBlockEnd()
          }}
          onMouseDown={onBlockStart}
          onMouseUp={onBlockEnd}
          onMouseLeave={onBlockEnd}
        >
          DEFENDER
        </button>
        <button
          className="attack-btn"
          onTouchStart={(e) => {
            e.preventDefault()
            onAttackStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            onAttackEnd()
          }}
          onMouseDown={onAttackStart}
          onMouseUp={onAttackEnd}
          onMouseLeave={onAttackEnd}
        >
          ATACAR
        </button>
      </div>
    </div>
  )
}
