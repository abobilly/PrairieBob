import { useEffect, useMemo, useRef, useState } from 'react'
import type { FieldDef } from '@/lib/ldtk/types'
import type { FieldInstance } from '@/lib/ldtk/layer-instance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FieldsFormProps {
  fields: FieldInstance[]
  fieldDefs: FieldDef[]
  onChange: (fields: FieldInstance[]) => void
}

type ParsedFieldType = {
  baseType: string
  isArray: boolean
  enumName?: string
}

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

const resolveFieldType = (def: FieldDef, field?: FieldInstance): ParsedFieldType => {
  if (field?.__type) {
    const parsed = parseFieldType(field.__type)
    return { ...parsed, isArray: parsed.isArray || def.isArray }
  }

  const baseType = def.type === 'Array' ? 'String' : def.type
  return { baseType, isArray: def.isArray }
}

const getStringValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

const getNumberValue = (value: unknown): number | '' => {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return value
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

const getEnumOptions = (field: FieldInstance | undefined, currentValue: unknown): string[] => {
  const options: string[] = []

  if (Array.isArray(field?.realEditorValues)) {
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

const formatDefaultValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value === '' ? '(empty)' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const getScalarDefaultValue = (def: FieldDef, parsedType: ParsedFieldType): unknown => {
  if (def.defaultOverride !== undefined && !Array.isArray(def.defaultOverride)) {
    return def.defaultOverride
  }

  if (def.canBeNull) return null

  switch (parsedType.baseType) {
    case 'Int':
    case 'Float':
      return 0
    case 'Bool':
      return false
    case 'Color':
      return '#000000'
    case 'Point':
      return { x: 0, y: 0 }
    case 'Enum':
      return ''
    case 'FilePath':
    case 'Tile':
    case 'EntityRef':
      return null
    case 'Text':
    case 'Multilines':
    case 'String':
    default:
      return ''
  }
}

const getArrayDefaultValue = (def: FieldDef, parsedType: ParsedFieldType): unknown[] => {
  if (Array.isArray(def.defaultOverride)) {
    return def.defaultOverride
  }

  return []
}

const safeRegex = (pattern: string | null) => {
  if (!pattern) return { regex: null, error: null }
  try {
    return { regex: new RegExp(pattern), error: null }
  } catch (error) {
    return { regex: null, error: error instanceof Error ? error.message : 'Invalid regex' }
  }
}

const serializeJsonValue = (value: unknown): string => {
  if (value === undefined) return ''
  return JSON.stringify(value, null, 2)
}

export function FieldsForm({ fields, fieldDefs, onChange }: FieldsFormProps) {
  const fieldMap = useMemo(() => {
    const entries = fields.map((field) => [field.defUid, field] as const)
    return new Map(entries)
  }, [fields])
  const [jsonBuffers, setJsonBuffers] = useState<Record<string, string>>({})
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({})
  const lastSerializedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    setJsonBuffers((current) => {
      const next = { ...current }
      let updated = false
      const nextSerialized: Record<string, string> = {}

      fieldDefs.forEach((def) => {
        const field = fieldMap.get(def.uid)
        const parsedType = resolveFieldType(def, field)
        if (parsedType.baseType !== 'Tile' && parsedType.baseType !== 'EntityRef') {
          return
        }
        const values = parsedType.isArray && Array.isArray(field?.__value)
          ? field.__value
          : [field?.__value]
        values.forEach((value, index) => {
          const key = `${def.uid}-${index}`
          const serialized = serializeJsonValue(value)
          nextSerialized[key] = serialized
          const lastSerialized = lastSerializedRef.current[key]
          const currentValue = current[key]
          if (currentValue === undefined || currentValue === lastSerialized) {
            if (currentValue !== serialized) {
              next[key] = serialized
              updated = true
            }
          }
        })
      })

      lastSerializedRef.current = nextSerialized
      return updated ? next : current
    })
  }, [fieldDefs, fieldMap])

  const handleFieldChange = (def: FieldDef, parsedType: ParsedFieldType, nextValue: unknown) => {
    const existing = fieldMap.get(def.uid)
    const baseType = parsedType.baseType === 'Enum' && parsedType.enumName
      ? `Enum.${parsedType.enumName}`
      : parsedType.baseType
    const nextField: FieldInstance = existing
      ? { ...existing, __value: nextValue }
      : {
          defUid: def.uid,
          __identifier: def.identifier,
          __type: parsedType.isArray ? `Array<${baseType}>` : baseType,
          __value: nextValue,
          __tile: null,
          realEditorValues: [],
        }

    const updatedFields = existing
      ? fields.map((field) => (field.defUid === def.uid ? nextField : field))
      : [...fields, nextField]

    onChange(updatedFields)
  }

  const handleArrayItemChange = (
    def: FieldDef,
    parsedType: ParsedFieldType,
    index: number,
    nextValue: unknown
  ) => {
    const currentField = fieldMap.get(def.uid)
    const currentValues = Array.isArray(currentField?.__value) ? [...currentField.__value] : []
    currentValues[index] = nextValue
    handleFieldChange(def, parsedType, currentValues)
  }

  const handleAddArrayItem = (def: FieldDef, parsedType: ParsedFieldType) => {
    const currentField = fieldMap.get(def.uid)
    const currentValues = Array.isArray(currentField?.__value)
      ? [...currentField.__value]
      : getArrayDefaultValue(def, parsedType)
    const nextIndex = currentValues.length
    const arrayDefault = Array.isArray(def.defaultOverride) ? def.defaultOverride[nextIndex] : undefined
    const nextValue =
      arrayDefault !== undefined ? arrayDefault : getScalarDefaultValue(def, parsedType)
    currentValues.push(nextValue)
    handleFieldChange(def, parsedType, currentValues)
  }

  const handleRemoveArrayItem = (
    def: FieldDef,
    parsedType: ParsedFieldType,
    index: number
  ) => {
    const currentField = fieldMap.get(def.uid)
    const currentValues = Array.isArray(currentField?.__value) ? [...currentField.__value] : []
    currentValues.splice(index, 1)
    handleFieldChange(def, parsedType, currentValues)
  }

  const renderJsonInput = (
    def: FieldDef,
    parsedType: ParsedFieldType,
    value: unknown,
    onValueChange: (nextValue: unknown) => void,
    key: string
  ) => {
    const buffer = jsonBuffers[key] ?? serializeJsonValue(value)
    const error = jsonErrors[key]
    return (
      <div className="space-y-2">
        <Textarea
          value={buffer}
          onChange={(event) => {
            const nextBuffer = event.target.value
            setJsonBuffers((current) => ({ ...current, [key]: nextBuffer }))
          }}
          onBlur={() => {
            const currentBuffer = jsonBuffers[key] ?? serializeJsonValue(value)
            const raw = currentBuffer.trim()
            if (!raw) {
              if (def.canBeNull) {
                onValueChange(null)
                setJsonErrors((current) => {
                  const { [key]: _, ...rest } = current
                  return rest
                })
                return
              }
              setJsonErrors((current) => ({ ...current, [key]: 'Value required.' }))
              return
            }
            try {
              const parsed = JSON.parse(raw)
              onValueChange(parsed)
              setJsonErrors((current) => {
                const { [key]: _, ...rest } = current
                return rest
              })
            } catch (parseError) {
              const message =
                parseError instanceof Error ? parseError.message : 'Invalid JSON value.'
              setJsonErrors((current) => ({ ...current, [key]: message }))
            }
          }}
          className="min-h-[120px] text-sm font-mono"
        />
        {parsedType.baseType === 'Tile' && (
          <p className="text-[10px] text-muted-foreground">
            Provide a JSON tile payload matching the LDtk tile rect structure.
          </p>
        )}
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
    )
  }

  const renderScalarInput = (
    def: FieldDef,
    field: FieldInstance | undefined,
    parsedType: ParsedFieldType,
    value: unknown,
    onValueChange: (nextValue: unknown) => void,
    key: string
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
      case 'Multilines':
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
            min={def.min ?? undefined}
            max={def.max ?? undefined}
            onChange={(event) => {
              if (event.target.value === '') {
                if (def.canBeNull) {
                  onValueChange(null)
                }
                return
              }
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
        const defaultOverride =
          typeof def.defaultOverride === 'string' ? def.defaultOverride : null
        if (defaultOverride) {
          enumOptions.unshift(defaultOverride)
        }
        const currentValue = typeof value === 'string' ? value : ''
        if (currentValue && !enumOptions.includes(currentValue)) {
          enumOptions.unshift(currentValue)
        }

        return (
          <Select value={currentValue} onValueChange={(nextValue) => onValueChange(nextValue)}>
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
      case 'Path':
        return (
          <div className="space-y-2">
            <Input
              type="file"
              accept={def.acceptFileTypes?.join(',') ?? undefined}
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
      case 'Tile':
      case 'EntityRef':
        return renderJsonInput(def, parsedType, value, onValueChange, key)
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

  const getValidationErrors = (
    def: FieldDef,
    parsedType: ParsedFieldType,
    value: unknown
  ): string[] => {
    const errors: string[] = []
    const regexResult = safeRegex(def.regex)

    if (regexResult.error) {
      errors.push(`Invalid regex: ${regexResult.error}`)
    }

    if (parsedType.isArray) {
      const values = Array.isArray(value) ? value : []
      if (!Array.isArray(value) && value !== null && value !== undefined) {
        errors.push('Expected array values.')
      }
      if (def.arrayMinLength !== null && values.length < def.arrayMinLength) {
        errors.push(`Add at least ${def.arrayMinLength} item(s).`)
      }
      if (def.arrayMaxLength !== null && values.length > def.arrayMaxLength) {
        errors.push(`Remove items to stay under ${def.arrayMaxLength}.`)
      }
      return errors
    }

    if ((value === null || value === undefined) && !def.canBeNull) {
      errors.push('Value required.')
      return errors
    }

    if (value === null || value === undefined) {
      return errors
    }

    switch (parsedType.baseType) {
      case 'Int':
      case 'Float': {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push('Must be a number.')
          break
        }
        if (def.min !== null && value < def.min) {
          errors.push(`Must be >= ${def.min}.`)
        }
        if (def.max !== null && value > def.max) {
          errors.push(`Must be <= ${def.max}.`)
        }
        break
      }
      case 'String':
      case 'Text':
      case 'Multilines':
      case 'FilePath':
      case 'Path':
        if (typeof value !== 'string') {
          errors.push('Must be a string.')
          break
        }
        if (regexResult.regex && !regexResult.regex.test(value)) {
          errors.push('Does not match required pattern.')
        }
        break
      case 'Color':
        if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
          errors.push('Must be a valid hex color.')
        }
        break
      default:
        break
    }

    return errors
  }

  if (fieldDefs.length === 0) {
    return <div className="text-xs text-muted-foreground">No custom fields</div>
  }

  return (
    <div className="space-y-4">
      {fieldDefs.map((def) => {
        const field = fieldMap.get(def.uid)
        const parsedType = resolveFieldType(def, field)
        const effectiveValue =
          field?.__value ??
          (parsedType.isArray ? getArrayDefaultValue(def, parsedType) : def.defaultOverride)
        const valuesToRender =
          parsedType.isArray && Array.isArray(effectiveValue) ? effectiveValue : null
        const errors = getValidationErrors(def, parsedType, effectiveValue)
        const hasDefault = def.defaultOverride !== undefined
        const usingDefault = field?.__value === null || field?.__value === undefined

        return (
          <div key={def.uid} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs" title={def.doc ?? undefined}>
                {def.identifier}
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {parsedType.isArray ? `Array<${parsedType.baseType}>` : parsedType.baseType}
              </span>
            </div>
            {def.doc && <p className="text-[10px] text-muted-foreground">{def.doc}</p>}
            {hasDefault && (
              <p className="text-[10px] text-muted-foreground">
                Default: {formatDefaultValue(def.defaultOverride)}
                {usingDefault ? ' (in use)' : ''}
              </p>
            )}
            {valuesToRender ? (
              <div className="space-y-2">
                {valuesToRender.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No values</div>
                ) : (
                  valuesToRender.map((entry, index) => {
                    const jsonKey = `${def.uid}-${index}`
                    const itemErrors = getValidationErrors(
                      { ...def, isArray: false },
                      { ...parsedType, isArray: false },
                      entry
                    )
                    const minLength = def.arrayMinLength ?? 0
                    const disableRemove = valuesToRender.length <= minLength
                    return (
                      <div key={jsonKey} className="rounded-md border border-input p-2 space-y-2">
                        {renderScalarInput(def, field, parsedType, entry, (next) =>
                          handleArrayItemChange(def, parsedType, index, next),
                          jsonKey
                        )}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveArrayItem(def, parsedType, index)}
                            disabled={disableRemove}
                          >
                            Remove
                          </Button>
                        </div>
                        {itemErrors.length > 0 && (
                          <p className="text-[10px] text-red-400">{itemErrors[0]}</p>
                        )}
                      </div>
                    )
                  })
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddArrayItem(def, parsedType)}
                  disabled={
                    def.arrayMaxLength !== null &&
                    valuesToRender.length >= def.arrayMaxLength
                  }
                >
                  Add value
                </Button>
              </div>
            ) : (
              renderScalarInput(def, field, parsedType, effectiveValue, (next) =>
                handleFieldChange(def, parsedType, next),
                `${def.uid}-scalar`
              )
            )}
            {errors.length > 0 && <p className="text-[10px] text-red-400">{errors[0]}</p>}
          </div>
        )
      })}
    </div>
  )
}
