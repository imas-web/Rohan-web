import { useEffect, useRef, useState } from 'react'
import MainMenu from './ui/MainMenu'
import Lobby from './ui/Lobby'
import CampScreen, { type Progress } from './ui/CampScreen'
import GameCanvas from './game/GameCanvas'
import type { MissionDef } from './game/types'
import { MultiplayerRoom, makePlayerId, type Listeners } from './supabase/multiplayer'

type Screen = 'menu' | 'lobby' | 'camp' | 'game'

const STORAGE_KEY = 'rohan_coop_save_v1'

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { name: string; color: string } & Progress
  } catch {
    return null
  }
}

function persistSave(data: { name: string; color: string } & Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage puede fallar en modo privado; el juego sigue andando igual
  }
}

function getPlayerId() {
  let id = localStorage.getItem('rohan_coop_player_id')
  if (!id) {
    id = makePlayerId()
    localStorage.setItem('rohan_coop_player_id', id)
  }
  return id
}

export default function App() {
  const saved = loadSave()
  const playerId = useRef(getPlayerId()).current
  const listenersRef = useRef<Listeners>({})

  const [screen, setScreen] = useState<Screen>('menu')
  const [name, setName] = useState(saved?.name ?? '')
  const [color, setColor] = useState(saved?.color ?? '#7FD1AE')
  const [progress, setProgress] = useState<Progress>(
    saved
      ? { level: saved.level, xp: saved.xp, materials: saved.materials, weaponId: saved.weaponId, armorId: saved.armorId }
      : { level: 1, xp: 0, materials: 0, weaponId: 'daga', armorId: 'ropa' }
  )
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [mission, setMission] = useState<MissionDef | null>(null)

  useEffect(() => {
    persistSave({ name, color, ...progress })
  }, [name, color, progress])

  function handleSolo(n: string, c: string) {
    setName(n)
    setColor(c)
    setRoom(null)
    setScreen('camp')
  }

  function handleMultiplayer(n: string, c: string) {
    setName(n)
    setColor(c)
    setScreen('lobby')
  }

  function handleEquip(weaponId: string, armorId: string, materialsSpent: number) {
    setProgress((prev) => ({ ...prev, weaponId, armorId, materials: prev.materials - materialsSpent }))
  }

  function handleStart(m: MissionDef) {
    setMission(m)
    setScreen('game')
  }

  function handleExit(result: { finalLevel: number; finalXp: number; finalMaterials: number }) {
    setProgress((prev) => ({
      ...prev,
      level: result.finalLevel,
      xp: result.finalXp,
      materials: result.finalMaterials,
    }))
    setScreen('camp')
  }

  return (
    <>
      {screen === 'menu' && (
        <MainMenu initialName={name} initialColor={color} onSolo={handleSolo} onMultiplayer={handleMultiplayer} />
      )}

      {screen === 'lobby' && (
        <Lobby
          playerId={playerId}
          name={name}
          color={color}
          listenersRef={listenersRef}
          makeRoom={(code) => new MultiplayerRoom(code, playerId)}
          onConnected={(r) => {
            setRoom(r)
            setScreen('camp')
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'camp' && (
        <CampScreen
          progress={progress}
          onEquip={handleEquip}
          room={room}
          listenersRef={listenersRef}
          onStart={handleStart}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'game' && mission && (
        <GameCanvas
          mission={mission}
          localName={name}
          localColor={color}
          weaponId={progress.weaponId}
          armorId={progress.armorId}
          startLevel={progress.level}
          startXp={progress.xp}
          startMaterials={progress.materials}
          room={room}
          listenersRef={listenersRef}
          onExit={handleExit}
        />
      )}
    </>
  )
}
