import type { AbilityDef, ArmorDef, ClassDef, ClassId, EnemyDef, MissionDef, Rarity, WeaponDef } from './types'

// Los rangos de las armas del jugador son mayores al alcance de ataque de
// cualquier enemigo cuerpo a cuerpo (incluido el jefe, 60) para que siempre
// se pueda golpear y retroceder sin recibir el golpe de vuelta.
// Cada clase tiene su propia línea de 4 armas (una por rareza); el arma y la
// armadura del jugador se derivan automáticamente del nivel, no se compran.
export const WEAPONS: WeaponDef[] = [
  { id: 'daga', name: 'Daga oxidada', rarity: 'comun', damage: 8, range: 64, attackSpeed: 2.6, critChance: 0.05, shape: 'dagger' },

  { id: 'espada_corta', name: 'Espada corta', rarity: 'comun', damage: 12, range: 70, attackSpeed: 1.8, critChance: 0.08, shape: 'sword' },
  { id: 'espada_rohirrim', name: 'Espada de Rohirrim', rarity: 'raro', damage: 18, range: 78, attackSpeed: 1.6, critChance: 0.12, shape: 'sword' },
  { id: 'espada_marshal', name: 'Espada de Mariscal', rarity: 'epico', damage: 26, range: 82, attackSpeed: 1.5, critChance: 0.14, shape: 'sword' },
  { id: 'hoja_helm', name: 'Hoja de Helm Guarnecido', rarity: 'legendario', damage: 42, range: 88, attackSpeed: 1.5, critChance: 0.25, shape: 'sword' },

  { id: 'hacha_minero', name: 'Hacha de minero', rarity: 'comun', damage: 14, range: 62, attackSpeed: 1.4, critChance: 0.07, shape: 'axe' },
  { id: 'hacha_guardia', name: 'Hacha de guardia', rarity: 'raro', damage: 24, range: 72, attackSpeed: 1.1, critChance: 0.1, shape: 'axe' },
  { id: 'hacha_khazad', name: 'Hacha de Khazad-dûm', rarity: 'epico', damage: 34, range: 76, attackSpeed: 1.0, critChance: 0.14, shape: 'axe' },
  { id: 'hacha_durin', name: 'Hacha de Durin', rarity: 'legendario', damage: 48, range: 80, attackSpeed: 1.0, critChance: 0.2, shape: 'axe' },

  { id: 'arco_corto', name: 'Arco corto de caza', rarity: 'comun', damage: 10, range: 230, attackSpeed: 1.6, critChance: 0.1, shape: 'bow' },
  { id: 'arco_largo_lorien', name: 'Arco largo de Lórien', rarity: 'raro', damage: 15, range: 250, attackSpeed: 1.5, critChance: 0.14, shape: 'bow' },
  { id: 'arco_galadhrim', name: 'Arco Galadhrim', rarity: 'epico', damage: 21, range: 270, attackSpeed: 1.4, critChance: 0.18, shape: 'bow' },
  { id: 'arco_thranduil', name: 'Arco de Thranduil', rarity: 'legendario', damage: 30, range: 290, attackSpeed: 1.4, critChance: 0.26, shape: 'bow' },

  { id: 'baston_iniciado', name: 'Bastón de aprendiz', rarity: 'comun', damage: 11, range: 230, attackSpeed: 1.4, critChance: 0.08, shape: 'staff' },
  { id: 'baston_istari', name: 'Bastón Istari', rarity: 'raro', damage: 16, range: 245, attackSpeed: 1.35, critChance: 0.12, shape: 'staff' },
  { id: 'baston_saruman', name: 'Bastón de Saruman', rarity: 'epico', damage: 23, range: 260, attackSpeed: 1.3, critChance: 0.16, shape: 'staff' },
  { id: 'baston_gandalf', name: 'Bastón de Gandalf', rarity: 'legendario', damage: 33, range: 280, attackSpeed: 1.3, critChance: 0.24, shape: 'staff' },
]

