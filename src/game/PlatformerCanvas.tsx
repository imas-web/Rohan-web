import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { ChestInstance, MissionDef, EnemyInstance, Vec2 } from './types'
import { ENEMIES, enemyCountMultiplierForParty, getArmor, getClass, getWeapon, rewardMultiplierForParty, xpToNextLevel } from './data'
import { PLATFORMER_LEVEL } from './platformerLevel'
import { MultiplayerRoom, type NetPlayerUpdate, type Listeners } from '../supabase/multiplayer'
import { drawBar, drawHumanoid } from './render'
import { drawSprite, preloadSprites, type SpriteKey } from './sprites'
import PlatformerControls from '../ui/PlatformerControls'

const MOVE_SPEED = 230
const MOVE_SPEED_Y = 170
const CAMERA_ZOOM = 1.05 // acerca un poco la cámara sin perder tanto campo de visión
const CONTACT_RANGE = 30
const INVULN_DURATION = 1.4
const START_LIVES = 3
const ATTACK_SWING_DURATION = 0.135
const GOAL_MARGIN = 40
const ENEMY_SPAWN_DELAY = 0.4 // espera a que lleguen los primeros player_update de los compañeros antes de contar cuántos somos
const ENEMY_AGGRO_RANGE = 260
const ARROW_FLIGHT_TIME = 0.28

interface ArrowVisual {
  from: Vec2
  to: Vec2
  t: number
  kind?: 'arrow' | 'bolt'
}

interface LocalPlatformer {
  id: string
  name: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  hp: number
  maxHp: number
  level: number
  xp: number
  materials: number
  gold: number
  weaponId: string
  armorId: string
  attackCooldownLeft: number
  attackAnim: number
  invulnLeft: number
  alive: boolean
}

interface RemotePlatformer extends NetPlayerUpdate {
  lastSeen: number
}

interface PatrolBounds {
  minX: number
  maxX: number
  dir: 1 | -1
}

interface FloatingText {
  pos: Vec2
  text: string
  color: string
  life: number
  vy: number
}

