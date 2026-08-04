import { useEffect, useRef, useState } from 'react'
import MainMenu from './ui/MainMenu'
import Lobby from './ui/Lobby'
import CampScreen, { type Progress } from './ui/CampScreen'
import GameCanvas from './game/GameCanvas'
import PlatformerCanvas from './game/PlatformerCanvas'
import type { MissionDef } from './game/types'
import { WEAPON_MAX_TIER, WEAPON_TIER_UPGRADE_COST, armorIdForLevel, defaultAbilityForClass, weaponIdForClassTier } from './game/data'
import { MultiplayerRoom, makePlayerId, type Listeners } from './supabase/multiplayer'

type Screen = 'menu' | 'lobby' | 'camp' | 'game'

const STORAGE_KEY = 'rohan_coop_save_v1'

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { name: string; color: string; classId?: string } & Progress
  } catch {
    return null
  }
}

function persistSave(data: { name: string; color: string; classId: string } & Progress) {
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
  const [classId, setClassId] = useState(saved?.classId ?? 'guerrero')
  const [progress, setProgress] = useState<Progress>(
    saved
      ? {
          level: saved.level,
          xp: saved.xp,
          materials: saved.materials,
          gold: saved.gold ?? 0,
          weaponTier: saved.weaponTier ?? 1,
          ultimateRank: saved.ultimateRank ?? 1,
          activeAbilityId: saved.activeAbilityId ?? defaultAbilityForClass(saved.classId ?? 'guerrero'),
          unlockedAbilityIds: saved.unlockedAbilityIds ?? [defaultAbilityForClass(saved.classId ?? 'guerrero')],
        }
      : {
          level: 1,
          xp: 0,
          materials: 0,
          gold: 0,
          weaponTier: 1,
          ultimateRank: 1,
          activeAbilityId: defaultAbilityForClass('guerrero'),
          unlockedAbilityIds: [defaultAbilityForClass('guerrero')],
        }
  )
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [mission, setMission] = useState<MissionDef | null>(null)

  useEffect(() => {
    persistSave({ name, color, classId, ...progress })
  }, [name, color, classId, progress])

  function handleNewGame() {
    setProgress({
      level: 1,
      xp: 0,
      materials: 0,
      gold: 0,
      weaponTier: 1,
      ultimateRank: 1,
      activeAbilityId: defaultAbilityForClass(classId),
      unlockedAbilityIds: [defaultAbilityForClass(classId)],
    })
  }

  function applyClassChoice(cls: string) {
    if (cls === classId) return
    setClassId(cls)
    setProgress((prev) => ({
      ...prev,
      activeAbilityId: defaultAbilityForClass(cls),
      unlockedAbilityIds: [defaultAbilityForClass(cls)],
      ultimateRank: 1,
      weaponTier: 1,
    }))
  }

  function handleSolo(n: string, c: string, cls: string) {
    setName(n)
    setColor(c)
    applyClassChoice(cls)
    setRoom(null)
    setScreen('camp')
  }

  function handleMultiplayer(n: string, c: string, cls: string) {
    setName(n)
    setColor(c)
    applyClassChoice(cls)
    setScreen('lobby')
  }

  function handleUnlockAbility(abilityId: string, cost: number) {
    setProgress((prev) => {
      if (prev.unlockedAbilityIds.includes(abilityId) || prev.materials < cost) return prev
      return { ...prev, materials: prev.materials - cost, unlockedAbilityIds: [...prev.unlockedAbilityIds, abilityId] }
    })
  }

  function handleSelectAbility(abilityId: string) {
    setProgress((prev) => {
      if (!prev.unlockedAbilityIds.includes(abilityId)) return prev
      return { ...prev, activeAbilityId: abilityId, ultimateRank: 1 }
    })
  }

  function handleUpgradeUltimate() {
    setProgress((prev) => ({ ...prev, ultimateRank: prev.ultimateRank + 1 }))
  }

  function handleUpgradeWeapon() {
    setProgress((prev) => {
      if (prev.weaponTier >= WEAPON_MAX_TIER) return prev
      const cost = WEAPON_TIER_UPGRADE_COST[prev.weaponTier - 1]
      if (prev.gold < cost) return prev
      return { ...prev, gold: prev.gold - cost, weaponTier: prev.weaponTier + 1 }
    })
  }

  function handleStart(m: MissionDef) {
    setMission(m)
    setScreen('game')
  }

  function handleExit(result: { finalLevel: number; finalXp: number; finalMaterials: number; finalGold: number }) {
    setProgress((prev) => ({
      ...prev,
      level: result.finalLevel,
      xp: result.finalXp,
      materials: result.finalMaterials,
      gold: result.finalGold,
    }))
    setScreen('camp')
  }

  const weaponId = weaponIdForClassTier(classId, progress.weaponTier)
  const armorId = armorIdForLevel(progress.level)

  return (
    <>
      {screen === 'menu' && (
        <MainMenu
          initialName={name}
          initialColor={color}
          initialClassId={classId}
          progress={progress}
          onSolo={handleSolo}
          onMultiplayer={handleMultiplayer}
          onNewGame={handleNewGame}
        />
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
          classId={classId}
          onUnlockAbility={handleUnlockAbility}
          onSelectAbility={handleSelectAbility}
          onUpgradeUltimate={handleUpgradeUltimate}
          onUpgradeWeapon={handleUpgradeWeapon}
          room={room}
          listenersRef={listenersRef}
          onStart={handleStart}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'game' && mission && mission.mode === 'plataformas' && (
        <PlatformerCanvas
          mission={mission}
          localName={name}
          localColor={color}
          classId={classId}
          weaponId={weaponId}
          armorId={armorId}
          startLevel={progress.level}
          startXp={progress.xp}
          startMaterials={progress.materials}
          startGold={progress.gold}
          room={room}
          listenersRef={listenersRef}
          onExit={handleExit}
        />
      )}

      {screen === 'game' && mission && mission.mode !== 'plataformas' && (
        <GameCanvas
          mission={mission}
          localName={name}
          localColor={color}
          classId={classId}
          ultimateRank={progress.ultimateRank}
          activeAbilityId={progress.activeAbilityId}
          weaponId={weaponId}
          armorId={armorId}
          startLevel={progress.level}
          startXp={progress.xp}
          startMaterials={progress.materials}
          startGold={progress.gold}
          room={room}
          listenersRef={listenersRef}
          onExit={handleExit}
        />
      )}
    </>
  )
}
