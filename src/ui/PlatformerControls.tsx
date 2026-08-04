interface Props {
  onLeftStart: () => void
  onLeftEnd: () => void
  onRightStart: () => void
  onRightEnd: () => void
  onJump: () => void
  onAttackStart: () => void
  onAttackEnd: () => void
}

export default function PlatformerControls({
  onLeftStart,
  onLeftEnd,
  onRightStart,
  onRightEnd,
  onJump,
  onAttackStart,
  onAttackEnd,
}: Props) {
  return (
    <div className="touch-controls">
      <div className="dpad">
        <button
          className="dpad-btn"
          onTouchStart={(e) => {
            e.preventDefault()
            onLeftStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            onLeftEnd()
          }}
          onMouseDown={onLeftStart}
          onMouseUp={onLeftEnd}
          onMouseLeave={onLeftEnd}
        >
          ◀
        </button>
        <button
          className="dpad-btn"
          onTouchStart={(e) => {
            e.preventDefault()
            onRightStart()
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            onRightEnd()
          }}
          onMouseDown={onRightStart}
          onMouseUp={onRightEnd}
          onMouseLeave={onRightEnd}
        >
          ▶
        </button>
      </div>
      <div className="action-buttons">
        <button
          className="jump-btn"
          onTouchStart={(e) => {
            e.preventDefault()
            onJump()
          }}
          onClick={onJump}
        >
          SALTAR
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