function damageReductionFromDefense(defense: number) {
  return defense / (defense + 50)
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export interface PlatformerCanvasProps {
  mission: MissionDef
  localName: string
  localColor: string
  classId: string
  weaponId: string
  armorId: string
  startLevel: number
  startXp: number
  startMaterials: number
  startGold: number
  room: MultiplayerRoom | null
  listenersRef: MutableRefObject<Listeners>
  onExit: (result: {
    victory: boolean
    xpEarned: number
    materialsEarned: number
    finalLevel: number
    finalXp: number
    finalMaterials: number
    finalGold: number
  }) => void
}

export default function PlatformerCanvas({
  mission,
  localName,
  localColor,
  classId,
  weaponId,
  armorId,
  startLevel,
  startXp,
  startMaterials,
  startGold,
  room,
  listenersRef,
  onExit,
}: PlatformerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const level = PLATFORMER_LEVEL

  const [hud, setHud] = useState<{ hp: number; maxHp: number; lives: number; level: number; progressPct: number } | null>(null)
  const [result, setResult] = useState<{
    victory: boolean
    xpEarned: number
    materialsEarned: number
    finalLevel: number
    finalXp: number
    finalMaterials: number
    finalGold: number
  } | null>(null)

  const isHostRef = useRef<boolean>(!room)
  const materialsEarnedRef = useRef(0)
  const xpEarnedRef = useRef(0)
  const goldEarnedRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const checkpointRef = useRef<number>(level.startPos.x)
  const finishedRef = useRef(false)

  const localRef = useRef<LocalPlatformer>({
    id: room?.playerId ?? 'solo',
    name: localName,
    color: localColor,
    x: level.startPos.x,
    y: level.startPos.y,
    vx: 0,
    vy: 0,
    facing: 1,
    hp: getArmor(armorId).hpBonus + 90,
    maxHp: getArmor(armorId).hpBonus + 90,
    level: startLevel,
    xp: startXp,
    materials: startMaterials,
    gold: startGold,
    weaponId,
    armorId,
    attackCooldownLeft: 0,
    attackAnim: 0,
    invulnLeft: 0,
    alive: true,
  })

  const remotePlayersRef = useRef<Map<string, RemotePlatformer>>(new Map())
  const enemiesRef = useRef<Map<string, EnemyInstance>>(new Map())
  const patrolBoundsRef = useRef<Map<string, PatrolBounds>>(new Map())
  const chestsRef = useRef<Map<string, ChestInstance>>(new Map())
  const collectedLocallyRef = useRef<Set<string>>(new Set())
  const floatingRef = useRef<FloatingText[]>([])
  const remoteSwingRef = useRef<Map<string, number>>(new Map())
  const arrowsRef = useRef<ArrowVisual[]>([])
  const pendingShotRef = useRef<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null)

  const leftHeldRef = useRef(false)
  const rightHeldRef = useRef(false)
  const upHeldRef = useRef(false)
  const downHeldRef = useRef(false)
  const attackHeldRef = useRef(false)

  const camXRef = useRef(level.startPos.x)
  const camYRef = useRef(level.startPos.y)

  const enemiesSpawnedRef = useRef(false)
  const spawnElapsedRef = useRef(0)

  function spawnEnemies(partySize: number) {
    enemiesRef.current.clear()
    patrolBoundsRef.current.clear()
    // con más jugadores hay más copias de cada patrulla (una al lado de la
    // otra, en el mismo tramo) para que la cantidad de enemigos escale con
    // el grupo, igual que en las otras misiones.
    const copies = Math.round(enemyCountMultiplierForParty(partySize))
    let uidCounter = 0
    level.enemies.forEach((spec) => {
      const def = ENEMIES[spec.defId]
      const rangeW = Math.max(1, spec.maxX - spec.minX)
      for (let c = 0; c < copies; c++) {
        const uid = `pe_${uidCounter++}`
        const offset = c === 0 ? 0 : (c * 37) % rangeW
        const startX = spec.minX + ((spec.x - spec.minX + offset) % rangeW)
        enemiesRef.current.set(uid, {
          uid,
          defId: spec.defId,
          pos: { x: startX, y: spec.y },
          hp: def.hp,
          maxHp: def.hp,
          attackCooldownLeft: 0,
          targetId: null,
          hitFlash: 0,
        })
        patrolBoundsRef.current.set(uid, { minX: spec.minX, maxX: spec.maxX, dir: c % 2 === 0 ? 1 : -1 })
      }
    })
  }

  function allPlayerPositions(): { id: string; pos: Vec2; alive: boolean; armorId: string }[] {
    const list: { id: string; pos: Vec2; alive: boolean; armorId: string }[] = [
      { id: localRef.current.id, pos: { x: localRef.current.x, y: localRef.current.y }, alive: localRef.current.alive, armorId: localRef.current.armorId },
    ]
    remotePlayersRef.current.forEach((rp) => list.push({ id: rp.id, pos: rp.pos, alive: rp.hp > 0, armorId: rp.armorId }))
    return list
  }

  function respawnLocal() {
    const lp = localRef.current
    livesRef.current -= 1
    if (livesRef.current <= 0) {
      lp.alive = false
      return
    }
    lp.x = checkpointRef.current
    lp.y = level.goal.y
    lp.vx = 0
    lp.vy = 0
    lp.hp = lp.maxHp
    lp.invulnLeft = INVULN_DURATION
  }

  function applyDamageToLocal(amount: number) {
    const lp = localRef.current
    if (!lp.alive || lp.invulnLeft > 0 || finishedRef.current) return
    const armor = getArmor(lp.armorId)
    const dmg = amount * (1 - damageReductionFromDefense(armor.defense))
    lp.hp -= dmg
    if (lp.hp <= 0) {
      lp.hp = 0
      respawnLocal()
    }
  }

  function grantRewards(xpReward: number, materialsDrop: number) {
    const lp = localRef.current
    lp.xp += xpReward
    lp.materials += materialsDrop
    xpEarnedRef.current += xpReward
    materialsEarnedRef.current += materialsDrop
    floatingRef.current.push({ pos: { x: lp.x, y: lp.y - 40 }, text: `+${xpReward} XP`, color: '#C9A227', life: 1.1, vy: -30 })
    while (lp.xp >= xpToNextLevel(lp.level)) {
      lp.xp -= xpToNextLevel(lp.level)
      lp.level += 1
      lp.maxHp += 12
      lp.hp = lp.maxHp
    }
  }

  function grantGold(amount: number) {
    const lp = localRef.current
    lp.gold += amount
    goldEarnedRef.current += amount
    floatingRef.current.push({ pos: { x: lp.x, y: lp.y - 20 }, text: `+${amount} oro`, color: '#C9A227', life: 1.1, vy: -30 })
  }

  function tryCollectChests() {
    const lp = localRef.current
    chestsRef.current.forEach((chest) => {
      if (chest.collected || collectedLocallyRef.current.has(chest.uid)) return
      if (dist({ x: lp.x, y: lp.y }, chest.pos) <= 34) {
        collectedLocallyRef.current.add(chest.uid)
        grantGold(chest.gold)
        if (isHostRef.current) {
          chest.collected = true
        } else {
          room?.sendChestCollect({ chestUid: chest.uid, playerId: lp.id })
        }
      }
    })
  }

  function applyHitToEnemy(uid: string, damage: number) {
    const e = enemiesRef.current.get(uid)
    if (!e) return
    e.hp -= damage
    e.hitFlash = 0.15
    floatingRef.current.push({ pos: { ...e.pos }, text: String(Math.round(damage)), color: '#E8DFC8', life: 0.6, vy: -40 })
    if (e.hp <= 0) {
      enemiesRef.current.delete(uid)
      patrolBoundsRef.current.delete(uid)
      const def = ENEMIES[e.defId]
      const partySize = remotePlayersRef.current.size + 1
      const rewardMult = rewardMultiplierForParty(partySize)
      const xp = Math.max(1, Math.round(def.xpReward * rewardMult))
      const materials = Math.max(1, Math.round(Math.ceil(def.xpReward / 4) * rewardMult))
      grantRewards(xp, materials)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let lastTs = performance.now()
    let lastNetworkSend = 0
    let lastHostBroadcast = 0

    preloadSprites()

    level.chests.forEach((c, i) => {
      const uid = `chest_${i}`
      chestsRef.current.set(uid, { uid, pos: { x: c.x, y: c.y }, gold: c.gold, collected: false })
    })

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') leftHeldRef.current = true
      if (k === 'd' || k === 'arrowright') rightHeldRef.current = true
      if (k === 'w' || k === 'arrowup') upHeldRef.current = true
      if (k === 's' || k === 'arrowdown') downHeldRef.current = true
      if (k === 'f' || k === ' ') attackHeldRef.current = true
    }
    function onKeyUp(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') leftHeldRef.current = false
      if (k === 'd' || k === 'arrowright') rightHeldRef.current = false
      if (k === 'w' || k === 'arrowup') upHeldRef.current = false
      if (k === 's' || k === 'arrowdown') downHeldRef.current = false
      if (k === 'f' || k === ' ') attackHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function tryAttack() {
      const lp = localRef.current
      if (!lp.alive || lp.attackCooldownLeft > 0) return
      const weapon = getWeapon(lp.weaponId)
      const cls = getClass(classId)
      lp.attackCooldownLeft = 1 / weapon.attackSpeed
      lp.attackAnim = ATTACK_SWING_DURATION

      if (cls.ranged) {
        // arco/bastón: un solo disparo al enemigo más cercano dentro del alcance
        let nearestUid: string | null = null
        let nearestE: EnemyInstance | null = null
        let nearestD = Infinity
        enemiesRef.current.forEach((e, uid) => {
          const d = dist({ x: lp.x, y: lp.y }, e.pos)
          if (d <= weapon.range && d < nearestD) {
            nearestD = d
            nearestUid = uid
            nearestE = e
          }
        })
        if (nearestUid && nearestE) {
          const targetPos = (nearestE as EnemyInstance).pos
          lp.facing = targetPos.x >= lp.x ? 1 : -1
          const crit = Math.random() < weapon.critChance
          const dmg = weapon.damage * (1 + lp.level * 0.025) * (crit ? 1.8 : 1)
          arrowsRef.current.push({ from: { x: lp.x, y: lp.y }, to: { ...targetPos }, t: 0, kind: cls.weaponShape === 'staff' ? 'bolt' : 'arrow' })
          if (isHostRef.current) applyHitToEnemy(nearestUid, dmg)
          else room?.sendHitRequest({ enemyUid: nearestUid, damage: dmg, attackerId: lp.id, isCrit: crit })
        }
        return
      }

      enemiesRef.current.forEach((e, uid) => {
        if (dist({ x: lp.x, y: lp.y }, e.pos) <= weapon.range) {
          const crit = Math.random() < weapon.critChance
          const dmg = weapon.damage * (1 + lp.level * 0.025) * (crit ? 1.8 : 1)
          if (isHostRef.current) applyHitToEnemy(uid, dmg)
          else room?.sendHitRequest({ enemyUid: uid, damage: dmg, attackerId: lp.id, isCrit: crit })
        }
      })
    }

    function updateLocal(dt: number) {
      const lp = localRef.current
      if (!lp.alive || finishedRef.current) return

      let moveDir = 0
      if (leftHeldRef.current) moveDir -= 1
      if (rightHeldRef.current) moveDir += 1
      lp.vx = moveDir * MOVE_SPEED
      if (moveDir !== 0) lp.facing = moveDir > 0 ? 1 : -1
      lp.x = Math.min(level.width - 20, Math.max(20, lp.x + lp.vx * dt))

      let moveDirY = 0
      if (upHeldRef.current) moveDirY -= 1
      if (downHeldRef.current) moveDirY += 1
      lp.vy = moveDirY * MOVE_SPEED_Y
      lp.y = Math.min(level.laneMaxY, Math.max(level.laneMinY, lp.y + lp.vy * dt))

      tryCollectChests()

      if (lp.attackCooldownLeft > 0) lp.attackCooldownLeft -= dt
      if (lp.attackAnim > 0) lp.attackAnim -= dt
      if (lp.invulnLeft > 0) lp.invulnLeft -= dt

      if (attackHeldRef.current) tryAttack()

      for (const cpX of level.checkpoints) {
        if (lp.x >= cpX && cpX > checkpointRef.current) checkpointRef.current = cpX
      }

      if (lp.x >= level.goal.x - GOAL_MARGIN) {
        finishedRef.current = true
      }
    }

    function hostUpdateEnemies(dt: number) {
      const players = allPlayerPositions().filter((p) => p.alive)
      enemiesRef.current.forEach((e, uid) => {
        const def = ENEMIES[e.defId]
        const bounds = patrolBoundsRef.current.get(uid)

        // busca al jugador vivo más cercano dentro del radio de agresión
        let target: { id: string; pos: Vec2 } | null = null
        let targetD = Infinity
        for (const p of players) {
          const d = dist(e.pos, p.pos)
          if (d < targetD) {
            targetD = d
            target = p
          }
        }
        const chasing = target && targetD <= ENEMY_AGGRO_RANGE
        const attackRange = def.ranged ? def.attackRange : CONTACT_RANGE

        if (chasing && target && targetD > attackRange) {
          // persigue al jugador en vez de solo patrullar
          const dirX = target.pos.x > e.pos.x ? 1 : -1
          const targetX = e.pos.x + dirX * def.speed * dt
          const boundMinX = bounds ? bounds.minX - 40 : 0
          const boundMaxX = bounds ? bounds.maxX + 40 : level.width
          e.pos.x = Math.min(boundMaxX, Math.max(boundMinX, targetX))
          const dirY = target.pos.y > e.pos.y ? 1 : target.pos.y < e.pos.y ? -1 : 0
          e.pos.y = Math.min(level.laneMaxY, Math.max(level.laneMinY, e.pos.y + dirY * def.speed * 0.6 * dt))
          if (bounds) bounds.dir = dirX
        } else if (bounds && !(chasing && target && targetD <= attackRange)) {
          e.pos.x += bounds.dir * def.speed * dt
          if (e.pos.x <= bounds.minX) {
            e.pos.x = bounds.minX
            bounds.dir = 1
          } else if (e.pos.x >= bounds.maxX) {
            e.pos.x = bounds.maxX
            bounds.dir = -1
          }
        }

        e.attackCooldownLeft -= dt
        if (e.attackCooldownLeft <= 0 && target && targetD <= attackRange) {
          e.attackCooldownLeft = def.attackCooldown
          if (def.ranged) {
            const shot = { fromX: e.pos.x, fromY: e.pos.y, toX: target.pos.x, toY: target.pos.y }
            pendingShotRef.current = shot
            arrowsRef.current.push({ from: { x: shot.fromX, y: shot.fromY }, to: { x: shot.toX, y: shot.toY }, t: 0 })
          }
          if (target.id === localRef.current.id) applyDamageToLocal(def.damage)
          else room?.sendPlayerDamage({ targetId: target.id, amount: def.damage })
        }
        if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt)
      })
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

    function loop(ts: number) {
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts

      updateLocal(dt)

      if (isHostRef.current && !enemiesSpawnedRef.current) {
        spawnElapsedRef.current += dt
        if (spawnElapsedRef.current >= ENEMY_SPAWN_DELAY) {
          spawnEnemies(remotePlayersRef.current.size + 1)
          enemiesSpawnedRef.current = true
        }
      }

      if (isHostRef.current) hostUpdateEnemies(dt)

      const lp = localRef.current
      if (room && ts - lastNetworkSend > 80) {
        lastNetworkSend = ts
        room.sendPlayerUpdate({
          id: lp.id,
          name: lp.name,
          color: lp.color,
          pos: { x: lp.x, y: lp.y },
          facing: { x: lp.facing, y: 0 },
          hp: lp.hp,
          maxHp: lp.maxHp,
          level: lp.level,
          attacking: lp.attackAnim > 0,
          blocking: false,
          weaponId: lp.weaponId,
          armorId: lp.armorId,
          classId,
        })
      }

      if (room && isHostRef.current && ts - lastHostBroadcast > 100) {
        lastHostBroadcast = ts
        room.sendEnemySync({
          enemies: Array.from(enemiesRef.current.values()),
          chests: Array.from(chestsRef.current.values()),
          lastShot: pendingShotRef.current ?? undefined,
        })
        pendingShotRef.current = null
      }

      arrowsRef.current = arrowsRef.current.filter((a) => a.t < 1)
      arrowsRef.current.forEach((a) => {
        a.t = Math.min(1, a.t + dt / ARROW_FLIGHT_TIME)
      })

      floatingRef.current = floatingRef.current.filter((f) => f.life > 0)
      floatingRef.current.forEach((f) => {
        f.life -= dt
        f.pos = { x: f.pos.x, y: f.pos.y + f.vy * dt }
      })

      // cámara: sigue en X al jugador que va más adelante (líder); en Y queda
      // fija en el centro del carril, como en un beat 'em up clásico.
      const allPlayers = allPlayerPositions()
      let leaderX = lp.x
      allPlayers.forEach((p) => {
        if (p.pos.x > leaderX) leaderX = p.pos.x
      })
      const w = canvas.width
      const visibleHalfW = w / 2 / CAMERA_ZOOM
      camXRef.current = Math.min(level.width - visibleHalfW, Math.max(visibleHalfW, leaderX))
      camYRef.current = level.goal.y

      render(dt)

      if (finishedRef.current && !result) {
        setResult({
          victory: true,
          xpEarned: xpEarnedRef.current,
          materialsEarned: materialsEarnedRef.current + 40,
          finalLevel: lp.level,
          finalXp: lp.xp,
          finalMaterials: lp.materials + 40,
          finalGold: lp.gold,
        })
      } else if (!lp.alive && !result) {
        setResult({
          victory: false,
          xpEarned: xpEarnedRef.current,
          materialsEarned: materialsEarnedRef.current,
          finalLevel: lp.level,
          finalXp: lp.xp,
          finalMaterials: lp.materials,
          finalGold: lp.gold,
        })
      }

      raf = requestAnimationFrame(loop)
    }

    function drawGround() {
      const wallH = 240
      // paredes de roca que enmarcan el carril, estilo callejón de arcade
      ctx.fillStyle = '#241C14'
      ctx.fillRect(0, level.laneMinY - wallH, level.width, wallH)
      ctx.fillRect(0, level.laneMaxY, level.width, wallH)
      ctx.fillStyle = 'rgba(90, 80, 60, 0.5)'
      for (let x = 0; x < level.width; x += 90) {
        const jitter = (x * 37) % 30
        ctx.beginPath()
        ctx.arc(x + jitter, level.laneMinY - wallH * 0.35, 26, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + 45 - jitter, level.laneMaxY + wallH * 0.35, 26, 0, Math.PI * 2)
        ctx.fill()
      }
      // carril caminable
      ctx.fillStyle = '#3A3226'
      ctx.fillRect(0, level.laneMinY, level.width, level.laneMaxY - level.laneMinY)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(0, level.laneMinY)
      ctx.lineTo(level.width, level.laneMinY)
      ctx.moveTo(0, level.laneMaxY)
      ctx.lineTo(level.width, level.laneMaxY)
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let x = 0; x < level.width; x += 64) {
        ctx.fillRect(x, level.laneMinY, 2, level.laneMaxY - level.laneMinY)
      }
    }

    function drawFlagPole(x: number, y: number, color: string, label: string) {
      ctx.strokeStyle = '#8A7A5C'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - 120)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, y - 120)
      ctx.lineTo(x + 34, y - 108)
      ctx.lineTo(x, y - 96)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#E8DFC8'
      ctx.font = 'bold 11px Cinzel, serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, y - 130)
    }

    function render(dt: number) {
      const w = canvas.width
      const h = canvas.height
      const camX = camXRef.current
      const camY = camYRef.current

      // cielo con montañas de fondo (paralaje)
      const sky = ctx.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#2A2115')
      sky.addColorStop(1, '#171C12')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = 'rgba(90, 80, 60, 0.35)'
      for (let i = -1; i < 8; i++) {
        const bx = i * 420 - (camX * 0.25) % 420
        ctx.beginPath()
        ctx.moveTo(bx, h * 0.62)
        ctx.lineTo(bx + 210, h * 0.62 - 180)
        ctx.lineTo(bx + 420, h * 0.62)
        ctx.closePath()
        ctx.fill()
      }

      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM)
      ctx.translate(-camX, -camY)

      drawGround()
      drawFlagPole(checkpointRef.current, level.laneMaxY, '#4C6B8A', '')
      drawFlagPole(level.goal.x, level.goal.y, '#C9A227', 'META')

      // cofres de oro
      chestsRef.current.forEach((chest) => {
        if (chest.collected) return
        const bob = Math.sin(performance.now() / 260 + chest.pos.x) * 3
        ctx.save()
        ctx.translate(chest.pos.x, chest.pos.y + bob)
        ctx.fillStyle = '#5C4A2E'
        ctx.fillRect(-14, -8, 28, 16)
        ctx.fillStyle = '#C9A227'
        ctx.fillRect(-14, -10, 28, 5)
        ctx.strokeStyle = '#3A2E1C'
        ctx.lineWidth = 2
        ctx.strokeRect(-14, -10, 28, 18)
        ctx.beginPath()
        ctx.arc(0, -10, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#E8DFC8'
        ctx.fill()
        ctx.restore()
      })

      // enemigos
      enemiesRef.current.forEach((e) => {
        const def = ENEMIES[e.defId]
        const bounds = patrolBoundsRef.current.get(e.uid)
        const facing = { x: bounds ? bounds.dir : -1, y: 0 }
        const enemySpriteOk = drawSprite(ctx, e.uid, e.defId as SpriteKey, e.pos, facing, def.radius * 3.4, e.hitFlash > 0)
        if (!enemySpriteOk) {
          drawHumanoid(ctx, e.pos, facing, def.radius, def.color, '#20241A', 'rgba(0,0,0,0.45)', 1.5, e.hitFlash > 0, { horns: true })
        }
        drawBar(ctx, e.pos.x - def.radius, e.pos.y - def.radius * 2 - 30, def.radius * 2, 5, e.hp / e.maxHp, '#8B3A2B')
      })

      // jugadores remotos
      remotePlayersRef.current.forEach((rp) => {
        const wasAttacking = remoteSwingRef.current.has(rp.id)
        const swingT = getRemoteSwingT(rp.id, rp.attacking, dt)
        const rpCls = getClass(rp.classId)
        if (rp.attacking && !wasAttacking && rpCls.ranged) {
          const to = { x: rp.pos.x + rp.facing.x * getWeapon(rp.weaponId).range, y: rp.pos.y }
          arrowsRef.current.push({ from: { ...rp.pos }, to, t: 0, kind: rpCls.weaponShape === 'staff' ? 'bolt' : 'arrow' })
        }
        const weapon = getWeapon(rp.weaponId)
        const rpSpriteOk = drawSprite(ctx, rp.id, rp.classId as SpriteKey, rp.pos, { x: rp.facing.x, y: 0 }, 18 * 3.4, false)
        if (!rpSpriteOk) {
          drawHumanoid(ctx, rp.pos, { x: rp.facing.x, y: 0 }, 18, rp.color, '#E8DFC8', 'rgba(232,223,200,0.6)', 2, false, {
            swingT,
            weaponShape: weapon.shape,
            legendary: weapon.rarity === 'legendario',
          })
        }
        drawBar(ctx, rp.pos.x - 22, rp.pos.y - 66, 44, 6, Math.max(0, rp.hp) / rp.maxHp, '#7FD1AE')
        ctx.fillStyle = '#E8DFC8'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(rp.name, rp.pos.x, rp.pos.y - 72)
      })

      // jugador local
      const lp = localRef.current
      const localSwingT = lp.attackAnim > 0 ? 1 - lp.attackAnim / ATTACK_SWING_DURATION : 0
      const weapon = getWeapon(lp.weaponId)
      const flashLocal = lp.invulnLeft > 0 && Math.floor(lp.invulnLeft * 10) % 2 === 0
      ctx.globalAlpha = lp.invulnLeft > 0 ? 0.55 : 1
      const localSpriteOk = drawSprite(ctx, lp.id, classId as SpriteKey, { x: lp.x, y: lp.y }, { x: lp.facing, y: 0 }, 18 * 3.4, flashLocal)
      if (!localSpriteOk) {
        drawHumanoid(ctx, { x: lp.x, y: lp.y }, { x: lp.facing, y: 0 }, 18, lp.color, '#E8DFC8', '#E8DFC8', 3, flashLocal, {
          swingT: localSwingT,
          weaponShape: weapon.shape,
          legendary: weapon.rarity === 'legendario',
        })
      }
      ctx.globalAlpha = 1
      drawBar(ctx, lp.x - 22, lp.y - 66, 44, 6, Math.max(0, lp.hp) / lp.maxHp, '#7FD1AE')
      ctx.fillStyle = '#E8DFC8'
      ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${lp.name} (vos)`, lp.x, lp.y - 72)

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
        }
        ctx.restore()
      })

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

    raf = requestAnimationFrame(loop)

    const hudInterval = window.setInterval(() => {
      const lp = localRef.current
      setHud({
        hp: lp.hp,
        maxHp: lp.maxHp,
        lives: livesRef.current,
        level: lp.level,
        progressPct: Math.min(100, Math.round((lp.x / level.goal.x) * 100)),
      })
    }, 150)

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(hudInterval)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (payload.chests) {
        const chestMap = new Map<string, ChestInstance>()
        payload.chests.forEach((c) => chestMap.set(c.uid, c))
        chestsRef.current = chestMap
      }
      if (payload.lastShot) {
        const s = payload.lastShot
        arrowsRef.current.push({ from: { x: s.fromX, y: s.fromY }, to: { x: s.toX, y: s.toY }, t: 0 })
      }
    }
    listenersRef.current.onHitRequest = (p) => {
      if (!isHostRef.current) return
      applyHitToEnemy(p.enemyUid, p.damage)
    }
    listenersRef.current.onPlayerDamage = (p) => {
      if (p.targetId === localRef.current.id) applyDamageToLocal(p.amount)
    }
    listenersRef.current.onChestCollect = (p) => {
      if (!isHostRef.current) return
      const chest = chestsRef.current.get(p.chestUid)
      if (chest && !chest.collected) chest.collected = true
    }
    return () => {
      listenersRef.current.onPlayerUpdate = undefined
      listenersRef.current.onEnemySync = undefined
      listenersRef.current.onHitRequest = undefined
      listenersRef.current.onPlayerDamage = undefined
      listenersRef.current.onChestCollect = undefined
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
            <span className="label">Oro obtenido</span>
            <span className="value">+{Math.max(0, goldEarnedRef.current)}</span>
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
      {hud && (
        <div className="hud">
          <div className="hud-top-left">
            <div className="hud-frame">
              <div className="hud-row">
                <span className="hud-level">Nv. {hud.level}</span>
                <span className="hud-mission">{mission.title}</span>
              </div>
              <div className="hud-bar-track">
                <div className="hud-bar-fill hp" style={{ width: `${Math.max(0, (hud.hp / hud.maxHp) * 100)}%` }} />
                <span className="hud-bar-label">{Math.max(0, Math.round(hud.hp))} / {hud.maxHp} HP</span>
              </div>
              <div className="hud-row small-row">
                <span>♥ {hud.lives} vidas</span>
                <span>{hud.progressPct}% del camino</span>
              </div>
            </div>
          </div>
          <div className="hud-controls-hint">
            Mové con <strong>A/D</strong>, acercate o alejate con <strong>W/S</strong>, atacá con <strong>F</strong> — o los botones en pantalla.
          </div>
        </div>
      )}
      <PlatformerControls
        onLeftStart={() => { leftHeldRef.current = true }}
        onLeftEnd={() => { leftHeldRef.current = false }}
        onRightStart={() => { rightHeldRef.current = true }}
        onRightEnd={() => { rightHeldRef.current = false }}
        onUpStart={() => { upHeldRef.current = true }}
        onUpEnd={() => { upHeldRef.current = false }}
        onDownStart={() => { downHeldRef.current = true }}
        onDownEnd={() => { downHeldRef.current = false }}
        onAttackStart={() => { attackHeldRef.current = true }}
        onAttackEnd={() => { attackHeldRef.current = false }}
      />
    </div>
  )
}
