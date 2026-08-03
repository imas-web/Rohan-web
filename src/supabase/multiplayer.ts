import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'
import type { EnemyInstance, PlayerState, Vec2 } from '../game/types'

/**
 * ARQUITECTURA DE RED (simple, pensada para 2-4 celulares y hosting gratis):
 *
 * - Cada sala es un "channel" de Supabase Realtime identificado por un código de 4 letras.
 * - No hay servidor de juego propio: todo corre en el navegador de cada jugador.
 * - Cada cliente simula su PROPIO personaje y transmite su posición/estado ~12 veces por segundo.
 * - Un solo jugador es "host" (el primero en entrar a la sala). El host simula los enemigos
 *   (movimiento, IA, vida) y transmite ese estado a los demás. Así evitamos que cada celular
 *   tenga una versión distinta de "cuánta vida le queda a un orco".
 * - Cuando un cliente (host o no) golpea a un enemigo, en vez de bajarle la vida localmente,
 *   manda un "hit_request" al host, que es quien valida y aplica el daño real y reparte el XP.
 * - Si el host se desconecta, el siguiente jugador más antiguo en la sala toma la posta
 *   automáticamente (se recalcula con la lista de presencia de Supabase).
 */

export interface NetPlayerUpdate {
  id: string
  name: string
  color: string
  pos: Vec2
  facing: Vec2
  hp: number
  maxHp: number
  level: number
  attacking: boolean
  blocking: boolean
  weaponId: string
  armorId: string
}

export interface EnemySyncPayload {
  enemies: EnemyInstance[]
  missionTimeLeft?: number
  baseHp?: number
  wave?: number
  kills?: number
  finished?: boolean
  victory?: boolean
  lastKill?: { killerId: string; xpReward: number; enemyName: string; enemyUid: string; materialsDrop: number }
}

export interface HitRequestPayload {
  enemyUid: string
  damage: number
  attackerId: string
  isCrit: boolean
}

export interface PlayerDamagePayload {
  targetId: string
  amount: number
}

export type Listeners = {
  onPlayerUpdate?: (p: NetPlayerUpdate) => void
  onEnemySync?: (p: EnemySyncPayload) => void
  onHitRequest?: (p: HitRequestPayload) => void
  onPlayerDamage?: (p: PlayerDamagePayload) => void
  onPresenceChange?: (members: { id: string; name: string; color: string; joinedAt: number }[]) => void
  onGameStart?: (missionId: string) => void
}

export class MultiplayerRoom {
  channel: RealtimeChannel | null = null
  roomCode: string
  playerId: string
  isHost = false
  private joinedAt = Date.now()

  constructor(roomCode: string, playerId: string) {
    this.roomCode = roomCode.toUpperCase()
    this.playerId = playerId
  }

  async join(name: string, color: string, listeners: Listeners) {
    if (!supabase) throw new Error('Supabase no está configurado (faltan variables de entorno).')

    this.channel = supabase.channel(`room:${this.roomCode}`, {
      config: { presence: { key: this.playerId }, broadcast: { self: false } },
    })

    this.channel
      .on('broadcast', { event: 'player_update' }, ({ payload }) => {
        listeners.onPlayerUpdate?.(payload as NetPlayerUpdate)
      })
      .on('broadcast', { event: 'enemy_sync' }, ({ payload }) => {
        listeners.onEnemySync?.(payload as EnemySyncPayload)
      })
      .on('broadcast', { event: 'hit_request' }, ({ payload }) => {
        listeners.onHitRequest?.(payload as HitRequestPayload)
      })
      .on('broadcast', { event: 'player_damage' }, ({ payload }) => {
        listeners.onPlayerDamage?.(payload as PlayerDamagePayload)
      })
      .on('broadcast', { event: 'start_game' }, ({ payload }) => {
        listeners.onGameStart?.((payload as { missionId: string }).missionId)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState<{ name: string; color: string; joinedAt: number }>()
        const members = Object.entries(state).map(([id, metas]) => ({
          id,
          name: metas[0].name,
          color: metas[0].color,
          joinedAt: metas[0].joinedAt,
        }))
        members.sort((a, b) => a.joinedAt - b.joinedAt)
        this.isHost = members.length > 0 && members[0].id === this.playerId
        listeners.onPresenceChange?.(members)
      })

    await new Promise<void>((resolve, reject) => {
      this.channel!.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel!.track({ name, color, joinedAt: this.joinedAt })
          resolve()
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error('No se pudo conectar a la sala'))
      })
    })
  }

  sendPlayerUpdate(p: NetPlayerUpdate) {
    this.channel?.send({ type: 'broadcast', event: 'player_update', payload: p })
  }

  sendEnemySync(p: EnemySyncPayload) {
    this.channel?.send({ type: 'broadcast', event: 'enemy_sync', payload: p })
  }

  sendHitRequest(p: HitRequestPayload) {
    this.channel?.send({ type: 'broadcast', event: 'hit_request', payload: p })
  }

  sendPlayerDamage(p: PlayerDamagePayload) {
    this.channel?.send({ type: 'broadcast', event: 'player_damage', payload: p })
  }

  sendGameStart(missionId: string) {
    this.channel?.send({ type: 'broadcast', event: 'start_game', payload: { missionId } })
  }

  leave() {
    this.channel?.untrack()
    this.channel?.unsubscribe()
    this.channel = null
  }
}

export function makePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10)
}

// Utilidad mínima para persistir el progreso del personaje entre partidas (nivel, equipo,
// materiales) en Supabase, si la tabla "personajes" existe. Si no hay Supabase configurado
// o falla, el juego sigue funcionando guardando solo en localStorage.
export async function saveCharacterProgress(playerId: string, state: Partial<PlayerState>) {
  if (!supabase) return
  await supabase.from('personajes').upsert({
    id: playerId,
    nombre: state.name,
    nivel: state.level,
    xp: state.xp,
    arma_id: state.weaponId,
    armadura_id: state.armorId,
    materiales: state.materials,
    actualizado_en: new Date().toISOString(),
  })
}

export async function loadCharacterProgress(playerId: string) {
  if (!supabase) return null
  const { data } = await supabase.from('personajes').select('*').eq('id', playerId).maybeSingle()
  return data
}
