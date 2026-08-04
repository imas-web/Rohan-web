import type { Vec2 } from './types'

export interface PlatformEnemySpawn {
  defId: string
  x: number
  y: number // profundidad dentro del carril (más arriba = más "atrás")
  minX: number
  maxX: number
}

export interface Alcove {
  x: number // centro del hueco en la pared
  halfWidth: number
  side: 'up' | 'down'
  depth: number // cuánto se extiende el carril hacia ese lado en este tramo
}

export interface ChestSpawn {
  x: number
  y: number // dentro del carril o de un hueco (chestInAlcove) — algunos exigen desviarse del camino
  gold: number
}

// a diferencia de un Alcove (hueco opcional para un cofre), un Blockade
// corta el carril base por completo: un derrumbe de rocas que obliga a
// todos los jugadores a desviarse por el hueco lateral para poder pasar.
export interface Blockade {
  x: number
  halfWidth: number
  side: 'up' | 'down'
  depth: number
}

export interface PlatformerLevel {
  width: number
  laneMinY: number
  laneMaxY: number
  checkpoints: number[]
  enemies: PlatformEnemySpawn[]
  alcoves: Alcove[]
  blockades: Blockade[]
  chests: ChestSpawn[]
  goal: Vec2
  startPos: Vec2
}

// carril de pelea estilo beat 'em up (tipo TMNT arcade): sin salto ni pozos,
// te movés a lo largo del camino y un poco de profundidad (arriba/abajo)
// para esquivar y rodear enemigos. Algunos cofres están escondidos en huecos
// laterales (el carril se ensancha en ese tramo) para que no sea todo recto.
const GY = 520 // centro del carril
const LANE_HALF = 75
const ALCOVE_DEPTH = 90
const ALCOVE_HALF_WIDTH = 60

export const PLATFORMER_LEVEL: PlatformerLevel = {
  width: 4200,
  laneMinY: GY - LANE_HALF,
  laneMaxY: GY + LANE_HALF,
  startPos: { x: 70, y: GY },
  checkpoints: [70, 1050, 2100, 3150],
  enemies: [
    { defId: 'orco_explorador', x: 480, y: GY - 40, minX: 440, maxX: 560 },
    { defId: 'orco_explorador', x: 560, y: GY + 40, minX: 500, maxX: 640 },
    { defId: 'orco_guerrero', x: 780, y: GY, minX: 720, maxX: 860 },
    { defId: 'orco_explorador', x: 980, y: GY - 30, minX: 920, maxX: 1040 },
    { defId: 'orco_guerrero', x: 1180, y: GY + 30, minX: 1120, maxX: 1260 },
    { defId: 'berserker_uruk', x: 1380, y: GY, minX: 1320, maxX: 1440 },
    { defId: 'orco_explorador', x: 1580, y: GY - 40, minX: 1520, maxX: 1660 },
    { defId: 'orco_explorador', x: 1650, y: GY + 40, minX: 1600, maxX: 1740 },
    { defId: 'orco_guerrero', x: 1900, y: GY, minX: 1840, maxX: 1980 },
    { defId: 'arquero_uruk', x: 2150, y: GY - 30, minX: 2100, maxX: 2100 },
    { defId: 'orco_guerrero', x: 2300, y: GY + 30, minX: 2240, maxX: 2380 },
    { defId: 'berserker_uruk', x: 2480, y: GY, minX: 2420, maxX: 2560 },
    { defId: 'orco_explorador', x: 2650, y: GY - 40, minX: 2600, maxX: 2720 },
    { defId: 'orco_guerrero', x: 2850, y: GY + 20, minX: 2790, maxX: 2930 },
    { defId: 'orco_explorador', x: 3000, y: GY - 20, minX: 2950, maxX: 3070 },
    { defId: 'arquero_uruk', x: 3200, y: GY + 40, minX: 3200, maxX: 3200 },
    { defId: 'orco_guerrero', x: 3400, y: GY, minX: 3340, maxX: 3480 },
    { defId: 'berserker_uruk', x: 3600, y: GY - 30, minX: 3540, maxX: 3680 },
    { defId: 'orco_guerrero', x: 3750, y: GY + 30, minX: 3690, maxX: 3830 },
  ],
  // cada cofre "escondido" tiene su hueco correspondiente en la misma x, para
  // que se vea claramente la abertura en la pared (el camino obvio hacia él)
  alcoves: [
    { x: 350, halfWidth: ALCOVE_HALF_WIDTH, side: 'up', depth: ALCOVE_DEPTH },
    { x: 900, halfWidth: ALCOVE_HALF_WIDTH, side: 'down', depth: ALCOVE_DEPTH },
    { x: 1450, halfWidth: ALCOVE_HALF_WIDTH, side: 'up', depth: ALCOVE_DEPTH },
    { x: 2000, halfWidth: ALCOVE_HALF_WIDTH, side: 'down', depth: ALCOVE_DEPTH },
    { x: 2550, halfWidth: ALCOVE_HALF_WIDTH, side: 'up', depth: ALCOVE_DEPTH },
    { x: 3100, halfWidth: ALCOVE_HALF_WIDTH, side: 'down', depth: ALCOVE_DEPTH },
    { x: 3650, halfWidth: ALCOVE_HALF_WIDTH, side: 'up', depth: ALCOVE_DEPTH },
  ],
  // derrumbes que cortan el carril principal: para pasar hay que meterse en
  // el hueco lateral (más difícil todavía si hay un orco cerca vigilándolo)
  blockades: [
    { x: 1300, halfWidth: 50, side: 'down', depth: 110 },
    { x: 3250, halfWidth: 50, side: 'up', depth: 110 },
  ],
  chests: [
    { x: 350, y: GY - LANE_HALF - ALCOVE_DEPTH + 20, gold: 20 },
    { x: 900, y: GY + LANE_HALF + ALCOVE_DEPTH - 20, gold: 20 },
    { x: 1450, y: GY - LANE_HALF - ALCOVE_DEPTH + 20, gold: 25 },
    { x: 2000, y: GY + LANE_HALF + ALCOVE_DEPTH - 20, gold: 20 },
    { x: 2550, y: GY - LANE_HALF - ALCOVE_DEPTH + 20, gold: 25 },
    { x: 3100, y: GY + LANE_HALF + ALCOVE_DEPTH - 20, gold: 25 },
    { x: 3650, y: GY - LANE_HALF - ALCOVE_DEPTH + 20, gold: 30 },
  ],
  goal: { x: 4130, y: GY },
}
