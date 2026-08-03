import { useState } from 'react'

const COLORS = ['#7FD1AE', '#C1502E', '#4C6B8A', '#C9A227', '#8A4C9B', '#D97F5A']

export default function MainMenu({
  initialName,
  initialColor,
  onSolo,
  onMultiplayer,
}: {
  initialName: string
  initialColor: string
  onSolo: (name: string, color: string) => void
  onMultiplayer: (name: string, color: string) => void
}) {
  const [name, setName] = useState(initialName || '')
  const [color, setColor] = useState(initialColor || COLORS[0])

  const canPlay = name.trim().length >= 2

  return (
    <div className="screen menu-screen">
      <div className="menu-banner">
        <span className="eyebrow">Coop hasta 4 jugadores</span>
        <h1>Guardia de Rohan</h1>
        <p className="menu-tagline">Defendé la Marca. Subí de nivel. Forjá tu equipo.</p>
      </div>

      <div className="menu-card">
        <label className="field-label" htmlFor="name">Tu nombre de guerrero</label>
        <input
          id="name"
          className="text-input"
          maxLength={16}
          placeholder="Éomer, Gimli, Legolas..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="field-label">Color de estandarte</label>
        <div className="color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${c === color ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Elegir color ${c}`}
            />
          ))}
        </div>

        <div className="menu-actions">
          <button className="btn-primary" disabled={!canPlay} onClick={() => onSolo(name.trim(), color)}>
            Jugar solo
          </button>
          <button className="btn-secondary" disabled={!canPlay} onClick={() => onMultiplayer(name.trim(), color)}>
            Jugar en grupo (hasta 4)
          </button>
        </div>
        {!canPlay && <p className="hint">Escribí un nombre de al menos 2 letras para continuar.</p>}
      </div>
    </div>
  )
}
