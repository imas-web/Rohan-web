import type { Vec2, WeaponShape } from './types'

export const ATTACK_SWING_MAX_ANGLE = 1.15

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  color: string
) {
  pct = Math.max(0, Math.min(1, pct))
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * pct, h)
  ctx.strokeStyle = 'rgba(233,223,200,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

export interface HumanoidExtras {
  horns?: boolean
  tusks?: boolean
  crown?: boolean
  beard?: boolean
  shield?: boolean
  weaponShape?: WeaponShape
  legendary?: boolean
  swingT?: number
}

export function drawHumanoid(
  c: CanvasRenderingContext2D,
  pos: Vec2,
  facing: Vec2,
  radius: number,
  bodyColor: string,
  headColor: string,
  outlineColor: string,
  outlineWidth: number,
  flash: boolean,
  extras: HumanoidExtras
) {
  const dir = facing.x === 0 && facing.y === 0 ? { x: 0, y: 1 } : facing
  const fillColor = flash ? '#FFFFFF' : bodyColor
  const headFill = flash ? '#FFFFFF' : headColor
  const bw = radius * 1.15
  const bh = radius * 1.5

  // sombra
  c.beginPath()
  c.ellipse(pos.x, pos.y + radius * 0.75, radius * 0.9, radius * 0.35, 0, 0, Math.PI * 2)
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fill()

  // cuerpo (cápsula)
  c.beginPath()
  c.moveTo(pos.x - bw / 2, pos.y - bh / 2 + bw / 2)
  c.arcTo(pos.x - bw / 2, pos.y - bh / 2, pos.x, pos.y - bh / 2, bw / 2)
  c.arcTo(pos.x + bw / 2, pos.y - bh / 2, pos.x + bw / 2, pos.y - bh / 2 + bw / 2, bw / 2)
  c.lineTo(pos.x + bw / 2, pos.y + bh / 2 - bw / 2)
  c.arcTo(pos.x + bw / 2, pos.y + bh / 2, pos.x, pos.y + bh / 2, bw / 2)
  c.arcTo(pos.x - bw / 2, pos.y + bh / 2, pos.x - bw / 2, pos.y + bh / 2 - bw / 2, bw / 2)
  c.closePath()
  c.fillStyle = fillColor
  c.fill()
  c.strokeStyle = outlineColor
  c.lineWidth = outlineWidth
  c.stroke()

  // cabeza
  const headR = radius * 0.55
  const headX = pos.x
  const headY = pos.y - bh * 0.34
  c.beginPath()
  c.arc(headX, headY, headR, 0, Math.PI * 2)
  c.fillStyle = headFill
  c.fill()
  c.strokeStyle = outlineColor
  c.lineWidth = Math.max(1, outlineWidth - 1)
  c.stroke()

  if (extras.horns) {
    c.fillStyle = '#0B0C10'
    c.beginPath()
    c.moveTo(headX - headR * 0.6, headY - headR * 0.5)
    c.lineTo(headX - headR * 1.3, headY - headR * 1.5)
    c.lineTo(headX - headR * 0.1, headY - headR * 0.85)
    c.closePath()
    c.fill()
    c.beginPath()
    c.moveTo(headX + headR * 0.6, headY - headR * 0.5)
    c.lineTo(headX + headR * 1.3, headY - headR * 1.5)
    c.lineTo(headX + headR * 0.1, headY - headR * 0.85)
    c.closePath()
    c.fill()
  }

  if (extras.tusks) {
    // mandíbula prominente y colmillos, para que se lea claramente "orco"
    c.fillStyle = flash ? '#FFFFFF' : headColor
    c.beginPath()
    c.ellipse(headX, headY + headR * 0.55, headR * 0.85, headR * 0.4, 0, 0, Math.PI)
    c.fill()
    c.fillStyle = '#E8DFC8'
    c.beginPath()
    c.moveTo(headX - headR * 0.5, headY + headR * 0.55)
    c.lineTo(headX - headR * 0.62, headY + headR * 1.05)
    c.lineTo(headX - headR * 0.28, headY + headR * 0.62)
    c.closePath()
    c.fill()
    c.beginPath()
    c.moveTo(headX + headR * 0.5, headY + headR * 0.55)
    c.lineTo(headX + headR * 0.62, headY + headR * 1.05)
    c.lineTo(headX + headR * 0.28, headY + headR * 0.62)
    c.closePath()
    c.fill()
  }

  if (extras.beard) {
    c.fillStyle = flash ? '#FFFFFF' : '#D9CBA0'
    c.beginPath()
    c.moveTo(headX - headR * 0.7, headY + headR * 0.25)
    c.lineTo(headX, headY + headR * 1.5)
    c.lineTo(headX + headR * 0.7, headY + headR * 0.25)
    c.closePath()
    c.fill()
    c.strokeStyle = outlineColor
    c.lineWidth = 1
    c.stroke()
  }

  if (extras.crown) {
    c.fillStyle = '#C9A227'
    for (let i = -1; i <= 1; i++) {
      c.beginPath()
      c.moveTo(headX + i * headR * 0.7 - headR * 0.22, headY - headR * 0.85)
      c.lineTo(headX + i * headR * 0.7, headY - headR * 1.6)
      c.lineTo(headX + i * headR * 0.7 + headR * 0.22, headY - headR * 0.85)
      c.closePath()
      c.fill()
    }
  }

  // arma / arco, rotado según hacia dónde mira (y con arco de golpe si está atacando)
  const angle = Math.atan2(dir.y, dir.x)
  const swingT = extras.swingT ?? 0
  const isBow = extras.weaponShape === 'bow'
  const swingOffset = isBow ? 0 : Math.sin(swingT * Math.PI) * ATTACK_SWING_MAX_ANGLE
  c.save()
  c.translate(pos.x, pos.y)
  c.rotate(angle + swingOffset)
  const bladeColor = extras.legendary ? '#C9A227' : '#B8B0A0'
  if (isBow) {
    c.strokeStyle = '#8A6A3E'
    c.lineWidth = 2
    c.beginPath()
    c.arc(radius * 0.9, 0, radius * 0.7, -1.1, 1.1)
    c.stroke()
    c.strokeStyle = 'rgba(232,223,200,0.5)'
    c.lineWidth = 1
    c.beginPath()
    c.moveTo(radius * 0.9, -radius * 0.66)
    c.lineTo(radius * 1.55, 0)
    c.lineTo(radius * 0.9, radius * 0.66)
    c.stroke()
  } else if (extras.weaponShape === 'staff') {
    c.strokeStyle = '#5C4A34'
    c.lineWidth = Math.max(2, radius * 0.14)
    c.beginPath()
    c.moveTo(radius * 0.3, 0)
    c.lineTo(radius * 1.85, 0)
    c.stroke()
    const orbColor = extras.legendary ? '#C9A227' : '#8A4C9B'
    c.beginPath()
    c.arc(radius * 1.85, 0, radius * 0.32, 0, Math.PI * 2)
    c.fillStyle = orbColor
    c.globalAlpha = 0.85
    c.fill()
    c.globalAlpha = 1
    c.beginPath()
    c.arc(radius * 1.85, 0, radius * 0.55, 0, Math.PI * 2)
    c.strokeStyle = orbColor
    c.globalAlpha = 0.35
    c.lineWidth = 2
    c.stroke()
    c.globalAlpha = 1
  } else if (extras.weaponShape === 'dagger') {
    c.strokeStyle = bladeColor
    c.lineWidth = Math.max(2, radius * 0.14)
    c.beginPath()
    c.moveTo(radius * 0.45, 0)
    c.lineTo(radius * 1.15, 0)
    c.stroke()
  } else if (extras.weaponShape === 'axe') {
    c.strokeStyle = '#8A7A5C'
    c.lineWidth = Math.max(2, radius * 0.14)
    c.beginPath()
    c.moveTo(radius * 0.4, 0)
    c.lineTo(radius * 1.5, 0)
    c.stroke()
    c.beginPath()
    c.moveTo(radius * 1.5, -radius * 0.1)
    c.quadraticCurveTo(radius * 2.05, -radius * 0.55, radius * 1.55, -radius * 0.8)
    c.quadraticCurveTo(radius * 1.3, -radius * 0.4, radius * 1.28, 0)
    c.closePath()
    c.fillStyle = bladeColor
    c.fill()
  } else if (extras.weaponShape === 'spear') {
    c.strokeStyle = '#8A7A5C'
    c.lineWidth = Math.max(2, radius * 0.11)
    c.beginPath()
    c.moveTo(radius * 0.3, 0)
    c.lineTo(radius * 1.9, 0)
    c.stroke()
    c.beginPath()
    c.moveTo(radius * 1.9, -radius * 0.2)
    c.lineTo(radius * 2.3, 0)
    c.lineTo(radius * 1.9, radius * 0.2)
    c.closePath()
    c.fillStyle = bladeColor
    c.fill()
  } else {
    c.strokeStyle = bladeColor
    c.lineWidth = Math.max(2, radius * 0.16)
    c.beginPath()
    c.moveTo(radius * 0.4, 0)
    c.lineTo(radius * 1.6, 0)
    c.stroke()
    c.beginPath()
    c.moveTo(radius * 1.15, -radius * 0.28)
    c.lineTo(radius * 1.15, radius * 0.28)
    c.stroke()
  }
  if (extras.shield) {
    c.beginPath()
    c.arc(radius * 1.05, 0, radius * 0.9, -0.9, 0.9)
    c.strokeStyle = 'rgba(76,107,138,0.9)'
    c.lineWidth = 5
    c.stroke()
    c.fillStyle = 'rgba(76,107,138,0.16)'
    c.fill()
  }
  c.restore()
}
