import type { Vec2 } from './types'

export interface PlatformRect {
  x: number
  y: number // superficie caminable (arriba del rectángulo)
  w: number
  h: number
}

export interface PlatformEnemySpawn {
  defId: string
  x: number
  y: number // superficie donde patrulla
  minX: number
  maxX: number
}

export interface PlatformerLevel {
  width: number
  platforms: PlatformRect[]
  checkpoints: Vec2[]
  enemies: PlatformEnemySpawn[]
  goal: Vec2
  fallDeathY: number
  startPos: Vec2
}

const GY = 520 // superficie del suelo

// Suelo grueso (se extiende bien hacia abajo para que nunca se vea el borde
// inferior) partido por pozos, más algunas plataformas flotantes finas.
export const PLATFORMER_LEVEL: PlatformerLevel = {
  width: 3650,
  fallDeathY: GY + 260,
  startPos: { x: 70, y: GY },
  platforms: [
    { x: 0, y: GY, w: 480, h: 400 },
    // pozo 480-560
    { x: 560, y: GY, w: 420, h: 400 },
    // pozo 980-1060
    { x: 1060, y: GY, w: 200, h: 400 },
    // escalera flotante sobre un vacío (1260-1780)
    { x: 1300, y: GY - 60, w: 120, h: 20 },
    { x: 1460, y: GY - 120, w: 120, h: 20 },
    { x: 1620, y: GY - 60, w: 160, h: 20 },
    { x: 1780, y: GY, w: 380, h: 400 },
    // pozo 2160-2240
    { x: 2240, y: GY, w: 360, h: 400 },
    // pozo 2600-2680
    { x: 2680, y: GY, w: 400, h: 400 },
    { x: 3080, y: GY, w: 570, h: 400 },
  ],
  checkpoints: [
    { x: 70, y: GY },
    { x: 1820, y: GY },
    { x: 2720, y: GY },
  ],
  enemies: [
    { defId: 'orco_explorador', x: 660, y: GY, minX: 620, maxX: 740 },
    { defId: 'orco_guerrero', x: 880, y: GY, minX: 830, maxX: 950 },
    { defId: 'orco_explorador', x: 1830, y: GY, minX: 1800, maxX: 1880 },
    { defId: 'orco_guerrero', x: 1980, y: GY, minX: 1940, maxX: 2020 },
    { defId: 'orco_explorador', x: 2110, y: GY, minX: 2080, maxX: 2150 },
    { defId: 'orco_guerrero', x: 2520, y: GY, minX: 2470, maxX: 2570 },
    { defId: 'orco_explorador', x: 2760, y: GY, minX: 2720, maxX: 2810 },
    { defId: 'orco_guerrero', x: 2940, y: GY, minX: 2900, maxX: 3020 },
  ],
  goal: { x: 3580, y: GY },
}
