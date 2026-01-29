import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface TilesetPanelProps {
  tileset: HTMLCanvasElement | null
  selectedTileId: number
  onTileSelect: (id: number) => void
}

export function TilesetPanel({ tileset, selectedTileId, onTileSelect }: TilesetPanelProps) {
  if (!tileset) return null

  const tileSize = 16
  const tilesPerRow = 16
  const rows = 12

  const tiles: number[] = []
  for (let i = 0; i < tilesPerRow * rows; i++) {
    tiles.push(i)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Tilesets</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2">
        <Tabs defaultValue="main">
          <TabsList className="w-full">
            <TabsTrigger value="main" className="flex-1">Main</TabsTrigger>
          </TabsList>
          <TabsContent value="main" className="mt-2">
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-8 gap-1 p-1">
                {tiles.map(tileId => {
                  const col = tileId % tilesPerRow
                  const row = Math.floor(tileId / tilesPerRow)
                  
                  return (
                    <button
                      key={tileId}
                      className={`w-8 h-8 border-2 hover:border-accent transition-colors ${
                        selectedTileId === tileId ? 'border-accent' : 'border-border'
                      }`}
                      onClick={() => onTileSelect(tileId)}
                      title={`Tile ${tileId}`}
                    >
                      <canvas
                        ref={canvas => {
                          if (canvas && tileset) {
                            const ctx = canvas.getContext('2d')
                            if (ctx) {
                              canvas.width = tileSize
                              canvas.height = tileSize
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
                            }
                          }
                        }}
                        className="w-full h-full"
                      />
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