export const ARMORS: ArmorDef[] = [
  { id: 'cuero', name: 'Cuero curtido', rarity: 'comun', defense: 3, hpBonus: 10, speedMod: 1.0 },
  { id: 'placas_guardia', name: 'Placas de la Guardia', rarity: 'raro', defense: 9, hpBonus: 35, speedMod: 0.94 },
  { id: 'armadura_marshal', name: 'Armadura de Mariscal', rarity: 'epico', defense: 13, hpBonus: 55, speedMod: 0.92 },
  { id: 'armadura_helm', name: 'Armadura de Helm Guarnecido', rarity: 'legendario', defense: 19, hpBonus: 80, speedMod: 0.9 },
]

export const ENEMIES: Record<string, EnemyDef> = {
  orco_explorador: { id: 'orco_explorador', name: 'Orco explorador', hp: 20, damage: 5, speed: 72, radius: 14, xpReward: 5, color: '#7A8B5C', attackRange: 34, attackCooldown: 1.0 },
  orco_guerrero: { id: 'orco_guerrero', name: 'Orco guerrero', hp: 36, damage: 8, speed: 58, radius: 16, xpReward: 9, color: '#5F6E43', attackRange: 36, attackCooldown: 1.1 },
  arquero_uruk: { id: 'arquero_uruk', name: 'Arquero Uruk-hai', hp: 26, damage: 6, speed: 52, radius: 14, xpReward: 10, color: '#3E4A6B', ranged: true, attackRange: 190, attackCooldown: 1.6 },
  berserker_uruk: { id: 'berserker_uruk', name: 'Berserker Uruk-hai', hp: 75, damage: 14, speed: 66, radius: 20, xpReward: 18, color: '#8B3A2B', attackRange: 42, attackCooldown: 1.3 },
  jefe_ugluk: { id: 'jefe_ugluk', name: 'Ugluk, capitán Uruk-hai', hp: 750, damage: 20, speed: 54, radius: 34, xpReward: 260, color: '#C1502E', attackRange: 60, attackCooldown: 0.9, isBoss: true },
}

export const CLASSES: ClassDef[] = [
  {
    id: 'guerrero',
    name: 'Guerrero',
    weaponShape: 'sword',
    ranged: false,
    bodyScale: 1,
    description: 'Pelea cuerpo a cuerpo con espada. Resistente y directo.',
    color: '#C1502E',
  },
  {
    id: 'enano',
    name: 'Enano',
    weaponShape: 'axe',
    ranged: false,
    bodyScale: 0.82,
    description: 'Pelea cuerpo a cuerpo con hacha. Bajo, duro, y difícil de tumbar.',
    color: '#8A7A5C',
  },
  {
    id: 'arquero',
    name: 'Arquero',
    weaponShape: 'bow',
    ranged: true,
    bodyScale: 1,
    description: 'Ataca a distancia con arco y flechas. Golpea antes de que te toquen.',
    color: '#7FD1AE',
  },
  {
    id: 'mago',
    name: 'Mago',
    weaponShape: 'staff',
    ranged: true,
    bodyScale: 1,
    description: 'Ataca a distancia con hechizos de bastón. Poder arcano en área.',
    color: '#8A4C9B',
  },
]

export function getClass(id: string): ClassDef {
  return CLASSES.find((c) => c.id === id) ?? CLASSES[0]
}

