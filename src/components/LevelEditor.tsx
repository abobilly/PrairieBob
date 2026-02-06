import type { Level } from '@/lib/ldtk/level'
import type { FieldInstance } from '@/lib/ldtk/layer-instance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface LevelEditorProps {
  level: Level
  onChange: (level: Level) => void
}

type ParsedFieldType = {
  baseType: string
  isArray: boolean
  enumName?: string
}

const MIN_LEVEL_SIZE = 1
const MAX_LEVEL_SIZE = 4096
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}){1,2}$/

const parseFieldType = (rawType: string): ParsedFieldType => {
  const arrayMatch = rawType.match(/^Array<(.+)>$/)
  const isArray = Boolean(arrayMatch)
  const innerType = arrayMatch ? arrayMatch[1] : rawType

  if (
    innerType.startsWith('Enum.') ||
    innerType.startsWith('LocalEnum.') ||
    innerType.startsWith('ExternEnum.')
  ) {
    const [, enumName] = innerType.split('.', 2)
    return { baseType: 'Enum', isArray, enumName }
  }

  return { baseType: innerType, isArray }
}

const getStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

const getNumberValue = (value: unknown): number | '' => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return value
}

const getEnumOptions = (field: FieldInstance, currentValue: unknown): string[] => {
  const options: string[] = []

  if (Array.isArray(field.realEditorValues)) {
    for (const entry of field.realEditorValues) {
      if (typeof entry === 'string') {
        options.push(entry)
      }
    }
  }

  if (Array.isArray(currentValue)) {
    for (const entry of currentValue) {
      if (typeof entry === 'string') {
        options.push(entry)
      }
    }
  }

  if (typeof currentValue === 'string') {
    options.push(currentValue)
  }

  return Array.from(new Set(options))
}

const getColorValue = (value: unknown): string => {
  if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0')}`
  }

  return '#000000'
}

const normalizePoint = (value: unknown): { x: number; y: number; shape: 'array' | 'xy' | 'cxcy' } => {
  if (Array.isArray(value) && value.length >= 2) {
    return {
      x: Number(value[0]) || 0,
      y: Number(value[1]) || 0,
      shape: 'array',
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.cx === 'number' || typeof record.cy === 'number') {
      return {
        x: typeof record.cx === 'number' ? record.cx : 0,
        y: typeof record.cy === 'number' ? record.cy : 0,
        shape: 'cxcy',
      }
    }

    if (typeof record.x === 'number' || typeof record.y === 'number') {
      return {
        x: typeof record.x === 'number' ? record.x : 0,
        y: typeof record.y === 'number' ? record.y : 0,
        shape: 'xy',
      }
    }
  }

  return { x: 0, y: 0, shape: 'xy' }
}

const applyPointUpdate = (
  value: unknown,
  nextX: number,
  nextY: number,
  shape: 'array' | 'xy' | 'cxcy'
): unknown => {
  if (shape === 'array') {
    return [nextX, nextY]
  }

  if (shape === 'cxcy') {
    return { cx: nextX, cy: nextY }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value, x: nextX, y: nextY }
  }

  return { x: nextX, y: nextY }
}

const clampLevelSize = (value: number): number => {
  if (Number.isNaN(value)) return MIN_LEVEL_SIZE
  return Math.min(MAX_LEVEL_SIZE, Math.max(MIN_LEVEL_SIZE, Math.trunc(value)))
}

const getLevelBgColor = (level: Level): string => {
  if (level.bgColor !== null && level.bgColor !== undefined) {
    return getColorValue(level.bgColor)
  }

  if (typeof level.__bgColor === 'string' && HEX_COLOR_PATTERN.test(level.__bgColor)) {
    return level.__bgColor
  }

  return '#000000'
}

