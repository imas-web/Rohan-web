import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { MissionDef, EnemyInstance, Vec2 } from './types'
import { ENEMIES, enemyCountMultiplierForParty, getArmor, getWeapon, rewardMultiplierForParty, xpToNextLevel } from './data'
import { PLATFORMER_LEVEL } from './platformerLevel'
import { MultiplayerRoom, type NetPlayerUpdate, type Listeners } from '../supabase/multiplayer'
import { drawBar, drawHumanoid } from './render'
import PlatformerControls from '../ui/PlatformerControls'

const GRAVITY = 1900
const JUMP_VELOCITY = -720
const MOVE_SPEED = 230
const PLAYER_HALF_W = 14
const CONTACT_RANGE = 30
const CONTACT_COOLDOWN = 0.8
const INVULN_DURATION = 1.4
const START_LIVES = 3
const ATTACK_SWING_DURATION = 0.135
const GOAL_MARGIN = 40
const ENEMY_SPAWN_DELAY = 0.4 // espera a que lleguen los primeros player_update de los compañeros antes de contar cuántos somos

interface LocalPlatformer {
  id: string
  name: string
  color: string
  x: number
  y: number // posición de los pies
  vx: number
  vy: number
  facing: 1 | -1
  hp: number
  maxHp: number
  level: number
  xp: number
  materials: number
  weaponId: string
  armorId: string
  attackCooldownLeft: number
  attackAnim: number
  grounded: boolean
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

export default function PlatformerCanvas({
  mission,
  localName,
  localColor,
  weaponId,
  armorId,
  startLevel,
  startXp,
  startMaterials,
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
  } | null>(null)

  const isHostRef = useRef<boolean>(!room)
  const materialsEarnedRef = useRef(0)
  const xpEarnedRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const checkpointRef = useRef<Vec2>({ ...level.startPos })
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
    weaponId,
    armorId,
    attackCooldownLeft: 0,
    attackAnim: 0,
    grounded: false,
    invulnLeft: 0,
    alive: true,
  })

  const remotePlayersRef = useRef<Map<string, RemotePlatformer>>(new Map())
  const enemiesRef = useRef<Map<string, EnemyInstance>>(new Map())
  const patrolBoundsRef = useRef<Map<string, PatrolBounds>>(new Map())
  const floatingRef = useRef<FloatingText[]>([])
  const remoteSwingRef = useRef<Map<string, number>>(new Map())

  const leftHeldRef = useRef(false)
  const rightHeldRef = useRef(false)
  const jumpQueuedRef = useRef(false)
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
    lp.x = checkpointRef.current.x
    lp.y = checkpointRef.current.y
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
      if (k === 'w' || k === 'arrowup' || k === ' ') jumpQueuedRef.current = true
      if (k === 'f') attackHeldRef.current = true
    }
    function onKeyUp(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') leftHeldRef.current = false
      if (k === 'd' || k === 'arrowright') rightHeldRef.current = false
      if (k === 'f') attackHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function tryAttack() {
      const lp = localRef.current
      if (!lp.alive || lp.attackCooldownLeft > 0) return
      const weapon = getWeapon(lp.weaponId)
      lp.attackCooldownLeft = 1 / weapon.attackSpeed
      lp.attackAnim = ATTACK_SWING_DURATION
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

      if (jumpQueuedRef.current) {
        jumpQueuedRef.current = false
        if (lp.grounded) {
          lp.vy = JUMP_VELOCITY
          lp.grounded = false
        }
      }

      lp.vy += GRAVITY * dt
      const prevFeetY = lp.y
      const newY = lp.y + lp.vy * dt
      let grounded = false
      let landedY = newY
      for (const plat of level.platforms) {
        const withinX = lp.x + PLAYER_HALF_W > plat.x && lp.x - PLAYER_HALF_W < plat.x + plat.w
        if (withinX && lp.vy >= 0 && prevFeetY <= plat.y + 1 && newY >= plat.y) {
          landedY = plat.y
          grounded = true
        }
      }
      lp.y = landedY
      lp.grounded = grounded
      if (grounded) lp.vy = 0

      if (lp.attackCooldownLeft > 0) lp.attackCooldownLeft -= dt
      if (lp.attackAnim > 0) lp.attackAnim -= dt
      if (lp.invulnLeft > 0) lp.invulnLeft -= dt

      if (attackHeldRef.current) tryAttack()

      if (lp.y > level.fallDeathY) respawnLocal()

      for (const cp of level.checkpoints) {
        if (lp.x >= cp.x && cp.x > checkpointRef.current.x) checkpointRef.current = { ...cp }
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
        if (bounds) {
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
        if (e.attackCooldownLeft <= 0) {
          for (const p of players) {
            if (dist(e.pos, p.pos) <= CONTACT_RANGE) {
              e.attackCooldownLeft = CONTACT_COOLDOWN
              if (p.id === localRef.current.id) applyDamageToLocal(def.damage)
              else room?.sendPlayerDamage({ targetId: p.id, amount: def.damage })
              break
            }
          }
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
          classId: 'guerrero',
        })
      }

      if (room && isHostRef.current && ts - lastHostBroadcast > 100) {
        lastHostBroadcast = ts
        room.sendEnemySync({ enemies: Array.from(enemiesRef.current.values()) })
      }

      floatingRef.current = floatingRef.current.filter((f) => f.life > 0)
      floatingRef.current.forEach((f) => {
        f.life -= dt
        f.pos = { x: f.pos.x, y: f.pos.y + f.vy * dt }
      })

      // cámara: sigue al jugador que va más adelante (líder), en x e y
      const allPlayers = allPlayerPositions()
      let leaderX = lp.x
      let leaderY = lp.y
      allPlayers.forEach((p) => {
        if (p.pos.x > leaderX) {
          leaderX = p.pos.x
          leaderY = p.pos.y
        }
      })
      const w = canvas.width
      camXRef.current = Math.min(level.width - w / 2, Math.max(w / 2, leaderX))
      camYRef.current += (leaderY - 90 - camYRef.current) * Math.min(1, dt * 3)

      render(dt)

      if (finishedRef.current && !result) {
        setResult({
          victory: true,
          xpEarned: xpEarnedRef.current,
          materialsEarned: materialsEarnedRef.current + 40,
          finalLevel: lp.level,
          finalXp: lp.xp,
          finalMaterials: lp.materials + 40,
        })
      } else if (!lp.alive && !result) {
        setResult({
          victory: false,
          xpEarned: xpEarnedRef.current,
          materialsEarned: materialsEarnedRef.current,
          finalLevel: lp.level,
          finalXp: lp.xp,
          finalMaterials: lp.materials,
        })
      }

      raf = requestAnimationFrame(loop)
    }

    function drawGround() {
      ctx.fillStyle = '#3A3226'
      level.platforms.forEach((plat) => {
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h)
        ctx.fillStyle = '#5C6B3E'
        ctx.fillRect(plat.x, plat.y - 6, plat.w, 8)
        ctx.fillStyle = '#3A3226'
      })
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
      ctx.translate(w / 2 - camX, h / 2 - camY)

      drawGround()
      drawFlagPole(checkpointRef.current.x, checkpointRef.current.y, '#4C6B8A', '')
      drawFlagPole(level.goal.x, level.goal.y, '#C9A227', 'META')

      // enemigos
      enemiesRef.current.forEach((e) => {
        const def = ENEMIES[e.defId]
        const bounds = patrolBoundsRef.current.get(e.uid)
        const facing = { x: bounds ? bounds.dir : -1, y: 0 }
        drawHumanoid(ctx, e.pos, facing, def.radius, def.color, '#20241A', 'rgba(0,0,0,0.45)', 1.5, e.hitFlash > 0, { horns: true })
        drawBar(ctx, e.pos.x - def.radius, e.pos.y - def.radius * 2 - 30, def.radius * 2, 5, e.hp / e.maxHp, '#8B3A2B')
      })

      // jugadores remotos
      remotePlayersRef.current.forEach((rp) => {
        const swingT = getRemoteSwingT(rp.id, rp.attacking, dt)
        const weapon = getWeapon(rp.weaponId)
        drawHumanoid(ctx, rp.pos, { x: rp.facing.x, y: 0 }, 18, rp.color, '#E8DFC8', 'rgba(232,223,200,0.6)', 2, false, {
          swingT,
          weaponShape: weapon.shape,
          legendary: weapon.rarity === 'legendario',
        })
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
      drawHumanoid(ctx, { x: lp.x, y: lp.y }, { x: lp.facing, y: 0 }, 18, lp.color, '#E8DFC8', '#E8DFC8', 3, flashLocal, {
        swingT: localSwingT,
        weaponShape: weapon.shape,
        legendary: weapon.rarity === 'legendario',
      })
      ctx.globalAlpha = 1
      drawBar(ctx, lp.x - 22, lp.y - 66, 44, 6, Math.max(0, lp.hp) / lp.maxHp, '#7FD1AE')
      ctx.fillStyle = '#E8DFC8'
      ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${lp.name} (vos)`, lp.x, lp.y - 72)

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
    }
    listenersRef.current.onHitRequest = (p) => {
      if (!isHostRef.current) return
      applyHitToEnemy(p.enemyUid, p.damage)
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
            Mové con <strong>A/D</strong>, saltá con <strong>W/Espacio</strong>, atacá con <strong>F</strong> — o los botones en pantalla.
          </div>
        </div>
      )}
      <PlatformerControls
        onLeftStart={() => { leftHeldRef.current = true }}
        onLeftEnd={() => { leftHeldRef.current = false }}
        onRightStart={() => { rightHeldRef.current = true }}
        onRightEnd={() => { rightHeldRef.current = false }}
        onJump={() => { jumpQueuedRef.current = true }}
        onAttackStart={() => { attackHeldRef.current = true }}
        onAttackEnd={() => { attackHeldRef.current = false }}
      />
    </div>
  )
}