// 4 habilidades por clase. La primera (nivel 1) ya la tenés; las otras 3 se
// desbloquean con nivel + materiales, y elegís UNA sola como tu definitiva activa.
export const ABILITIES: AbilityDef[] = [
  // Guerrero
  { id: 'guerrero_grito', classId: 'guerrero', name: 'Grito de Guerra', archetype: 'nuke', description: 'Golpe en área alrededor tuyo: buena para cuando te rodean.', cooldown: 20, unlockLevel: 1, unlockCost: 0, color: '#C1502E', radius: 150, damageMult: 1.7 },
  { id: 'guerrero_furia', classId: 'guerrero', name: 'Furia de Rohan', archetype: 'buff', description: 'Más velocidad de ataque y daño por unos segundos.', cooldown: 24, unlockLevel: 3, unlockCost: 30, color: '#D9673F', buffDuration: 7, buffDamageMult: 1.15, buffAtkSpeedMult: 1.25 },
  { id: 'guerrero_resistencia', classId: 'guerrero', name: 'Última Resistencia', archetype: 'shield', description: 'Te cura y te vuelve casi inmune al daño por unos segundos.', cooldown: 28, unlockLevel: 6, unlockCost: 70, color: '#4C6B8A', shieldDuration: 3.5, healPct: 0.25 },
  { id: 'guerrero_estocada', classId: 'guerrero', name: 'Estocada de Poder', archetype: 'burst', description: 'Un golpe devastador a un solo enemigo cercano.', cooldown: 16, unlockLevel: 10, unlockCost: 150, color: '#C9A227', burstRange: 300, damageMult: 4.5 },

  // Enano
  { id: 'enano_coraza', classId: 'enano', name: 'Coraza de Forja', archetype: 'shield', description: 'Te cura y te vuelve casi inmune al daño por unos segundos.', cooldown: 26, unlockLevel: 1, unlockCost: 0, color: '#8A7A5C', shieldDuration: 4, healPct: 0.3 },
  { id: 'enano_onda', classId: 'enano', name: 'Onda de Choque', archetype: 'nuke', description: 'Golpe de hacha contra el suelo: daño en área a tu alrededor.', cooldown: 20, unlockLevel: 3, unlockCost: 30, color: '#B8842E', radius: 130, damageMult: 1.75 },
  { id: 'enano_sangre', classId: 'enano', name: 'Sangre de Durin', archetype: 'buff', description: 'Más daño y velocidad de movimiento por unos segundos.', cooldown: 24, unlockLevel: 6, unlockCost: 70, color: '#8B3A2B', buffDuration: 6, buffDamageMult: 1.2, buffSpeedMult: 1.15 },
  { id: 'enano_golpe_forja', classId: 'enano', name: 'Golpe de Forja', archetype: 'burst', description: 'Un hachazo brutal cuerpo a cuerpo contra un solo enemigo.', cooldown: 16, unlockLevel: 10, unlockCost: 150, color: '#C9A227', burstRange: 90, damageMult: 4 },

  // Arquero
  { id: 'arquero_lluvia', classId: 'arquero', name: 'Lluvia de Flechas', archetype: 'nuke', description: 'Daño a distancia en un área amplia, ideal contra grupos.', cooldown: 22, unlockLevel: 1, unlockCost: 0, color: '#7FD1AE', radius: 280, damageMult: 1.1 },
  { id: 'arquero_ojo', classId: 'arquero', name: 'Ojo de Halcón', archetype: 'buff', description: 'Más velocidad de disparo y daño por unos segundos.', cooldown: 24, unlockLevel: 3, unlockCost: 30, color: '#5FA98A', buffDuration: 7, buffDamageMult: 1.1, buffAtkSpeedMult: 1.3 },
  { id: 'arquero_retirada', classId: 'arquero', name: 'Retirada Élfica', archetype: 'shield', description: 'Te cura y te vuelve casi inmune al daño por unos segundos.', cooldown: 26, unlockLevel: 6, unlockCost: 70, color: '#4C6B8A', shieldDuration: 3, healPct: 0.18 },
  { id: 'arquero_perforante', classId: 'arquero', name: 'Flecha Perforante', archetype: 'burst', description: 'Un disparo cargado que perfora a un solo enemigo lejano.', cooldown: 15, unlockLevel: 10, unlockCost: 150, color: '#C9A227', burstRange: 320, damageMult: 5 },

  // Mago
  { id: 'mago_tormenta', classId: 'mago', name: 'Tormenta Arcana', archetype: 'nuke', description: 'Descarga una tormenta arcana en un área muy amplia.', cooldown: 24, unlockLevel: 1, unlockCost: 0, color: '#8A4C9B', radius: 320, damageMult: 0.95 },
  { id: 'mago_bendicion', classId: 'mago', name: 'Bendición de Poder', archetype: 'buff', description: 'Más daño y velocidad de conjuro por unos segundos.', cooldown: 24, unlockLevel: 3, unlockCost: 30, color: '#A56AC2', buffDuration: 7, buffDamageMult: 1.2, buffAtkSpeedMult: 1.2 },
  { id: 'mago_escudo', classId: 'mago', name: 'Escudo Arcano', archetype: 'shield', description: 'Te cura y te vuelve casi inmune al daño por unos segundos.', cooldown: 27, unlockLevel: 6, unlockCost: 70, color: '#4C6B8A', shieldDuration: 4, healPct: 0.2 },
  { id: 'mago_rayo', classId: 'mago', name: 'Rayo de Fuego', archetype: 'burst', description: 'Un rayo de fuego concentrado contra un solo enemigo.', cooldown: 15, unlockLevel: 10, unlockCost: 150, color: '#C9A227', burstRange: 300, damageMult: 5 },
]

