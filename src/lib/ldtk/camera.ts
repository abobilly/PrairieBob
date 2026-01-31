/**
 * LDtk Camera - Viewport and coordinate transforms
 * Ported from LDtk/src/electron.renderer/display/Camera.hx
 */

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8.0

export class Camera {
  zoom: number
  panX: number
  panY: number
  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.zoom = 1
    this.panX = 0
    this.panY = 0
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.panX) / this.zoom,
      y: (y - this.panY) / this.zoom,
    }
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: x * this.zoom + this.panX,
      y: y * this.zoom + this.panY,
    }
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  }

  setPan(x: number, y: number): void {
    this.panX = x
    this.panY = y
  }

  fitBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    const safeWidth = Math.max(bounds.width, 1)
    const safeHeight = Math.max(bounds.height, 1)
    const nextZoom = Math.min(this.width / safeWidth, this.height / safeHeight)
    this.setZoom(nextZoom)
    this.centerOn(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5)
  }

  centerOn(x: number, y: number): void {
    this.panX = this.width * 0.5 - x * this.zoom
    this.panY = this.height * 0.5 - y * this.zoom
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
