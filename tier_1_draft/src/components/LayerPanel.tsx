import { Eye, EyeSlash, Lock, LockOpen } from '@phosphor-icons/react'
import { Layer } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LayerPanelProps {
  layers: Layer[]
  activeLayerIndex: number
  onLayerSelect: (index: number) => void
  onLayerToggle: (index: number, prop: 'visible' | 'locked') => void
}

export function LayerPanel({
  layers,
  activeLayerIndex,
  onLayerSelect,
  onLayerToggle,
}: LayerPanelProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Layers</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-1">
            {[...layers].reverse().map((layer, reverseIndex) => {
              const index = layers.length - 1 - reverseIndex
              const isActive = index === activeLayerIndex
              
              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    isActive
                      ? 'bg-accent/20 border-accent'
                      : 'bg-card border-border hover:bg-secondary/50'
                  } cursor-pointer transition-colors`}
                  onClick={() => onLayerSelect(index)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      onLayerToggle(index, 'visible')
                    }}
                  >
                    {layer.visible ? <Eye size={16} /> : <EyeSlash size={16} />}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      onLayerToggle(index, 'locked')
                    }}
                  >
                    {layer.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                  </Button>
                  
                  <span className="text-sm flex-1">{layer.name}</span>
                  <span className="text-xs text-muted-foreground">{layer.type}</span>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
