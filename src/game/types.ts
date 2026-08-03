export type Rarity = 'comun' | 'raro' | 'epico' | 'legendario'

export interface WeaponDef {
  id: string
  name: string
  rarity: Rarity
  damage: number
  range: number
  attackSpeed: number // ataques por segundo
  critChance: number // 0..1
}

export interface ArmorDef {
  id: string
  name: string
  rarity: Rarity
  defense: number
  hpBonus: number
  speedMod: number // multiplicador de velocidad, 1 = normal
}

export interface EnemyDef {
  id: string
  name: string
  hp: number
  damage: number
  speed: number
  radius: number
  xpReward: number
  color: string
  ranged?: boolean
  attackRange: number
  attackCooldown: number
  isBoss?: boolean
}

export type EntityKind = 'player' | 'enemy' | 'projectile' | 'base'

export interface Vec2 {
  x: number
  y: number
}

export interface PlayerState {
  id: string
  name: string
  color: string
  pos: Vec2
  facing: Vec2
  hp: number
  maxHp: number
  level: number
  xp: number
  xpToNext: number
  skillPoints: number
  weaponId: string
  armorId: string
  materials: number
  attackCooldownLeft: number
  hitFlash: number
  alive: boolean
  isLocal: boolean
  lastAttackAnim: number
  moveInput: Vec2
}

export interface EnemyInstance {
  uid: string
  defId: string
  pos: Vec2
  hp: number
  maxHp: number
  attackCooldownLeft: number
  targetId: string | null
  hitFlash: number
}

export interface ProjectileInstance {
  uid: string
  pos: Vec2
  vel: Vec2
  damage: number
  ownerId: string
  ttl: number
}

export type GameMode = 'oleadas' | 'defensa' | 'mision'

export interface MissionDef {
  id: string
  title: string
  description: string
  mode: GameMode
  durationSec?: number // para defensa
  waveCount?: number // para oleadas
  killTarget?: number // para mision de exterminio
}
