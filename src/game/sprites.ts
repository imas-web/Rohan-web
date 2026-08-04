import type { Vec2 } from './types'

// Spritesheets pixel-art (Liberated Pixel Cup, CC-BY-SA/GPL — ver CREDITS.md).
// Cada hoja: 9 columnas x 4 filas de 64x64, ciclo de caminata por fila
// (0=arriba, 1=izquierda, 2=abajo, 3=derecha), frame 0 = pose de pie.
const FRAME = 64
const COLS = 9

export type SpriteKey =
  | 'guerrero'
  | 'enano'
  | 'arquero'
  | 'mago'
  | 'orco_explorador'
  | 'orco_guerrero'
  | 'arquero_uruk'
  | 'berserker_uruk'
  | 'jefe_ugluk'

const images = new Map<SpriteKey, HTMLImageElement>()

function getImage(key: SpriteKey): HTMLImageElement {
  let img = images.get(key)
  if (!img) {
    img = new Image()
    img.src = `/sprites/${key}_walk.png`
    images.set(key, img)
  }
  return img
}

// pre-carga todas las hojas (llamar una vez al iniciar la pantalla de juego)
export function preloadSprites() {
  const keys: SpriteKey[] = [
    'guerrero', 'enano', 'arquero', 'mago',
    'orco_explorador', 'orco_guerrero', 'arquero_uruk', 'berserker_uruk', 'jefe_ugluk',
  ]
  keys.forEach(getImage)
}

function directionRow(facing: Vec2): number {
  if (Math.abs(facing.y) >= Math.abs(facing.x)) {
    return facing.y >= 0 ? 2 : 0
  }
  return facing.x >= 0 ? 3 : 1
}

const moveTrackers = new Map<string, { lastPos: Vec2; lastT: number; moving: boolean }>()

function trackMovement(id: string, pos: Vec2, now: number): boolean {
  const prev = moveTrackers.get(id)
  if (!prev) {
    moveTrackers.set(id, { lastPos: { ...pos }, lastT: now, moving: false })
    return false
  }
  const dt = now - prev.lastT
  if (dt > 60) {
    const dx = pos.x - prev.lastPos.x
    const dy = pos.y - prev.lastPos.y
    const dist = Math.hypot(dx, dy)
    prev.moving = dist > 0.6
    prev.lastPos = { ...pos }
    prev.lastT = now
  }
  return prev.moving
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  trackId: string,
  key: SpriteKey,
  pos: Vec2,
  facing: Vec2,
  targetHeight: number,
  flash: boolean
) {
  const img = getImage(key)
  if (!img.complete || img.naturalWidth === 0) return false

  const now = performance.now()
  const moving = trackMovement(trackId, pos, now)
  const row = directionRow(facing)
  const col = moving ? Math.floor(now / 90) % COLS : 0

  const scale = targetHeight / FRAME
  const w = FRAME * scale
  const h = FRAME * scale

  ctx.imageSmoothingEnabled = false
  if (flash) {
    // silueta blanca: dibuja el sprite normal a un canvas offscreen chico y tiñe con 'source-atop'
    const off = document.createElement('canvas')
    off.width = FRAME
    off.height = FRAME
    const octx = off.getContext('2d')
    if (octx) {
      octx.imageSmoothingEnabled = false
      octx.drawImage(img, col * FRAME, row * FRAME, FRAME, FRAME, 0, 0, FRAME, FRAME)
      octx.globalCompositeOperation = 'source-atop'
      octx.fillStyle = '#FFFFFF'
      octx.fillRect(0, 0, FRAME, FRAME)
      ctx.drawImage(off, pos.x - w / 2, pos.y - h * 0.82, w, h)
      return true
    }
  }
  ctx.drawImage(img, col * FRAME, row * FRAME, FRAME, FRAME, pos.x - w / 2, pos.y - h * 0.82, w, h)
  return true
}

export function clearSpriteTracking(id: string) {
  moveTrackers.delete(id)
}
