import { useState } from 'react'
import { CLASSES } from '../game/data'

const COLORS = ['#7FD1AE', '#C1502E', '#4C6B8A', '#C9A227', '#8A4C9B', '#D97F5A']

export default function MainMenu({
  initialName,
  initialColor,
  initialClassId,
  onSolo,
  onMultiplayer,
}: {
  initialName: string
  initialColor: string
  initialClassId: string
  onSolo: (name: string, color: string, classId: string) => void
  onMultiplayer: (name: string, color: string, classId: string) => void
}) {
  const [name, setName] = useState(initialName || '')
  const [color, setColor] = useState(initialColor || COLORS[0])
  const [classId, setClassId] = useState(initialClassId || CLASSES[0].id)

  const canPlay = name.trim().length >= 2
  const selectedClass = CLASSES.find((c) => c.id === classId) ?? CLASSES[0]

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

        <label className="field-label">Tu clase (define tu habilidad definitiva)</label>
        <div className="class-row">
          {CLASSES.map((c) => (
            <button
              key={c.id}
              className={`class-card ${c.id === classId ? 'selected' : ''}`}
              style={{ borderColor: c.color }}
              onClick={() => setClassId(c.id)}
            >
              <span className="class-name" style={{ color: c.color }}>{c.name}</span>
              <span className="class-ulti">{c.ultimateName}</span>
            </button>
          ))}
        </div>
        <p className="hint">{selectedClass.description}</p>

        <div className="menu-actions">
          <button className="btn-primary" disabled={!canPlay} onClick={() => onSolo(name.trim(), color, classId)}>
            Jugar solo
          </button>
          <button className="btn-secondary" disabled={!canPlay} onClick={() => onMultiplayer(name.trim(), color, classId)}>
            Jugar en grupo (hasta 4)
          </button>
        </div>
        {!canPlay && <p className="hint">Escribí un nombre de al menos 2 letras para continuar.</p>}
      </div>
    </div>
  )
}
