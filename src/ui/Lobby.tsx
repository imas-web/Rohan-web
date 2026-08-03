import { useEffect, useState, type MutableRefObject } from 'react'
import type { Listeners, MultiplayerRoom } from '../supabase/multiplayer'
import { randomRoomCode } from '../supabase/multiplayer'
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
  const [step, setStep] = useState<'choose' | 'join-code' | 'connecting' | 'connected' | 'error'>('choose')
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

  async function connectTo(roomCode: string) {
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

        {step === 'choose' && (
          <div className="menu-actions">
            <button className="btn-primary" onClick={() => connectTo(randomRoomCode())}>
              Crear sala nueva
            </button>
            <button className="btn-secondary" onClick={() => setStep('join-code')}>
              Unirme con un código
            </button>
            <button className="btn-ghost" onClick={onBack}>Volver</button>
          </div>
        )}

        {step === 'join-code' && (
          <div className="menu-actions">
            <input
              className="text-input code-input"
              maxLength={4}
              placeholder="CÓDIGO"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn-primary" disabled={code.length !== 4} onClick={() => connectTo(code)}>
              Unirme
            </button>
            <button className="btn-ghost" onClick={() => setStep('choose')}>Volver</button>
          </div>
        )}

        {step === 'connecting' && <p className="hint">Conectando a la sala...</p>}

        {step === 'error' && (
          <>
            <p className="hint error-text">{error}</p>
            <button className="btn-secondary" onClick={() => setStep('choose')}>Reintentar</button>
          </>
        )}

        {step === 'connected' && activeRoom && (
          <>
            <p className="room-code-display">
              Código de la sala: <strong>{activeRoom.roomCode}</strong>
            </p>
            <p className="hint">Compartí este código con hasta 3 amigos para que se unan desde su celular.</p>
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
