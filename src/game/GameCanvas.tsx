import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { MissionDef, EnemyInstance, Vec2 } from './types'
import { ENEMIES, getAbility, getArmor, getClass, getWeapon, ultimateCooldownMult, ultimatePowerMult, xpToNextLevel } from './data'
import { MultiplayerRoom, type NetPlayerUpdate, type Listeners } from '../supabase/multiplayer'
import HUD, { type HudState } from '../ui/HUD'
import TouchControls from '../ui/TouchControls'
import { drawBar, drawHumanoid } from './render'

interface LocalPlayer {
  id: string
  name: string
  color: string
  pos: Vec2
  facing: Vec2
  hp: number
  maxHp: number
  level: number
  xp: number
  materials: number
  weaponId: string
  armorId: string
  classId: string
  activeAbilityId: string
  ultimateRank: number
  attackCooldownLeft: number
  attackAnim: number
  hitFlash: number
  alive: boolean
  blocking: boolean
  ultimateCooldownLeft: number
  ultimateShieldUntil: number
  buffUntil: number
  buffDamageMult: number
  buffAtkSpeedMult: number
  buffSpeedMult: number
}

const BLOCK_SPEED_MULT = 0.5
const BLOCK_DAMAGE_MULT = 0.22
const ENEMY_TELEGRAPH_WINDOW = 0.45
const ULTIMATE_SHIELD_DAMAGE_MULT = 0.08
const ATTACK_SWING_DURATION = 0.135
const RANGED_ATTACK_RANGE = 230

function damageReductionFromDefense(defense: number) {
  return defense / (defense + 50)
}

interface RemotePlayer extends NetPlayerUpdate {
  lastSeen: number
}

interface FloatingText {
  pos: Vec2
  text: string
  color: string
  life: number
  vy: number
}

interface ArrowVisual {
  from: Vec2
  to: Vec2
  t: number
  kind?: 'arrow' | 'bolt'
}

const ARROW_FLIGHT_TIME = 0.28

const WORLD_W = 2200
const WORLD_H = 1600
const BASE_POS: Vec2 = { x: WORLD_W / 2, y: WORLD_H / 2 }
const BASE_MAX_HP = 1000
const BASE_ATTACK_RANGE = 46

// Geometría del castillo: un patio amurallado cuadrado centrado en BASE_POS,
// con una torre en cada esquina y una puerta en el medio de cada muro.
const CASTLE_CX = BASE_POS.x
const CASTLE_CY = BASE_POS.y
const CASTLE_R_OUT = 280
const CASTLE_WALL_THICK = 34
const CASTLE_R_IN = CASTLE_R_OUT - CASTLE_WALL_THICK
const CASTLE_GATE_HALF = 70

// Colisión simple contra el muro: bloquea el movimiento salvo en las 4 puertas,
// lo que hace que jugadores y enemigos "resbalen" por el muro hasta encontrar una.
function isBlockedByWall(pos: Vec2): boolean {
  const ax = Math.abs(pos.x - CASTLE_CX)
  const ay = Math.abs(pos.y - CASTLE_CY)
  if (ax > CASTLE_R_OUT || ay > CASTLE_R_OUT) return false
  if (ax <= CASTLE_R_IN && ay <= CASTLE_R_IN) return false
  const inNorthSouthBand = ay > CASTLE_R_IN
  const inEastWestBand = ax > CASTLE_R_IN
  if (inNorthSouthBand && inEastWestBand) return true
  if (inNorthSouthBand) return ax > CASTLE_GATE_HALF
  if (inEastWestBand) return ay > CASTLE_GATE_HALF
  return false
}

export interface GameCanvasProps {
  mission: MissionDef
  localName: string
  localColor: string
  classId: string
  activeAbilityId: string
  ultimateRank: number
  weaponId: string
  armorId: string
  startLevel: number
  startXp: number
  startMaterials: number
  room: MultiplayerRoom | null
  listenersRef: MutableRefObject<Listeners>
  onExit: (result: {
    victory: boolean
    xpEarned: number
    materialsEarned: number
    finalLevel: number
    finalXp: number
    finalMaterials: number
  }) => void
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y)
  if (len < 0.0001) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

function pickEnemyDefForWave(wave: number, forDefense: boolean): string {
  const roll = Math.random()
  if (wave >= 4 && roll < 0.15) return 'berserker_uruk'
  if (wave >= 2 && roll < 0.4) return 'arquero_uruk'
  if (roll < 0.7) return 'orco_guerrero'
  return forDefense ? 'orco_explorador' : 'orco_explorador'
}