export function LevelEditor({ level, onChange }: LevelEditorProps) {
  const handleFieldChange = (field: FieldInstance, value: unknown) => {
    const updatedFields = level.fieldInstances.map((instance) =>
      instance.defUid === field.defUid
        ? {
            ...instance,
            __value: value,
          }
        : instance
    )

    onChange({
      ...level,
      fieldInstances: updatedFields,
    })
  }

  const handleArrayItemChange = (
    field: FieldInstance,
    index: number,
    value: unknown
  ) => {
    const currentValues = Array.isArray(field.__value) ? [...field.__value] : []
    currentValues[index] = value
    handleFieldChange(field, currentValues)
  }

  const renderScalarInput = (
    field: FieldInstance,
    parsedType: ParsedFieldType,
    value: unknown,
    onValueChange: (nextValue: unknown) => void
  ) => {
    switch (parsedType.baseType) {
      case 'String':
        return (
          <Input
            value={getStringValue(value)}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-8 text-sm"
          />
        )
      case 'Text':
        return (
          <Textarea
            value={getStringValue(value)}
            onChange={(event) => onValueChange(event.target.value)}
            className="min-h-[120px] text-sm"
          />
        )
      case 'Int':
      case 'Float': {
        const isFloat = parsedType.baseType === 'Float'
        return (
          <Input
            type="number"
            value={getNumberValue(value)}
            step={isFloat ? '0.01' : '1'}
            onChange={(event) => {
              if (event.target.value === '') return
              const parsed = Number(event.target.value)
              if (Number.isNaN(parsed)) return
              onValueChange(isFloat ? parsed : Math.trunc(parsed))
            }}
            className="h-8 text-sm"
          />
        )
      }
      case 'Bool':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onValueChange(event.target.checked)}
              className="h-4 w-4 rounded border border-input"
            />
            <span className="text-xs text-muted-foreground">Enabled</span>
          </div>
        )
      case 'Color': {
        const colorValue = getColorValue(value)
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={colorValue}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-8 w-10 rounded border border-input bg-transparent p-0"
            />
            <Input
              value={colorValue}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )
      }
      case 'Enum': {
        const enumOptions = getEnumOptions(field, value)
        const currentValue = typeof value === 'string' ? value : ''
        if (currentValue && !enumOptions.includes(currentValue)) {
          enumOptions.unshift(currentValue)
        }

        return (
          <Select
            value={currentValue}
            onValueChange={(nextValue) => onValueChange(nextValue)}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {enumOptions.length > 0 ? (
                enumOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__none" disabled>
                  No options
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )
      }
      case 'Point': {
        const point = normalizePoint(value)
        return (
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={getNumberValue(point.x)}
              onChange={(event) => {
                if (event.target.value === '') return
                const parsed = Number(event.target.value)
                if (Number.isNaN(parsed)) return
                onValueChange(applyPointUpdate(value, parsed, point.y, point.shape))
              }}
              className="h-8 text-sm"
              placeholder="X"
            />
            <Input
              type="number"
              value={getNumberValue(point.y)}
              onChange={(event) => {
                if (event.target.value === '') return
                const parsed = Number(event.target.value)
                if (Number.isNaN(parsed)) return
                onValueChange(applyPointUpdate(value, point.x, parsed, point.shape))
              }}
              className="h-8 text-sm"
              placeholder="Y"
            />
          </div>
        )
      }
      case 'FilePath':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const filePath = (file as File & { path?: string }).path ?? file.name
                onValueChange(filePath)
              }}
              className="h-8 text-sm"
            />
            {typeof value === 'string' && value.length > 0 && (
              <div className="text-xs text-muted-foreground">Current: {value}</div>
            )}
          </div>
        )
      default:
        return (
          <Input
            value={getStringValue(value)}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-8 text-sm"
          />
        )
    }
  }

  const handleLevelWidthChange = (value: number) => {
    onChange({
      ...level,
      pxWid: clampLevelSize(value),
    })
  }

  const handleLevelHeightChange = (value: number) => {
    onChange({
      ...level,
      pxHei: clampLevelSize(value),
    })
  }

  const handleBgColorChange = (value: string) => {
    const normalized = value.trim()
    if (!HEX_COLOR_PATTERN.test(normalized)) return
    const parsed = parseInt(normalized.replace('#', ''), 16)
    if (Number.isNaN(parsed)) return
    onChange({
      ...level,
      bgColor: parsed,
      __bgColor: normalized,
    })
  }

  const widthValid = level.pxWid >= MIN_LEVEL_SIZE && level.pxWid <= MAX_LEVEL_SIZE
  const heightValid = level.pxHei >= MIN_LEVEL_SIZE && level.pxHei <= MAX_LEVEL_SIZE
  const hasBgOverride = level.bgColor !== null && level.bgColor !== undefined

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Level</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Identifier</Label>
              <Input
                value={level.identifier}
                onChange={(event) => onChange({ ...level, identifier: event.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  min={MIN_LEVEL_SIZE}
                  max={MAX_LEVEL_SIZE}
                  value={getNumberValue(level.pxWid)}
                  onChange={(event) => {
                    if (event.target.value === '') return
                    const parsed = Number(event.target.value)
                    if (Number.isNaN(parsed)) return
                    handleLevelWidthChange(parsed)
                  }}
                  className="h-8 text-sm font-mono"
                />
                {!widthValid && (
                  <p className="text-[10px] text-red-400">
                    Must be between {MIN_LEVEL_SIZE} and {MAX_LEVEL_SIZE}px.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  min={MIN_LEVEL_SIZE}
                  max={MAX_LEVEL_SIZE}
                  value={getNumberValue(level.pxHei)}
                  onChange={(event) => {
                    if (event.target.value === '') return
                    const parsed = Number(event.target.value)
                    if (Number.isNaN(parsed)) return
                    handleLevelHeightChange(parsed)
                  }}
                  className="h-8 text-sm font-mono"
                />
                {!heightValid && (
                  <p className="text-[10px] text-red-400">
                    Must be between {MIN_LEVEL_SIZE} and {MAX_LEVEL_SIZE}px.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={getLevelBgColor(level)}
                  onChange={(event) => handleBgColorChange(event.target.value)}
                  className="h-8 w-10 rounded border border-input bg-transparent p-0"
                />
                <Input
                  value={getLevelBgColor(level)}
                  onChange={(event) => handleBgColorChange(event.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...level, bgColor: null })}
                  disabled={!hasBgOverride}
                >
                  Use default
                </Button>
              </div>
              {!hasBgOverride && (
                <p className="text-[10px] text-muted-foreground">
                  Using project default background color.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background Image</Label>
              <Input
                value={level.bgRelPath ?? ''}
                onChange={(event) =>
                  onChange({ ...level, bgRelPath: event.target.value || null })
                }
                className="h-8 text-sm"
                placeholder="path/to/background.png"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const filePath = (file as File & { path?: string }).path ?? file.name
                    onChange({ ...level, bgRelPath: filePath })
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...level, bgRelPath: null })}
                  disabled={!level.bgRelPath}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-xs">Custom Fields</Label>
              {level.fieldInstances.length === 0 ? (
                <div className="text-xs text-muted-foreground">No custom fields</div>
              ) : (
                <div className="space-y-4">
                  {level.fieldInstances.map((field) => {
                    const parsedType = parseFieldType(field.__type)
                    const fieldValue = field.__value
                    const valuesToRender =
                      parsedType.isArray && Array.isArray(fieldValue) ? fieldValue : null

                    return (
                      <div key={field.defUid} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{field.__identifier}</Label>
                          <span className="text-[10px] text-muted-foreground">
                            {field.__type}
                          </span>
                        </div>
                        {valuesToRender ? (
                          <div className="space-y-2">
                            {valuesToRender.length === 0 ? (
                              <div className="text-xs text-muted-foreground">No values</div>
                            ) : (
                              valuesToRender.map((entry, index) => (
                                <div
                                  key={`${field.defUid}-${index}`}
                                  className="rounded-md border border-input p-2"
                                >
                                  {renderScalarInput(field, parsedType, entry, (next) =>
                                    handleArrayItemChange(field, index, next)
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          renderScalarInput(field, parsedType, fieldValue, (next) =>
                            handleFieldChange(field, next)
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
