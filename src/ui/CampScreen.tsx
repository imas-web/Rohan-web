import { useEffect, useState, type MutableRefObject } from 'react'
import { ARMORS, MISSIONS, RARITY_COLOR, RARITY_COST, RARITY_MIN_LEVEL, WEAPONS, xpToNextLevel } from '../game/data'
import type { MissionDef } from '../game/types'
import type { Listeners, MultiplayerRoom } from '../supabase/multiplayer'

export interface Progress {
  level: number
  xp: number
  materials: number
  weaponId: string
  armorId: string
}

export default function CampScreen({
  progress,
  onEquip,
  room,
  listenersRef,
  onStart,
  onBack,
}: {
  progress: Progress
  onEquip: (weaponId: string, armorId: string, materialsSpent: number) => void
  room: MultiplayerRoom | null
  listenersRef: MutableRefObject<Listeners>
  onStart: (mission: MissionDef) => void
  onBack: () => void
}) {
  const [members, setMembers] = useState<{ id: string; name: string; color: string }[]>([])
  const isHost = !room || room.isHost

  useEffect(() => {
    if (!room) return
    listenersRef.current.onPresenceChange = (m) => setMembers(m)
    listenersRef.current.onGameStart = (missionId) => {
      const mission = MISSIONS.find((m) => m.id === missionId)
      if (mission) onStart(mission)
    }
    return () => {
      listenersRef.current.onPresenceChange = undefined
      listenersRef.current.onGameStart = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  function canAfford(rarity: string) {
    return progress.materials >= RARITY_COST[rarity] && progress.level >= RARITY_MIN_LEVEL[rarity]
  }

  function buyWeapon(id: string, rarity: string, cost: number) {
    if (!canAfford(rarity)) return
    onEquip(id, progress.armorId, cost)
  }

  function buyArmor(id: string, rarity: string, cost: number) {
    if (!canAfford(rarity)) return
    onEquip(progress.weaponId, id, cost)
  }

  function startMission(mission: MissionDef) {
    if (room) {
      if (!isHost) return
      room.sendGameStart(mission.id)
    }
    onStart(mission)
  }

  return (
    <div className="screen camp-screen">
      <div className="camp-header">
        <div>
          <span className="eyebrow">Campamento de Rohan</span>
          <h1>Nivel {progress.level}</h1>
          <div className="hud-bar-track">
            <div className="hud-bar-fill xp" style={{ width: `${(progress.xp / xpToNextLevel(progress.level)) * 100}%` }} />
            <span className="hud-bar-label">{progress.xp} / {xpToNextLevel(progress.level)} XP</span>
          </div>
          <p className="materials-count">◆ {progress.materials} materiales</p>
        </div>
        <button className="btn-ghost" onClick={onBack}>Cambiar nombre</button>
      </div>

      {room && (
        <div className="camp-members">
          <span className="eyebrow">Sala {room.roomCode} — {members.length} jugador{members.length === 1 ? '' : 'es'}</span>
          <div className="member-chips">
            {members.map((m) => (
              <span key={m.id} className="chip" style={{ borderColor: m.color }}>{m.name}</span>
            ))}
          </div>
          {!isHost && <p className="hint">Esperando a que el líder de la sala elija la misión...</p>}
        </div>
      )}

      <div className="camp-columns">
        <section className="camp-section">
          <h2>Armas</h2>
          <div className="item-grid">
            {WEAPONS.map((w) => {
              const equipped = w.id === progress.weaponId
              const affordable = canAfford(w.rarity)
              return (
                <button
                  key={w.id}
                  className={`item-card ${equipped ? 'equipped' : ''}`}
                  style={{ borderColor: RARITY_COLOR[w.rarity] }}
                  disabled={!equipped && !affordable}
                  onClick={() => (equipped ? null : buyWeapon(w.id, w.rarity, RARITY_COST[w.rarity]))}
                >
                  <span className="item-name">{w.name}</span>
                  <span className="item-rarity" style={{ color: RARITY_COLOR[w.rarity] }}>{w.rarity}</span>
                  <span className="item-stats">Daño {w.damage} · Vel. {w.attackSpeed}/s · Crít {Math.round(w.critChance * 100)}%</span>
                  {!equipped && (
                    <span className="item-cost">
                      {RARITY_COST[w.rarity] === 0 ? 'Gratis' : `◆ ${RARITY_COST[w.rarity]}`}
                      {progress.level < RARITY_MIN_LEVEL[w.rarity] ? ` · Nv. ${RARITY_MIN_LEVEL[w.rarity]}+` : ''}
                    </span>
                  )}
                  {equipped && <span className="item-cost">Equipado</span>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="camp-section">
          <h2>Armaduras</h2>
          <div className="item-grid">
            {ARMORS.map((a) => {
              const equipped = a.id === progress.armorId
              const affordable = canAfford(a.rarity)
              return (
                <button
                  key={a.id}
                  className={`item-card ${equipped ? 'equipped' : ''}`}
                  style={{ borderColor: RARITY_COLOR[a.rarity] }}
                  disabled={!equipped && !affordable}
                  onClick={() => (equipped ? null : buyArmor(a.id, a.rarity, RARITY_COST[a.rarity]))}
                >
                  <span className="item-name">{a.name}</span>
                  <span className="item-rarity" style={{ color: RARITY_COLOR[a.rarity] }}>{a.rarity}</span>
                  <span className="item-stats">Def. {a.defense} · +{a.hpBonus} HP</span>
                  {!equipped && (
                    <span className="item-cost">
                      {RARITY_COST[a.rarity] === 0 ? 'Gratis' : `◆ ${RARITY_COST[a.rarity]}`}
                      {progress.level < RARITY_MIN_LEVEL[a.rarity] ? ` · Nv. ${RARITY_MIN_LEVEL[a.rarity]}+` : ''}
                    </span>
                  )}
                  {equipped && <span className="item-cost">Equipado</span>}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <section className="camp-section">
        <h2>Misiones</h2>
        <div className="mission-grid">
          {MISSIONS.map((m) => (
            <div key={m.id} className="mission-card">
              <span className="mission-mode">{m.mode === 'oleadas' ? 'Oleadas + jefe' : m.mode === 'defensa' ? 'Defender base' : 'Misión'}</span>
              <h3>{m.title}</h3>
              <p>{m.description}</p>
              <button className="btn-primary" disabled={!!room && !isHost} onClick={() => startMission(m)}>
                {room && !isHost ? 'Esperando al líder' : 'Comenzar aventura'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
