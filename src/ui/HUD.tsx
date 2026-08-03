import type { GameMode } from '../game/types'

export interface HudState {
  hp: number
  maxHp: number
  level: number
  xp: number
  xpToNext: number
  materials: number
  mode: GameMode
  wave: number
  waveCount?: number
  timeLeft: number
  kills: number
  killTarget?: number
  baseHp: number
  baseMaxHp: number
  alive: boolean
  playersOnline: number
  ultimateName: string
  ultimateCooldownLeft: number
  ultimateCooldownMax: number
}

function formatTime(s: number) {
  const m = Math.max(0, Math.floor(s / 60))
  const sec = Math.max(0, Math.floor(s % 60))
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function HUD({ state, missionTitle }: { state: HudState; missionTitle: string }) {
  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="hud-frame">
          <div className="hud-row">
            <span className="hud-level">Nv. {state.level}</span>
            <span className="hud-mission">{missionTitle}</span>
          </div>
          <div className="hud-bar-track">
            <div className="hud-bar-fill hp" style={{ width: `${Math.max(0, (state.hp / state.maxHp) * 100)}%` }} />
            <span className="hud-bar-label">{Math.max(0, Math.round(state.hp))} / {state.maxHp} HP</span>
          </div>
          <div className="hud-bar-track small">
            <div className="hud-bar-fill xp" style={{ width: `${(state.xp / state.xpToNext) * 100}%` }} />
          </div>
          <div className="hud-row small-row">
            <span>◆ {state.materials} materiales</span>
            <span>{state.playersOnline} en la partida</span>
          </div>
        </div>
      </div>

      <div className="hud-top-right">
        {state.mode === 'oleadas' && (
          <div className="hud-frame">
            <span className="hud-eyebrow">Oleada</span>
            <span className="hud-big">{state.wave > (state.waveCount ?? 6) ? 'JEFE FINAL' : `${state.wave} / ${state.waveCount}`}</span>
          </div>
        )}
        {state.mode === 'defensa' && (
          <div className="hud-frame">
            <span className="hud-eyebrow">Tiempo restante</span>
            <span className="hud-big">{formatTime(state.timeLeft)}</span>
            <div className="hud-bar-track small">
              <div className="hud-bar-fill base" style={{ width: `${(state.baseHp / state.baseMaxHp) * 100}%` }} />
              <span className="hud-bar-label">Muro: {Math.round((state.baseHp / state.baseMaxHp) * 100)}%</span>
            </div>
          </div>
        )}
        {state.mode === 'mision' && (
          <div className="hud-frame">
            <span className="hud-eyebrow">Enemigos eliminados</span>
            <span className="hud-big">{state.kills} / {state.killTarget}</span>
          </div>
        )}
      </div>

      {!state.alive && (
        <div className="hud-down-banner">Estás caído — reviví al terminar la misión, o esperá refuerzos si tus aliados siguen en pie.</div>
      )}

      <div className="hud-controls-hint">
        Mantené <strong>Shift</strong> (DEFENDER) para bloquear golpes. Apretá <strong>E</strong> (ULTI) para usar {state.ultimateName}
        {state.ultimateCooldownLeft > 0 ? ` — lista en ${Math.ceil(state.ultimateCooldownLeft)}s` : ' — ¡lista!'}.
      </div>
    </div>
  )
}
