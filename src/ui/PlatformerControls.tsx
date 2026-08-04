interface Props {
  onLeftStart: () => void
  onLeftEnd: () => void
  onRightStart: () => void
  onRightEnd: () => void
  onUpStart: () => void
  onUpEnd: () => void
  onDownStart: () => void
  onDownEnd: () => void
  onAttackStart: () => void
  onAttackEnd: () => void
}

export default function PlatformerControls({
  onLeftStart,
  onLeftEnd,
  onRightStart,
  onRightEnd,
  onUpStart,
  onUpEnd,
  onDownStart,
  onDownEnd,
  onAttackStart,
  onAttackEnd,
}: Props) {
  return (
    <div className="touch-controls">
      <div className="dpad dpad-4way">
        <button
          className="dpad-btn dpad-up"
          onTouchStart={(e) => { e.preventDefault(); onUpStart() }}
          onTouchEnd={(e) => { e.preventDefault(); onUpEnd() }}
          onMouseDown={onUpStart}
          onMouseUp={onUpEnd}
          onMouseLeave={onUpEnd}
        >
          ▲
        </button>
        <div className="dpad-mid-row">
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); onLeftStart() }}
            onTouchEnd={(e) => { e.preventDefault(); onLeftEnd() }}
            onMouseDown={onLeftStart}
            onMouseUp={onLeftEnd}
            onMouseLeave={onLeftEnd}
          >
            ◀
          </button>
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); onRightStart() }}
            onTouchEnd={(e) => { e.preventDefault(); onRightEnd() }}
            onMouseDown={onRightStart}
            onMouseUp={onRightEnd}
            onMouseLeave={onRightEnd}
          >
            ▶
          </button>
        </div>
        <button
          className="dpad-btn dpad-down"
          onTouchStart={(e) => { e.preventDefault(); onDownStart() }}
          onTouchEnd={(e) => { e.preventDefault(); onDownEnd() }}
          onMouseDown={onDownStart}
          onMouseUp={onDownEnd}
          onMouseLeave={onDownEnd}
        >
          ▼
        </button>
      </div>
      <div className="action-buttons">
        <button
          className="attack-btn"
          onTouchStart={(e) => { e.preventDefault(); onAttackStart() }}
          onTouchEnd={(e) => { e.preventDefault(); onAttackEnd() }}
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