export default function GameCanvas({
  mission,
  localName,
  localColor,
  classId,
  activeAbilityId,
  ultimateRank,
  weaponId,
  armorId,
  startLevel,
  startXp,
  startMaterials,
  room,
  listenersRef,
  onExit,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [result, setResult] = useState<{
    victory: boolean
    xpEarned: number
    materialsEarned: number
    finalLevel: number
    finalXp: number
    finalMaterials: number
  } | null>(null)

  const isHostRef = useRef<boolean>(!room)
  const materialsEarnedRef = useRef(0)
  const xpEarnedRef = useRef(0)

  const localRef = useRef<LocalPlayer>({
    id: room?.playerId ?? 'solo',
    name: localName,
    color: localColor,
    pos: { x: BASE_POS.x - 60, y: BASE_POS.y - 60 },
    facing: { x: 0, y: 1 },
    hp: getArmor(armorId).hpBonus + 90,
    maxHp: getArmor(armorId).hpBonus + 90,
    level: startLevel,
    xp: startXp,
    materials: startMaterials,
    weaponId,
    armorId,
    classId,
    activeAbilityId,
    ultimateRank,
    attackCooldownLeft: 0,
    attackAnim: 0,
    hitFlash: 0,
    alive: true,
    blocking: false,
    ultimateCooldownLeft: 0,
    ultimateShieldUntil: 0,
    buffUntil: 0,
    buffDamageMult: 1,
    buffAtkSpeedMult: 1,
    buffSpeedMult: 1,
  })

  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map())
  const enemiesRef = useRef<Map<string, EnemyInstance>>(new Map())
  const floatingRef = useRef<FloatingText[]>([])
  const arrowsRef = useRef<ArrowVisual[]>([])
  const remoteSwingRef = useRef<Map<string, number>>(new Map())
  const pendingShotRef = useRef<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null)
  const keysRef = useRef<Record<string, boolean>>({})
  const joystickRef = useRef<Vec2>({ x: 0, y: 0 })
  const attackHeldRef = useRef(false)
  const lastAttackTapRef = useRef(0)
  const blockHeldRef = useRef(false)

  const missionStateRef = useRef({
    wave: 1,
    timeLeft: mission.durationSec ?? 0,
    kills: 0,
    baseHp: BASE_MAX_HP,
    spawnTimer: 0,
    waveClearedPause: 0,
    bossSpawned: false,
    finished: false,
    victory: false,
  })

  const pendingKillAnnounceRef = useRef<{
    killerId: string
    xpReward: number
    enemyName: string
    enemyUid: string
    materialsDrop: number
  } | null>(null)

  function grantXpAndMaterials(xpReward: number, materialsDrop: number, enemyName: string) {
    const lp = localRef.current
    lp.xp += xpReward
    lp.materials += materialsDrop
    materialsEarnedRef.current += materialsDrop
    xpEarnedRef.current += xpReward
    floatingRef.current.push({
      pos: { ...lp.pos },
      text: `+${xpReward} XP`,
      color: '#C9A227',
      life: 1.1,
      vy: -30,
    })
    let leveled = false
    while (lp.xp >= xpToNextLevel(lp.level)) {
      lp.xp -= xpToNextLevel(lp.level)
      lp.level += 1
      lp.maxHp += 12
      lp.hp = lp.maxHp
      leveled = true
    }
    if (leveled) {
      floatingRef.current.push({ pos: { ...lp.pos }, text: '¡Subiste de nivel!', color: '#7FD1AE', life: 1.4, vy: -22 })
    }
    void enemyName
  }

  function applyHitToEnemy(uid: string, damage: number, attackerId: string, attackerPos: Vec2) {
    const e = enemiesRef.current.get(uid)
    if (!e) return
    e.hp -= damage
    e.hitFlash = 0.15
    floatingRef.current.push({ pos: { ...e.pos }, text: String(Math.round(damage)), color: '#E8DFC8', life: 0.6, vy: -40 })
    void attackerPos
    if (e.hp <= 0) {
      enemiesRef.current.delete(uid)
      const def = ENEMIES[e.defId]
      missionStateRef.current.kills += 1
      const materialsDrop = def.isBoss ? 60 : Math.max(1, Math.ceil(def.xpReward / 4))
      pendingKillAnnounceRef.current = {
        killerId: attackerId,
        xpReward: def.xpReward,
        enemyName: def.name,
        enemyUid: uid,
        materialsDrop,
      }
      if (attackerId === localRef.current.id) {
        grantXpAndMaterials(def.xpReward, materialsDrop, def.name)
      }
    }
  }

  function applyDamageToLocal(amount: number) {
    const lp = localRef.current
    if (!lp.alive) return
    const armor = getArmor(lp.armorId)
    let dmg = amount * (1 - damageReductionFromDefense(armor.defense))
    if (performance.now() < lp.ultimateShieldUntil) {
      dmg *= ULTIMATE_SHIELD_DAMAGE_MULT
      floatingRef.current.push({ pos: { ...lp.pos }, text: 'Coraza', color: '#8A7A5C', life: 0.6, vy: -30 })
    } else if (lp.blocking) {
      dmg *= BLOCK_DAMAGE_MULT
      floatingRef.current.push({ pos: { ...lp.pos }, text: 'Bloqueado', color: '#4C6B8A', life: 0.6, vy: -30 })
    }
    lp.hp -= dmg
    lp.hitFlash = 0.2
    if (lp.hp <= 0) {
      lp.hp = 0
      lp.alive = false
    }
  }

  function castUltimate() {
    const lp = localRef.current
    if (!lp.alive || lp.ultimateCooldownLeft > 0) return
    const ability = getAbility(lp.activeAbilityId)
    const power = ultimatePowerMult(lp.ultimateRank)
    lp.ultimateCooldownLeft = ability.cooldown * ultimateCooldownMult(lp.ultimateRank)
    const weapon = getWeapon(lp.weaponId)

    if (ability.archetype === 'nuke') {
      const radius = (ability.radius ?? 150) * power
      const mult = ability.damageMult ?? 1.5
      enemiesRef.current.forEach((e, uid) => {
        if (dist(lp.pos, e.pos) <= radius) {
          const dmg = weapon.damage * mult * (1 + lp.level * 0.025)
          if (isHostRef.current) applyHitToEnemy(uid, dmg, lp.id, lp.pos)
          else room?.sendHitRequest({ enemyUid: uid, damage: dmg, attackerId: lp.id, isCrit: false })
        }
      })
    } else if (ability.archetype === 'burst') {
      const range = (ability.burstRange ?? 250) * power
      const mult = ability.damageMult ?? 4
      let nearestUid: string | null = null
      let nearestD = Infinity
      enemiesRef.current.forEach((e, uid) => {
        const d = dist(lp.pos, e.pos)
        if (d <= range && d < nearestD) {
          nearestD = d
          nearestUid = uid
        }
      })
      if (nearestUid) {
        const dmg = weapon.damage * mult * (1 + lp.level * 0.025)
        if (isHostRef.current) applyHitToEnemy(nearestUid, dmg, lp.id, lp.pos)
        else room?.sendHitRequest({ enemyUid: nearestUid, damage: dmg, attackerId: lp.id, isCrit: true })
      }
    } else if (ability.archetype === 'shield') {
      lp.ultimateShieldUntil = performance.now() + (ability.shieldDuration ?? 4) * power * 1000
      lp.hp = Math.min(lp.maxHp, lp.hp + lp.maxHp * (ability.healPct ?? 0.25) * power)
    } else if (ability.archetype === 'buff') {
      lp.buffUntil = performance.now() + (ability.buffDuration ?? 6) * power * 1000
      lp.buffDamageMult = ability.buffDamageMult ?? 1
      lp.buffAtkSpeedMult = ability.buffAtkSpeedMult ?? 1
      lp.buffSpeedMult = ability.buffSpeedMult ?? 1
    }

    floatingRef.current.push({ pos: { ...lp.pos }, text: `¡${ability.name}!`, color: ability.color, life: 1.3, vy: -24 })
  }

  function tryLocalAttack(now: number) {
    const lp = localRef.current
    if (!lp.alive || lp.attackCooldownLeft > 0) return
    const weapon = getWeapon(lp.weaponId)
    const cls = getClass(lp.classId)
    const buffActive = performance.now() < lp.buffUntil
    const dmgMult = buffActive ? lp.buffDamageMult : 1
    lp.attackCooldownLeft = 1 / weapon.attackSpeed / (buffActive ? lp.buffAtkSpeedMult : 1)
    lp.attackAnim = ATTACK_SWING_DURATION

    if (cls.ranged) {
      // arco/bastón: un solo disparo al enemigo más cercano dentro del alcance
      let nearestUid: string | null = null
      let nearestE: EnemyInstance | null = null
      let nearestD = Infinity
      enemiesRef.current.forEach((e, uid) => {
        const d = dist(lp.pos, e.pos)
        if (d <= RANGED_ATTACK_RANGE && d < nearestD) {
          nearestD = d
          nearestUid = uid
          nearestE = e
        }
      })
      if (nearestUid && nearestE) {
        const targetPos: Vec2 = (nearestE as EnemyInstance).pos
        lp.facing = normalize({ x: targetPos.x - lp.pos.x, y: targetPos.y - lp.pos.y })
        const crit = Math.random() < weapon.critChance
        const dmg = weapon.damage * dmgMult * (1 + lp.level * 0.025) * (crit ? 1.8 : 1)
        arrowsRef.current.push({ from: { ...lp.pos }, to: { ...targetPos }, t: 0, kind: cls.weaponShape === 'staff' ? 'bolt' : 'arrow' })
        if (isHostRef.current) {
          applyHitToEnemy(nearestUid, dmg, lp.id, lp.pos)
        } else {
          room?.sendHitRequest({ enemyUid: nearestUid, damage: dmg, attackerId: lp.id, isCrit: crit })
        }
      }
      return
    }

    enemiesRef.current.forEach((e, uid) => {
      if (dist(lp.pos, e.pos) <= weapon.range) {
        const crit = Math.random() < weapon.critChance
        const dmg = weapon.damage * dmgMult * (1 + lp.level * 0.025) * (crit ? 1.8 : 1)
        if (isHostRef.current) {
          applyHitToEnemy(uid, dmg, lp.id, lp.pos)
        } else {
          room?.sendHitRequest({ enemyUid: uid, damage: dmg, attackerId: lp.id, isCrit: crit })
        }
      }
    })
    void now
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let lastTs = performance.now()
    let lastNetworkSend = 0
    let lastHostBroadcast = 0

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function onKeyDown(e: KeyboardEvent) {
      keysRef.current[e.key.toLowerCase()] = true
      if (e.key === ' ') attackHeldRef.current = true
      if (e.key === 'Shift') blockHeldRef.current = true
      if (e.key.toLowerCase() === 'e') castUltimate()
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current[e.key.toLowerCase()] = false
      if (e.key === ' ') attackHeldRef.current = false
      if (e.key === 'Shift') blockHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function onClick() {
      lastAttackTapRef.current = performance.now()
    }
    canvas.addEventListener('click', onClick)

    function spawnEnemy(defId: string, pos: Vec2) {
      const def = ENEMIES[defId]
      const uid = 'e_' + Math.random().toString(36).slice(2, 10)
      enemiesRef.current.set(uid, {
        uid,
        defId,
        pos,
        hp: def.hp,
        maxHp: def.hp,
        attackCooldownLeft: 0.4,
        targetId: null,
        hitFlash: 0,
      })
    }

    function randomEdgeSpawnPos(): Vec2 {
      const side = Math.floor(Math.random() * 4)
      if (side === 0) return { x: Math.random() * WORLD_W, y: 40 }
      if (side === 1) return { x: Math.random() * WORLD_W, y: WORLD_H - 40 }
      if (side === 2) return { x: 40, y: Math.random() * WORLD_H }
      return { x: WORLD_W - 40, y: Math.random() * WORLD_H }
    }

    function allAlivePlayers(): { id: string; pos: Vec2; alive: boolean }[] {
      const list: { id: string; pos: Vec2; alive: boolean }[] = [
        { id: localRef.current.id, pos: localRef.current.pos, alive: localRef.current.alive },
      ]
      remotePlayersRef.current.forEach((rp) => list.push({ id: rp.id, pos: rp.pos, alive: rp.hp > 0 }))
      return list
    }

    function hostUpdateMission(dt: number) {
      const ms = missionStateRef.current
      if (ms.finished) return

      if (mission.mode === 'oleadas') {
        const aliveEnemies = enemiesRef.current.size
        if (ms.waveClearedPause > 0) {
          ms.waveClearedPause -= dt
        } else if (aliveEnemies === 0 && !ms.bossSpawned) {
          if (ms.wave > (mission.waveCount ?? 6)) {
            ms.bossSpawned = true
            spawnEnemy('jefe_ugluk', { x: WORLD_W / 2, y: 80 })
            floatingRef.current.push({ pos: { x: WORLD_W / 2, y: 200 }, text: '¡Ugluk ha llegado!', color: '#C1502E', life: 2, vy: -10 })
          } else {
            const count = 2 + Math.floor(ms.wave * 1.5)
            for (let i = 0; i < count; i++) spawnEnemy(pickEnemyDefForWave(ms.wave, false), randomEdgeSpawnPos())
            ms.wave += 1
            ms.waveClearedPause = 3.5
          }
        } else if (ms.bossSpawned && aliveEnemies === 0) {
          ms.finished = true
          ms.victory = true
        }
      } else if (mission.mode === 'defensa') {
        ms.timeLeft -= dt
        ms.spawnTimer -= dt
        const intensity = 1 + (mission.durationSec! - ms.timeLeft) / 70
        if (ms.spawnTimer <= 0) {
          ms.spawnTimer = Math.max(0.9, 2.6 / intensity)
          spawnEnemy(pickEnemyDefForWave(Math.floor(intensity), true), randomEdgeSpawnPos())
        }
        if (ms.baseHp <= 0) {
          ms.finished = true
          ms.victory = false
        } else if (ms.timeLeft <= 0) {
          ms.finished = true
          ms.victory = true
        }
      } else if (mission.mode === 'mision') {
        ms.spawnTimer -= dt
        if (ms.spawnTimer <= 0 && enemiesRef.current.size < 8) {
          ms.spawnTimer = 1.7
          spawnEnemy(pickEnemyDefForWave(2, false), randomEdgeSpawnPos())
        }
        if (ms.kills >= (mission.killTarget ?? 40)) {
          ms.finished = true
          ms.victory = true
        }
      }

      const players = allAlivePlayers()
      if (players.length > 0 && players.every((p) => !p.alive)) {
        ms.finished = true
        ms.victory = false
      }
    }

    function hostUpdateEnemies(dt: number) {
      const players = allAlivePlayers().filter((p) => p.alive)
      enemiesRef.current.forEach((e) => {
        const def = ENEMIES[e.defId]
        let targetPos: Vec2 | null = null
        let targetIsBase = false
        if (mission.mode === 'defensa') {
          let nearestPlayer: { id: string; pos: Vec2 } | null = null
          let nearestD = Infinity
          for (const p of players) {
            const d = dist(e.pos, p.pos)
            if (d < nearestD) {
              nearestD = d
              nearestPlayer = p
            }
          }
          if (nearestPlayer && nearestD < 190) {
            targetPos = nearestPlayer.pos
            e.targetId = nearestPlayer.id
          } else {
            targetPos = BASE_POS
            targetIsBase = true
            e.targetId = null
          }
        } else {
          let nearestPlayer: { id: string; pos: Vec2 } | null = null
          let nearestD = Infinity
          for (const p of players) {
            const d = dist(e.pos, p.pos)
            if (d < nearestD) {
              nearestD = d
              nearestPlayer = p
            }
          }
          if (nearestPlayer) {
            targetPos = nearestPlayer.pos
            e.targetId = nearestPlayer.id
          }
        }

        if (!targetPos) return
        const d = dist(e.pos, targetPos)
        const attackRange = targetIsBase ? BASE_ATTACK_RANGE : def.attackRange
        if (d > attackRange) {
          const dir = normalize({ x: targetPos.x - e.pos.x, y: targetPos.y - e.pos.y })
          const targetX = e.pos.x + dir.x * def.speed * dt
          const targetY = e.pos.y + dir.y * def.speed * dt
          let nx = e.pos.x
          let ny = e.pos.y
          if (!isBlockedByWall({ x: targetX, y: e.pos.y })) nx = targetX
          if (!isBlockedByWall({ x: nx, y: targetY })) ny = targetY
          e.pos = { x: nx, y: ny }
        } else {
          e.attackCooldownLeft -= dt
          if (e.attackCooldownLeft <= 0) {
            e.attackCooldownLeft = def.attackCooldown
            if (def.ranged) {
              const shot = { fromX: e.pos.x, fromY: e.pos.y, toX: targetPos.x, toY: targetPos.y }
              pendingShotRef.current = shot
              arrowsRef.current.push({ from: { x: shot.fromX, y: shot.fromY }, to: { x: shot.toX, y: shot.toY }, t: 0 })
            }
            if (targetIsBase) {
              missionStateRef.current.baseHp = Math.max(0, missionStateRef.current.baseHp - def.damage)
            } else if (e.targetId === localRef.current.id) {
              applyDamageToLocal(def.damage)
            } else if (e.targetId) {
              room?.sendPlayerDamage({ targetId: e.targetId, amount: def.damage })
            }
          }
        }
        if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt)
      })
    }

    function updateLocalPlayer(dt: number) {
      const lp = localRef.current
      if (!lp.alive) return
      lp.blocking = blockHeldRef.current
      if (lp.ultimateCooldownLeft > 0) lp.ultimateCooldownLeft = Math.max(0, lp.ultimateCooldownLeft - dt)
      let mv = { x: 0, y: 0 }
      if (keysRef.current['w'] || keysRef.current['arrowup']) mv.y -= 1
      if (keysRef.current['s'] || keysRef.current['arrowdown']) mv.y += 1
      if (keysRef.current['a'] || keysRef.current['arrowleft']) mv.x -= 1
      if (keysRef.current['d'] || keysRef.current['arrowright']) mv.x += 1
      if (joystickRef.current.x !== 0 || joystickRef.current.y !== 0) mv = { ...joystickRef.current }
      mv = normalize(mv)
      const armor = getArmor(lp.armorId)
      const buffSpeed = performance.now() < lp.buffUntil ? lp.buffSpeedMult : 1
      const speed = 150 * armor.speedMod * (1 + lp.level * 0.004) * (lp.blocking ? BLOCK_SPEED_MULT : 1) * buffSpeed
      if (mv.x !== 0 || mv.y !== 0) {
        lp.facing = mv
        const targetX = Math.min(WORLD_W - 20, Math.max(20, lp.pos.x + mv.x * speed * dt))
        const targetY = Math.min(WORLD_H - 20, Math.max(20, lp.pos.y + mv.y * speed * dt))
        let nx = lp.pos.x
        let ny = lp.pos.y
        if (!isBlockedByWall({ x: targetX, y: lp.pos.y })) nx = targetX
        if (!isBlockedByWall({ x: nx, y: targetY })) ny = targetY
        lp.pos = { x: nx, y: ny }
      }
      if (lp.attackCooldownLeft > 0) lp.attackCooldownLeft -= dt
      if (lp.attackAnim > 0) lp.attackAnim -= dt
      if (lp.hitFlash > 0) lp.hitFlash -= dt

      const now = performance.now()
      if (!lp.blocking && (attackHeldRef.current || now - lastAttackTapRef.current < 120)) {
        tryLocalAttack(now)
      }
    }

    function loop(ts: number) {
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts

      updateLocalPlayer(dt)

      if (isHostRef.current) {
        hostUpdateEnemies(dt)
        hostUpdateMission(dt)
      }

      // Enviar estado propio por red
      if (room && ts - lastNetworkSend > 80) {
        lastNetworkSend = ts
        const lp = localRef.current
        room.sendPlayerUpdate({
          id: lp.id,
          name: lp.name,
          color: lp.color,
          pos: lp.pos,
          facing: lp.facing,
          hp: lp.hp,
          maxHp: lp.maxHp,
          level: lp.level,
          attacking: lp.attackAnim > 0,
          blocking: lp.blocking,
          weaponId: lp.weaponId,
          armorId: lp.armorId,
          classId: lp.classId,
        })
      }

      // Host transmite estado del mundo
      if (room && isHostRef.current && ts - lastHostBroadcast > 100) {
        lastHostBroadcast = ts
        const ms = missionStateRef.current
        room.sendEnemySync({
          enemies: Array.from(enemiesRef.current.values()),
          missionTimeLeft: ms.timeLeft,
          baseHp: ms.baseHp,
          wave: ms.wave,
          kills: ms.kills,
          finished: ms.finished,
          victory: ms.victory,
          lastKill: pendingKillAnnounceRef.current ?? undefined,
          lastShot: pendingShotRef.current ?? undefined,
        })
        pendingKillAnnounceRef.current = null
        pendingShotRef.current = null
      }

      // Actualizar textos flotantes
      floatingRef.current = floatingRef.current.filter((f) => f.life > 0)
      floatingRef.current.forEach((f) => {
        f.life -= dt
        f.pos = { x: f.pos.x, y: f.pos.y + f.vy * dt }
      })

      arrowsRef.current = arrowsRef.current.filter((a) => a.t < 1)
      arrowsRef.current.forEach((a) => {
        a.t = Math.min(1, a.t + dt / ARROW_FLIGHT_TIME)
      })

      render(dt)

      if (missionStateRef.current.finished && !result) {
        const lp = localRef.current
        setResult({
          victory: missionStateRef.current.victory,
          xpEarned: xpEarnedRef.current,
          materialsEarned: materialsEarnedRef.current,
          finalLevel: lp.level,
          finalXp: lp.xp,
          finalMaterials: lp.materials,
        })
      }

      // HUD throttle
      if (Math.floor(ts / 150) !== Math.floor(lastTs / 150)) {
        // noop, using separate interval below
      }

      raf = requestAnimationFrame(loop)
    }

    function render(dt: number) {
      const w = canvas.width
      const h = canvas.height
      const lp = localRef.current
      const camX = Math.min(WORLD_W - w / 2, Math.max(w / 2, lp.pos.x))
      const camY = Math.min(WORLD_H - h / 2, Math.max(h / 2, lp.pos.y))

      ctx.fillStyle = '#141910'
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.translate(w / 2 - camX, h / 2 - camY)

      // Suelo con grilla sutil
      const grad = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 100, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.8)
      grad.addColorStop(0, '#232C1B')
      grad.addColorStop(1, '#0F130C')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, WORLD_W, WORLD_H)
      ctx.strokeStyle = 'rgba(233, 223, 200, 0.05)'
      ctx.lineWidth = 1
      for (let x = 0; x <= WORLD_W; x += 80) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, WORLD_H)
        ctx.stroke()
      }
      for (let y = 0; y <= WORLD_H; y += 80) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(WORLD_W, y)
        ctx.stroke()
      }
      // borde del mundo
      ctx.strokeStyle = 'rgba(193, 80, 46, 0.35)'
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6)

      // castillo: patio amurallado con torres y puertas, siempre presente
      drawCastle()

      // torreón central: siempre visible; solo muestra vida cuando hay que defenderlo
      drawKeep()
      if (mission.mode === 'defensa') {
        const ms = missionStateRef.current
        ctx.fillStyle = '#E8DFC8'
        ctx.font = 'bold 13px Cinzel, serif'
        ctx.textAlign = 'center'
        ctx.fillText('FORTALEZA', BASE_POS.x, BASE_POS.y + 5)
        drawBar(ctx, BASE_POS.x - 50, BASE_POS.y - 90, 100, 10, ms.baseHp / BASE_MAX_HP, '#C1502E')
      }

      // enemigos
      enemiesRef.current.forEach((e) => {
        const def = ENEMIES[e.defId]
        const r = def.radius
        const targetPos = getEntityPosById(e.targetId) ?? BASE_POS
        const facing = normalize({ x: targetPos.x - e.pos.x, y: targetPos.y - e.pos.y })
        const telegraphing = e.attackCooldownLeft > 0 && e.attackCooldownLeft <= ENEMY_TELEGRAPH_WINDOW

        if (telegraphing) {
          const pulse = 1 - e.attackCooldownLeft / ENEMY_TELEGRAPH_WINDOW
          ctx.beginPath()
          ctx.arc(e.pos.x, e.pos.y, r + 6 + pulse * 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(217, 103, 63, ${0.35 + pulse * 0.5})`
          ctx.lineWidth = 3
          ctx.stroke()
        }

        drawHumanoid(ctx, e.pos, facing, r, def.color, '#20241A', def.isBoss ? '#C9A227' : 'rgba(0,0,0,0.45)', def.isBoss ? 3 : 1.5, e.hitFlash > 0, {
          tusks: true,
          crown: def.isBoss,
          weaponShape: def.ranged ? 'bow' : undefined,
        })
        drawBar(ctx, e.pos.x - r, e.pos.y - r - 12, r * 2, 5, e.hp / e.maxHp, def.isBoss ? '#C9A227' : '#8B3A2B')
        if (def.isBoss) {
          ctx.fillStyle = '#C9A227'
          ctx.font = 'bold 12px Cinzel, serif'
          ctx.textAlign = 'center'
          ctx.fillText(def.name, e.pos.x, e.pos.y - r - 18)
        }
      })

      // jugadores remotos
      remotePlayersRef.current.forEach((rp) => {
        const wasAttacking = remoteSwingRef.current.has(rp.id)
        const swingT = getRemoteSwingT(rp.id, rp.attacking, dt)
        const rpCls = getClass(rp.classId)
        if (rp.attacking && !wasAttacking && rpCls.ranged) {
          const to = { x: rp.pos.x + rp.facing.x * RANGED_ATTACK_RANGE, y: rp.pos.y + rp.facing.y * RANGED_ATTACK_RANGE }
          arrowsRef.current.push({ from: { ...rp.pos }, to, t: 0, kind: rpCls.weaponShape === 'staff' ? 'bolt' : 'arrow' })
        }
        drawPlayer(ctx, rp.pos, rp.facing, rp.color, rp.name, rp.hp, rp.maxHp, false, swingT, rp.blocking, rp.weaponId, rp.classId)
      })

      // jugador local
      const localSwingT = lp.attackAnim > 0 ? 1 - lp.attackAnim / ATTACK_SWING_DURATION : 0
      drawPlayer(ctx, lp.pos, lp.facing, lp.color, lp.name + ' (vos)', lp.hp, lp.maxHp, true, localSwingT, lp.blocking, lp.weaponId, lp.classId)
      if (lp.hitFlash > 0) {
        ctx.beginPath()
        ctx.arc(lp.pos.x, lp.pos.y, 26, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(193, 80, 46, 0.8)'
        ctx.lineWidth = 3
        ctx.stroke()
      }
      if (performance.now() < lp.ultimateShieldUntil) {
        ctx.beginPath()
        ctx.arc(lp.pos.x, lp.pos.y, 30, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(76, 107, 138, 0.75)'
        ctx.lineWidth = 4
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(lp.pos.x, lp.pos.y, 34, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(127, 209, 174, 0.35)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // flechas / hechizos en vuelo
      arrowsRef.current.forEach((a) => {
        const x = a.from.x + (a.to.x - a.from.x) * a.t
        const y = a.from.y + (a.to.y - a.from.y) * a.t
        const angle = Math.atan2(a.to.y - a.from.y, a.to.x - a.from.x)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        if (a.kind === 'bolt') {
          ctx.strokeStyle = 'rgba(138, 76, 155, 0.5)'
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.moveTo(-16, 0)
          ctx.lineTo(0, 0)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(4, 0, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#C9A9E0'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(4, 0, 8, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(138, 76, 155, 0.6)'
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          ctx.strokeStyle = '#D9CBA0'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(-14, 0)
          ctx.lineTo(8, 0)
          ctx.stroke()
          ctx.fillStyle = '#8A7A5C'
          ctx.beginPath()
          ctx.moveTo(8, 0)
          ctx.lineTo(2, -3.5)
          ctx.lineTo(2, 3.5)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = 'rgba(232,223,200,0.7)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-14, 0)
          ctx.lineTo(-9, -4)
          ctx.moveTo(-14, 0)
          ctx.lineTo(-9, 4)
          ctx.stroke()
        }
        ctx.restore()
      })

      // textos flotantes
      floatingRef.current.forEach((f) => {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life))
        ctx.fillStyle = f.color
        ctx.font = 'bold 14px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.pos.x, f.pos.y)
        ctx.globalAlpha = 1
      })

      ctx.restore()
    }

    function drawCrenellations(x: number, y: number, w: number, h: number, orientation: 'h' | 'v', outerSide: -1 | 1) {
      const size = 10
      const gap = 15
      ctx.fillStyle = '#4A4438'
      if (orientation === 'h') {
        for (let px = x + 4; px < x + w - size; px += gap) {
          ctx.fillRect(px, outerSide < 0 ? y - size : y + h, size, size)
        }
      } else {
        for (let py = y + 4; py < y + h - size; py += gap) {
          ctx.fillRect(outerSide < 0 ? x - size : x + w, py, size, size)
        }
      }
    }

    function drawTower(cx: number, cy: number) {
      const r = CASTLE_WALL_THICK * 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = '#57503F'
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = '#3A3226'
      ctx.fill()
      ctx.strokeStyle = '#8A7A5C'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy - r * 0.55)
      ctx.lineTo(cx, cy - r * 1.7)
      ctx.stroke()
      ctx.fillStyle = '#C9A227'
      ctx.beginPath()
      ctx.moveTo(cx, cy - r * 1.7)
      ctx.lineTo(cx + r * 0.9, cy - r * 1.45)
      ctx.lineTo(cx, cy - r * 1.2)
      ctx.closePath()
      ctx.fill()
    }

    function drawCastle() {
      const cx = CASTLE_CX
      const cy = CASTLE_CY
      const rOut = CASTLE_R_OUT
      const rIn = CASTLE_R_IN
      const gh = CASTLE_GATE_HALF
      const t = CASTLE_WALL_THICK

      // patio empedrado
      ctx.fillStyle = '#262019'
      ctx.fillRect(cx - rIn, cy - rIn, rIn * 2, rIn * 2)
      ctx.strokeStyle = 'rgba(232, 223, 200, 0.06)'
      ctx.lineWidth = 1
      for (let x = -rIn; x <= rIn; x += 40) {
        ctx.beginPath()
        ctx.moveTo(cx + x, cy - rIn)
        ctx.lineTo(cx + x, cy + rIn)
        ctx.stroke()
      }
      for (let y = -rIn; y <= rIn; y += 40) {
        ctx.beginPath()
        ctx.moveTo(cx - rIn, cy + y)
        ctx.lineTo(cx + rIn, cy + y)
        ctx.stroke()
      }

      // muros: cada lado partido en dos segmentos alrededor de su puerta
      const segs: { x: number; y: number; w: number; h: number; orientation: 'h' | 'v'; outerSide: -1 | 1 }[] = [
        { x: cx - rOut, y: cy - rOut, w: rOut - gh, h: t, orientation: 'h', outerSide: -1 },
        { x: cx + gh, y: cy - rOut, w: rOut - gh, h: t, orientation: 'h', outerSide: -1 },
        { x: cx - rOut, y: cy + rIn, w: rOut - gh, h: t, orientation: 'h', outerSide: 1 },
        { x: cx + gh, y: cy + rIn, w: rOut - gh, h: t, orientation: 'h', outerSide: 1 },
        { x: cx - rOut, y: cy - rOut, w: t, h: rOut - gh, orientation: 'v', outerSide: -1 },
        { x: cx - rOut, y: cy + gh, w: t, h: rOut - gh, orientation: 'v', outerSide: -1 },
        { x: cx + rIn, y: cy - rOut, w: t, h: rOut - gh, orientation: 'v', outerSide: 1 },
        { x: cx + rIn, y: cy + gh, w: t, h: rOut - gh, orientation: 'v', outerSide: 1 },
      ]
      segs.forEach((s) => {
        ctx.fillStyle = '#4A4438'
        ctx.fillRect(s.x, s.y, s.w, s.h)
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 2
        ctx.strokeRect(s.x, s.y, s.w, s.h)
        drawCrenellations(s.x, s.y, s.w, s.h, s.orientation, s.outerSide)
      })

      // umbrales de las 4 puertas
      ctx.fillStyle = '#2B2118'
      ctx.fillRect(cx - gh, cy - rOut, gh * 2, t)
      ctx.fillRect(cx - gh, cy + rIn, gh * 2, t)
      ctx.fillRect(cx - rOut, cy - gh, t, gh * 2)
      ctx.fillRect(cx + rIn, cy - gh, t, gh * 2)

      // torres en las 4 esquinas
      drawTower(cx - rOut, cy - rOut)
      drawTower(cx + rOut, cy - rOut)
      drawTower(cx - rOut, cy + rOut)
      drawTower(cx + rOut, cy + rOut)
    }

    function drawKeep() {
      const { x, y } = BASE_POS
      ctx.beginPath()
      ctx.arc(x, y, 50, 0, Math.PI * 2)
      ctx.fillStyle = '#57503F'
      ctx.fill()
      ctx.strokeStyle = '#C9A227'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, 30, 0, Math.PI * 2)
      ctx.fillStyle = '#3A3226'
      ctx.fill()
      ctx.strokeStyle = '#8A7A5C'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y - 30)
      ctx.lineTo(x, y - 72)
      ctx.stroke()
      ctx.fillStyle = '#C9A227'
      ctx.beginPath()
      ctx.moveTo(x, y - 72)
      ctx.lineTo(x + 26, y - 62)
      ctx.lineTo(x, y - 52)
      ctx.closePath()
      ctx.fill()
    }

    function getRemoteSwingT(id: string, attacking: boolean, dt: number): number {
      const timers = remoteSwingRef.current
      if (!attacking) {
        timers.delete(id)
        return 0
      }
      const elapsed = Math.min(ATTACK_SWING_DURATION, (timers.get(id) ?? 0) + dt)
      timers.set(id, elapsed)
      return elapsed / ATTACK_SWING_DURATION
    }

    function drawPlayer(
      c: CanvasRenderingContext2D,
      pos: Vec2,
      facing: Vec2,
      color: string,
      name: string,
      hp: number,
      maxHp: number,
      isLocal: boolean,
      swingT: number,
      blocking: boolean,
      weaponId: string,
      classId: string
    ) {
      const cls = getClass(classId)
      const radius = 18 * cls.bodyScale
      if (swingT > 0) {
        c.beginPath()
        c.arc(pos.x, pos.y, radius + 16, 0, Math.PI * 2)
        c.strokeStyle = color
        c.globalAlpha = 0.5
        c.lineWidth = 3
        c.stroke()
        c.globalAlpha = 1
      }
      const weapon = getWeapon(weaponId)
      drawHumanoid(c, pos, facing, radius, color, '#E8DFC8', isLocal ? '#E8DFC8' : 'rgba(232,223,200,0.6)', isLocal ? 3 : 2, false, {
        shield: blocking,
        swingT,
        weaponShape: cls.weaponShape,
        legendary: weapon.rarity === 'legendario',
        beard: cls.id === 'enano',
      })
      drawBar(c, pos.x - 22, pos.y - radius * 1.9, 44, 6, Math.max(0, hp) / maxHp, '#7FD1AE')
      c.fillStyle = blocking ? '#4C6B8A' : '#E8DFC8'
      c.font = '11px Inter, sans-serif'
      c.textAlign = 'center'
      c.fillText(blocking ? `${name} 🛡` : name, pos.x, pos.y - radius * 2.2)
    }

    function getEntityPosById(id: string | null): Vec2 | null {
      if (!id) return null
      if (id === localRef.current.id) return localRef.current.pos
      const rp = remotePlayersRef.current.get(id)
      return rp ? rp.pos : null
    }


    raf = requestAnimationFrame(loop)

    const hudInterval = window.setInterval(() => {
      const lp = localRef.current
      const ms = missionStateRef.current
      setHud({
        hp: lp.hp,
        maxHp: lp.maxHp,
        level: lp.level,
        xp: lp.xp,
        xpToNext: xpToNextLevel(lp.level),
        materials: lp.materials,
        mode: mission.mode,
        wave: ms.wave,
        waveCount: mission.waveCount,
        timeLeft: ms.timeLeft,
        kills: ms.kills,
        killTarget: mission.killTarget,
        baseHp: ms.baseHp,
        baseMaxHp: BASE_MAX_HP,
        alive: lp.alive,
        playersOnline: remotePlayersRef.current.size + 1,
        ultimateName: getAbility(lp.activeAbilityId).name,
        ultimateCooldownLeft: lp.ultimateCooldownLeft,
        ultimateCooldownMax: getAbility(lp.activeAbilityId).cooldown * ultimateCooldownMult(lp.ultimateRank),
      })
    }, 150)

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(hudInterval)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('click', onClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La sala ya llega conectada desde App (join se hace una sola vez en el lobby).
  // Acá solo enchufamos los callbacks de esta pantalla en la referencia mutable compartida.
  useEffect(() => {
    if (!room) return
    isHostRef.current = room.isHost
    listenersRef.current.onPresenceChange = (members) => {
      const stillPresent = new Set(members.map((m) => m.id))
      remotePlayersRef.current.forEach((_v, id) => {
        if (!stillPresent.has(id)) remotePlayersRef.current.delete(id)
      })
      isHostRef.current = room.isHost
    }
    listenersRef.current.onPlayerUpdate = (p) => {
      remotePlayersRef.current.set(p.id, { ...p, lastSeen: Date.now() })
    }
    listenersRef.current.onEnemySync = (payload) => {
      if (isHostRef.current) return
      const map = new Map<string, EnemyInstance>()
      payload.enemies.forEach((e) => map.set(e.uid, e))
      enemiesRef.current = map
      const ms = missionStateRef.current
      if (payload.missionTimeLeft !== undefined) ms.timeLeft = payload.missionTimeLeft
      if (payload.baseHp !== undefined) ms.baseHp = payload.baseHp
      if (payload.wave !== undefined) ms.wave = payload.wave
      if (payload.kills !== undefined) ms.kills = payload.kills
      if (payload.finished) {
        ms.finished = true
        ms.victory = !!payload.victory
      }
      if (payload.lastKill && payload.lastKill.killerId === localRef.current.id) {
        grantXpAndMaterials(payload.lastKill.xpReward, payload.lastKill.materialsDrop, payload.lastKill.enemyName)
      }
      if (payload.lastShot) {
        const s = payload.lastShot
        arrowsRef.current.push({ from: { x: s.fromX, y: s.fromY }, to: { x: s.toX, y: s.toY }, t: 0 })
      }
    }
    listenersRef.current.onHitRequest = (p) => {
      if (!isHostRef.current) return
      applyHitToEnemy(p.enemyUid, p.damage, p.attackerId, localRef.current.pos)
    }
    listenersRef.current.onPlayerDamage = (p) => {
      if (p.targetId === localRef.current.id) applyDamageToLocal(p.amount)
    }

    return () => {
      listenersRef.current.onPlayerUpdate = undefined
      listenersRef.current.onEnemySync = undefined
      listenersRef.current.onHitRequest = undefined
      listenersRef.current.onPlayerDamage = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])

  if (result) {
    return (
      <div className="result-screen">
        <h1 className={result.victory ? 'result-title win' : 'result-title lose'}>
          {result.victory ? 'Victoria' : 'Derrota'}
        </h1>
        <p className="result-sub">{mission.title}</p>
        <div className="result-stats">
          <div>
            <span className="label">Experiencia ganada</span>
            <span className="value">+{Math.max(0, result.xpEarned)}</span>
          </div>
          <div>
            <span className="label">Materiales obtenidos</span>
            <span className="value">+{result.materialsEarned}</span>
          </div>
          <div>
            <span className="label">Nivel actual</span>
            <span className="value">{result.finalLevel}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => onExit(result)}>
          Volver al campamento
        </button>
      </div>
    )
  }

  return (
    <div className="game-root">
      <canvas ref={canvasRef} />
      {hud && <HUD state={hud} missionTitle={mission.title} />}
      <TouchControls
        onMove={(v) => {
          joystickRef.current = v
        }}
        onAttackStart={() => {
          attackHeldRef.current = true
        }}
        onAttackEnd={() => {
          attackHeldRef.current = false
        }}
        onBlockStart={() => {
          blockHeldRef.current = true
        }}
        onBlockEnd={() => {
          blockHeldRef.current = false
        }}
        onUltimate={castUltimate}
        ultimateCooldownLeft={hud?.ultimateCooldownLeft ?? 0}
        ultimateCooldownMax={hud?.ultimateCooldownMax ?? 1}
      />
    </div>
  )
}
