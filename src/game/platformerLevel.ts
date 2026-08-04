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

// Con velocidad 230px/s y salto de 720px/s contra una gravedad de 1900px/s²,
// el salto a máxima carrera cubre ~174px de distancia horizontal — los pozos
// de 100-120px exigen tomar carrera y saltar con buen timing, no son gratis.
export const PLATFORMER_LEVEL: PlatformerLevel = {
  width: 4200,
  fallDeathY: GY + 260,
  startPos: { x: 70, y: GY },
  platforms: [
    { x: 0, y: GY, w: 480, h: 400 },
    // pozo 480-590
    { x: 590, y: GY, w: 390, h: 400 },
    // pozo 980-1090
    { x: 1090, y: GY, w: 170, h: 400 },
    // escalera flotante, angosta y alta, sobre un vacío largo (1260-1820)
    { x: 1300, y: GY - 60, w: 100, h: 20 },
    { x: 1450, y: GY - 130, w: 100, h: 20 },
    { x: 1610, y: GY - 70, w: 90, h: 20 },
    { x: 1820, y: GY, w: 380, h: 400 },
    // pozo 2200-2310
    { x: 2310, y: GY, w: 290, h: 400 },
    // pozo 2600-2710
    { x: 2710, y: GY, w: 390, h: 400 },
    // pozo 3100-3210
    { x: 3210, y: GY, w: 290, h: 400 },
    // pozo 3500-3600
    { x: 3600, y: GY, w: 600, h: 400 },
  ],
  checkpoints: [
    { x: 70, y: GY },
    { x: 1860, y: GY },
    { x: 2750, y: GY },
    { x: 3250, y: GY },
  ],
  enemies: [
    { defId: 'orco_explorador', x: 660, y: GY, minX: 620, maxX: 740 },
    { defId: 'orco_guerrero', x: 880, y: GY, minX: 850, maxX: 960 },
    { defId: 'orco_explorador', x: 1870, y: GY, minX: 1840, maxX: 1930 },
    { defId: 'orco_guerrero', x: 2050, y: GY, minX: 2010, maxX: 2100 },
    { defId: 'berserker_uruk', x: 2160, y: GY, minX: 2130, maxX: 2190 },
    { defId: 'orco_guerrero', x: 2500, y: GY, minX: 2450, maxX: 2580 },
    { defId: 'orco_explorador', x: 2790, y: GY, minX: 2760, maxX: 2850 },
    { defId: 'orco_guerrero', x: 2940, y: GY, minX: 2900, maxX: 2990 },
    { defId: 'orco_explorador', x: 3060, y: GY, minX: 3030, maxX: 3100 },
    { defId: 'berserker_uruk', x: 3300, y: GY, minX: 3260, maxX: 3360 },
    { defId: 'orco_guerrero', x: 3430, y: GY, minX: 3400, maxX: 3480 },
  ],
  goal: { x: 4130, y: GY },
}
