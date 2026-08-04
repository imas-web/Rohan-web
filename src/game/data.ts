import type { ArmorDef, ClassDef, EnemyDef, MissionDef, WeaponDef } from './types'

// Los rangos de las armas del jugador son mayores al alcance de ataque de
// cualquier enemigo cuerpo a cuerpo (incluido el jefe, 60) para que siempre
// se pueda golpear y retroceder sin recibir el golpe de vuelta.
export const WEAPONS: WeaponDef[] = [
  { id: 'daga', name: 'Daga oxidada', rarity: 'comun', damage: 8, range: 64, attackSpeed: 2.6, critChance: 0.05, shape: 'dagger' },
  { id: 'espada_corta', name: 'Espada corta', rarity: 'comun', damage: 12, range: 70, attackSpeed: 1.8, critChance: 0.08, shape: 'sword' },
  { id: 'espada_rohirrim', name: 'Espada de Rohirrim', rarity: 'raro', damage: 18, range: 78, attackSpeed: 1.6, critChance: 0.12, shape: 'sword' },
  { id: 'hacha_guardia', name: 'Hacha de guardia', rarity: 'raro', damage: 24, range: 72, attackSpeed: 1.1, critChance: 0.1, shape: 'axe' },
  { id: 'lanza_marca', name: 'Lanza de la Marca', rarity: 'epico', damage: 30, range: 100, attackSpeed: 1.3, critChance: 0.16, shape: 'spear' },
  { id: 'hoja_helm', name: 'Hoja de Helm Guarnecido', rarity: 'legendario', damage: 42, range: 88, attackSpeed: 1.5, critChance: 0.25, shape: 'sword' },
]

export const ARMORS: ArmorDef[] = [
  { id: 'ropa', name: 'Ropas de viaje', rarity: 'comun', defense: 1, hpBonus: 0, speedMod: 1.05 },
  { id: 'cuero', name: 'Cuero curtido', rarity: 'comun', defense: 3, hpBonus: 10, speedMod: 1.0 },
  { id: 'cota_rohan', name: 'Cota de Rohan', rarity: 'raro', defense: 6, hpBonus: 25, speedMod: 0.98 },
  { id: 'placas_guardia', name: 'Placas de la Guardia', rarity: 'raro', defense: 9, hpBonus: 35, speedMod: 0.94 },
  { id: 'armadura_marshal', name: 'Armadura de Mariscal', rarity: 'epico', defense: 13, hpBonus: 55, speedMod: 0.92 },
  { id: 'armadura_helm', name: 'Armadura de Helm Guarnecido', rarity: 'legendario', defense: 19, hpBonus: 80, speedMod: 0.9 },
]

export const ENEMIES: Record<string, EnemyDef> = {
  orco_explorador: { id: 'orco_explorador', name: 'Orco explorador', hp: 20, damage: 5, speed: 72, radius: 14, xpReward: 8, color: '#7A8B5C', attackRange: 34, attackCooldown: 1.0 },
  orco_guerrero: { id: 'orco_guerrero', name: 'Orco guerrero', hp: 36, damage: 8, speed: 58, radius: 16, xpReward: 14, color: '#5F6E43', attackRange: 36, attackCooldown: 1.1 },
  arquero_uruk: { id: 'arquero_uruk', name: 'Arquero Uruk-hai', hp: 26, damage: 6, speed: 52, radius: 14, xpReward: 16, color: '#3E4A6B', ranged: true, attackRange: 190, attackCooldown: 1.6 },
  berserker_uruk: { id: 'berserker_uruk', name: 'Berserker Uruk-hai', hp: 75, damage: 14, speed: 66, radius: 20, xpReward: 30, color: '#8B3A2B', attackRange: 42, attackCooldown: 1.3 },
  jefe_ugluk: { id: 'jefe_ugluk', name: 'Ugluk, capitán Uruk-hai', hp: 750, damage: 20, speed: 54, radius: 34, xpReward: 400, color: '#C1502E', attackRange: 60, attackCooldown: 0.9, isBoss: true },
}

export const CLASSES: ClassDef[] = [
  {
    id: 'guerrero',
    name: 'Guerrero',
    ultimateName: 'Grito de Guerra',
    description: 'Golpe en área alrededor tuyo: buena para cuando te rodean.',
    cooldown: 20,
    color: '#C1502E',
  },
  {
    id: 'guardian',
    name: 'Guardián',
    ultimateName: 'Bastión de Rohan',
    description: 'Te cura y te vuelve casi inmune al daño por unos segundos.',
    cooldown: 26,
    color: '#4C6B8A',
  },
  {
    id: 'cazador',
    name: 'Cazador',
    ultimateName: 'Lluvia de Flechas',
    description: 'Daño a distancia en un área amplia, ideal contra grupos.',
    cooldown: 22,
    color: '#7FD1AE',
  },
]

export function getClass(id: string): ClassDef {
  return CLASSES.find((c) => c.id === id) ?? CLASSES[0]
}

// Progresión de la habilidad definitiva: subís de nivel, ganás puntos de
// habilidad, y los invertís en mejorar tu ulti (más área/duración, menos cooldown).
export const ULTIMATE_MAX_RANK = 3
export const ULTIMATE_RANK_COST = [0, 1, 3] // costo acumulado de puntos para tener rango 1, 2 y 3

export function skillPointsForLevel(level: number): number {
  return Math.max(0, level - 1)
}

export function ultimatePowerMult(rank: number): number {
  return 1 + (rank - 1) * 0.25
}

export function ultimateCooldownMult(rank: number): number {
  return 1 - (rank - 1) * 0.15
}

export const MISSIONS: MissionDef[] = [
  { id: 'oleadas_cuerno', title: 'El Cuerno de Helm', description: 'Resistí 6 oleadas de orcos y derrotá a Ugluk al final.', mode: 'oleadas', waveCount: 6 },
  { id: 'defensa_muro', title: 'El Muro del Abismo', description: 'Defendé el muro durante 4 minutos sin que caiga.', mode: 'defensa', durationSec: 240 },
  { id: 'mision_exterminio', title: 'Limpieza del Vado', description: 'Eliminá 40 orcos antes de que refuercen sus filas.', mode: 'mision', killTarget: 40 },
  { id: 'paso_montana', title: 'El Paso de la Montaña', description: 'Saltá pozos y plataformas, peleá contra los orcos del camino, y llegá a la bandera del final.', mode: 'plataformas' },
]

export function xpToNextLevel(level: number): number {
  return Math.round(30 * Math.pow(level, 1.35) + 20)
}

export function getWeapon(id: string): WeaponDef {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0]
}

export function getArmor(id: string): ArmorDef {
  return ARMORS.find((a) => a.id === id) ?? ARMORS[0]
}

export const RARITY_COLOR: Record<string, string> = {
  comun: '#B8B0A0',
  raro: '#4C6B8A',
  epico: '#8A4C9B',
  legendario: '#C9A227',
}

export const RARITY_COST: Record<string, number> = {
  comun: 0,
  raro: 35,
  epico: 90,
  legendario: 200,
}

export const RARITY_MIN_LEVEL: Record<string, number> = {
  comun: 1,
  raro: 3,
  epico: 6,
  legendario: 10,
}
