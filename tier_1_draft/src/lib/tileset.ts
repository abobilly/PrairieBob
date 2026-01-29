export function createTilesetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const tileSize = 16
  const tilesPerRow = 16
  const rows = 12
  
  canvas.width = tileSize * tilesPerRow
  canvas.height = tileSize * rows
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  
  const colors = {
    stone: '#6B7280',
    wood: '#92400E',
    marble: '#E5E7EB',
    wall: '#374151',
    door: '#7C2D12',
    empty: 'transparent',
    brown: '#8B5A2B',
    tan: '#D2B48C',
    darkGray: '#4B5563',
    lightGray: '#D1D5DB',
  }
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < tilesPerRow; col++) {
      const index = row * tilesPerRow + col
      const x = col * tileSize
      const y = row * tileSize
      
      if (index === 0) {
        continue
      }
      
      if (index >= 1 && index <= 8) {
        const paletteColors = [
          colors.brown, colors.darkGray, colors.tan, colors.stone,
          colors.wood, colors.marble, colors.wall, colors.door
        ]
        ctx.fillStyle = paletteColors[index - 1]
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.strokeStyle = '#000'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
      else if (index >= 17 && index <= 28) {
        const doorIndex = index - 17
        const isDoorClosed = doorIndex % 4 < 2
        ctx.fillStyle = isDoorClosed ? colors.door : colors.brown
        ctx.fillRect(x, y, tileSize, tileSize)
        
        if (!isDoorClosed) {
          ctx.fillStyle = '#000'
          ctx.fillRect(x + 6, y + 2, 4, 12)
        }
        
        ctx.strokeStyle = '#000'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
      else if (index >= 33 && index <= 44) {
        const baseIndex = index - 33
        const isDoorClosed = baseIndex % 4 < 2
        ctx.fillStyle = isDoorClosed ? colors.door : colors.brown
        ctx.fillRect(x, y, tileSize, tileSize)
        
        ctx.strokeStyle = '#000'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
      else if (index >= 49 && index <= 80) {
        const marbleColors = [colors.marble, colors.lightGray, colors.stone]
        ctx.fillStyle = marbleColors[index % 3]
        ctx.fillRect(x, y, tileSize, tileSize)
        
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'
          ctx.beginPath()
          ctx.moveTo(x + Math.random() * tileSize, y)
          ctx.lineTo(x + Math.random() * tileSize, y + tileSize)
          ctx.stroke()
        }
      }
      else if (index >= 96 && index <= 160) {
        const structColors = [colors.darkGray, colors.wall, colors.stone, colors.lightGray]
        ctx.fillStyle = structColors[index % 4]
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
      else if (index >= 176 && index <= 191) {
        ctx.fillStyle = colors.brown
        ctx.fillRect(x, y, tileSize, tileSize)
        
        ctx.fillStyle = '#000'
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(x + 2, y + i * 4 + 2, 8, 2)
        }
        
        ctx.strokeStyle = '#000'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
      else {
        ctx.fillStyle = colors.lightGray
        ctx.fillRect(x, y, tileSize, tileSize)
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.strokeRect(x, y, tileSize, tileSize)
      }
    }
  }
  
  return canvas
}

export function getTileFromTileset(
  tileset: HTMLCanvasElement,
  tileId: number,
  tileSize: number,
  tilesPerRow: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = tileSize
  canvas.height = tileSize
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  
  const col = tileId % tilesPerRow
  const row = Math.floor(tileId / tilesPerRow)
  
  ctx.drawImage(
    tileset,
    col * tileSize,
    row * tileSize,
    tileSize,
    tileSize,
    0,
    0,
    tileSize,
    tileSize
  )
  
  return canvas
}
