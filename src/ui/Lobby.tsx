import { useEffect, useState, type MutableRefObject } from 'react'
import type { Listeners, MultiplayerRoom } from '../supabase/multiplayer'
import { supabaseEnabled } from '../supabase/client'

interface Member {
  id: string
  name: string
  color: string
  joinedAt: number
}

export default function Lobby({
  playerId,
  name,
  color,
  listenersRef,
  makeRoom,
  onConnected,
  onBack,
}: {
  playerId: string
  name: string
  color: string
  listenersRef: MutableRefObject<Listeners>
  makeRoom: (code: string) => MultiplayerRoom
  onConnected: (room: MultiplayerRoom) => void
  onBack: () => void
}) {
  const [step, setStep] = useState<'enter' | 'connecting' | 'connected' | 'error'>('enter')
  const [code, setCode] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoom | null>(null)

  useEffect(() => {
    listenersRef.current.onPresenceChange = (m) => setMembers(m)
    return () => {
      listenersRef.current.onPresenceChange = undefined
    }
  }, [listenersRef])

  async function connectTo(rawPassword: string) {
    const roomCode = rawPassword.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '')
    setStep('connecting')
    setError('')
    try {
      const room = makeRoom(roomCode)
      await room.join(name, color, listenersRef.current)
      setActiveRoom(room)
      setStep('connected')
    } catch (e) {
      console.error(e)
      setError('No se pudo conectar a la sala. Revisá tu conexión o las variables de Supabase.')
      setStep('error')
    }
  }

  if (!supabaseEnabled) {
    return (
      <div className="screen menu-screen">
        <div className="menu-card">
          <h2>Multijugador no configurado</h2>
          <p className="hint">
            Para jugar en grupo hace falta conectar un proyecto de Supabase (gratis). Configurá las variables
            <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> — mirá el README del proyecto.
          </p>
          <button className="btn-secondary" onClick={onBack}>Volver</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen menu-screen">
      <div className="menu-card">
        <h2>Partida en grupo</h2>

        {step === 'enter' && (
          <div className="menu-actions">
            <label className="field-label" htmlFor="room-password">Contraseña de la partida</label>
            <input
              id="room-password"
              className="text-input code-input"
              maxLength={20}
              placeholder="Ej: familia2026"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <p className="hint">
              Poné la misma contraseña que tus compañeros para caer todos en la misma partida — no hace falta
              registrarse ni crear nada por separado.
            </p>
            <button className="btn-primary" disabled={code.trim().length < 3} onClick={() => connectTo(code)}>
              Buscar partida
            </button>
            <button className="btn-ghost" onClick={onBack}>Volver</button>
          </div>
        )}

        {step === 'connecting' && <p className="hint">Conectando a la sala...</p>}

        {step === 'error' && (
          <>
            <p className="hint error-text">{error}</p>
            <button className="btn-secondary" onClick={() => setStep('enter')}>Reintentar</button>
          </>
        )}

        {step === 'connected' && activeRoom && (
          <>
            <p className="room-code-display">
              Contraseña de la partida: <strong>{activeRoom.roomCode}</strong>
            </p>
            <p className="hint">Compartí esta contraseña con hasta 3 amigos para que se unan desde su celular.</p>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.name} {m.id === playerId ? '(vos)' : ''}
                </li>
              ))}
            </ul>
            <button className="btn-primary" onClick={() => onConnected(activeRoom)}>
              Continuar al campamento
            </button>
          </>
        )}
      </div>
    </div>
  )
}
