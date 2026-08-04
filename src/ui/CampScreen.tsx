import { useEffect, useState, type MutableRefObject } from 'react'
import {
  MISSIONS,
  ULTIMATE_MAX_RANK,
  ULTIMATE_RANK_COST,
  abilitiesForClass,
  getAbility,
  getClass,
  skillPointsForLevel,
  xpToNextLevel,
} from '../game/data'
import type { MissionDef } from '../game/types'
import type { Listeners, MultiplayerRoom } from '../supabase/multiplayer'

export interface Progress {
  level: number
  xp: number
  materials: number
  ultimateRank: number
  activeAbilityId: string
  unlockedAbilityIds: string[]
}

export default function CampScreen({
  progress,
  classId,
  onUnlockAbility,
  onSelectAbility,
  onUpgradeUltimate,
  room,
  listenersRef,
  onStart,
  onBack,
}: {
  progress: Progress
  classId: string
  onUnlockAbility: (abilityId: string, cost: number) => void
  onSelectAbility: (abilityId: string) => void
  onUpgradeUltimate: () => void
  room: MultiplayerRoom | null
  listenersRef: MutableRefObject<Listeners>
  onStart: (mission: MissionDef) => void
  onBack: () => void
}) {
  const cls = getClass(classId)
  const activeAbility = getAbility(progress.activeAbilityId)
  const totalSkillPoints = skillPointsForLevel(progress.level)
  const nextRankCost = ULTIMATE_RANK_COST[progress.ultimateRank]
  const canUpgradeUltimate = progress.ultimateRank < ULTIMATE_MAX_RANK && totalSkillPoints >= nextRankCost
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
        <button className="btn-ghost" onClick={onBack}>Cambiar nombre o clase</button>
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

      <section className="camp-section">
        <h2>Habilidades — {cls.name}</h2>
        <p className="hint">Desbloqueá las 4 con nivel y materiales, pero solo una puede estar activa a la vez.</p>
        <div className="item-grid">
          {abilitiesForClass(classId).map((ab) => {
            const unlocked = progress.unlockedAbilityIds.includes(ab.id)
            const isActive = progress.activeAbilityId === ab.id
            const levelOk = progress.level >= ab.unlockLevel
            const canUnlock = !unlocked && levelOk && progress.materials >= ab.unlockCost
            return (
              <button
                key={ab.id}
                className={`item-card ${isActive ? 'equipped' : ''}`}
                style={{ borderColor: ab.color }}
                disabled={unlocked ? isActive : !canUnlock}
                onClick={() => {
                  if (unlocked) onSelectAbility(ab.id)
                  else onUnlockAbility(ab.id, ab.unlockCost)
                }}
              >
                <span className="item-name">{ab.name}</span>
                <span className="item-rarity" style={{ color: ab.color }}>{ab.archetype}</span>
                <span className="item-stats">{ab.description}</span>
                {!unlocked && (
                  <span className="item-cost">
                    {ab.unlockCost === 0 ? 'Gratis' : `◆ ${ab.unlockCost}`}
                    {!levelOk ? ` · Nv. ${ab.unlockLevel}+` : ''}
                  </span>
                )}
                {unlocked && <span className="item-cost">{isActive ? 'Activa' : 'Elegir'}</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="camp-section ultimate-section">
        <h2>Rango de {activeAbility.name}</h2>
        <p className="hint">{activeAbility.description}</p>
        <div className="ultimate-rank-row">
          {Array.from({ length: ULTIMATE_MAX_RANK }, (_, i) => (
            <span key={i} className={`rank-pip ${i < progress.ultimateRank ? 'filled' : ''}`} style={i < progress.ultimateRank ? { background: cls.color, borderColor: cls.color } : undefined} />
          ))}
          <span className="rank-label">Rango {progress.ultimateRank} / {ULTIMATE_MAX_RANK}</span>
        </div>
        <p className="hint">
          {progress.ultimateRank >= ULTIMATE_MAX_RANK
            ? 'Habilidad al máximo — más área/duración y menos cooldown.'
            : `Punto de habilidad: ${totalSkillPoints} disponibles (ganás 1 por nivel) · próximo rango cuesta ${nextRankCost}.`}
        </p>
        <button className="btn-secondary" disabled={!canUpgradeUltimate} onClick={onUpgradeUltimate}>
          {progress.ultimateRank >= ULTIMATE_MAX_RANK ? 'Habilidad al máximo' : 'Mejorar habilidad'}
        </button>
      </section>

      <section className="camp-section">
        <h2>Misiones</h2>
        <div className="mission-grid">
          {MISSIONS.map((m) => (
            <div key={m.id} className="mission-card">
              <span className="mission-mode">
                {m.mode === 'oleadas'
                  ? 'Oleadas + jefe'
                  : m.mode === 'defensa'
                  ? 'Defender base'
                  : m.mode === 'plataformas'
                  ? 'Desfiladero'
                  : 'Misión'}
              </span>
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