export function abilitiesForClass(classId: string): AbilityDef[] {
  return ABILITIES.filter((a) => a.classId === classId)
}

export function getAbility(id: string): AbilityDef {
  return ABILITIES.find((a) => a.id === id) ?? ABILITIES[0]
}

export function defaultAbilityForClass(classId: string): string {
  const abilities = abilitiesForClass(classId)
  return (abilities.find((a) => a.unlockLevel === 1) ?? abilities[0]).id
}

// Progresión de la habilidad activa: subís de nivel, ganás puntos de
// habilidad, y los invertís en mejorarla (más área/duración, menos cooldown).
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

// Con más jugadores en la partida aparecen más enemigos (misma cantidad de
// "presión" por jugador que jugando solo), pero cada uno da menos experiencia
// y materiales — así el total que gana cada jugador se mantiene parecido a
// lo que ganaría jugando solo, en vez de multiplicarse por el tamaño del grupo.
export function enemyCountMultiplierForParty(partySize: number): number {
  return Math.max(1, partySize)
}

export function rewardMultiplierForParty(partySize: number): number {
  return 1 / Math.max(1, partySize)
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

export const RARITY_MIN_LEVEL: Record<Rarity, number> = {
  comun: 1,
  raro: 3,
  epico: 6,
  legendario: 10,
}

// Equipo automático: el arma y la armadura de cada clase mejoran solas al
// subir de nivel, según la misma escala de rareza que las habilidades.
const CLASS_WEAPON_TIERS: Record<ClassId, Record<Rarity, string>> = {
  guerrero: { comun: 'espada_corta', raro: 'espada_rohirrim', epico: 'espada_marshal', legendario: 'hoja_helm' },
  enano: { comun: 'hacha_minero', raro: 'hacha_guardia', epico: 'hacha_khazad', legendario: 'hacha_durin' },
  arquero: { comun: 'arco_corto', raro: 'arco_largo_lorien', epico: 'arco_galadhrim', legendario: 'arco_thranduil' },
  mago: { comun: 'baston_iniciado', raro: 'baston_istari', epico: 'baston_saruman', legendario: 'baston_gandalf' },
}

const ARMOR_TIERS: Record<Rarity, string> = {
  comun: 'cuero',
  raro: 'placas_guardia',
  epico: 'armadura_marshal',
  legendario: 'armadura_helm',
}

export function tierForLevel(level: number): Rarity {
  if (level >= RARITY_MIN_LEVEL.legendario) return 'legendario'
  if (level >= RARITY_MIN_LEVEL.epico) return 'epico'
  if (level >= RARITY_MIN_LEVEL.raro) return 'raro'
  return 'comun'
}

export function weaponIdForClassLevel(classId: string, level: number): string {
  const tiers = CLASS_WEAPON_TIERS[classId as ClassId] ?? CLASS_WEAPON_TIERS.guerrero
  return tiers[tierForLevel(level)]
}

export function armorIdForLevel(level: number): string {
  return ARMOR_TIERS[tierForLevel(level)]
}
