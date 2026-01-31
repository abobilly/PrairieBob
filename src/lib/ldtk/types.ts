/**
 * LDtk Core Types - Ported from LDtk Haxe source
 * 
 * This is the foundation data model that matches LDtk's JSON schema.
 * We port the structure but use TypeScript idioms.
 */

// ============== Enums ==============

export type LayerType = 'IntGrid' | 'Entities' | 'Tiles' | 'AutoLayer'

export type WorldLayout = 'Free' | 'GridVania' | 'LinearHorizontal' | 'LinearVertical'

export type IdentifierStyle = 'Capitalize' | 'Uppercase' | 'Lowercase' | 'Free'

export type AutoLayerRuleTileMode = 'Single' | 'Stamp'

export type AutoLayerRuleCheckerMode = 'None' | 'Horizontal' | 'Vertical'

export type ImageExportMode = 'None' | 'OneImagePerLayer' | 'OneImagePerLevel' | 'LayersAndLevels'

export type FieldType =
    | 'Int'
    | 'Float'
    | 'Bool'
    | 'String'
    | 'Text'
    | 'Color'
    | 'Point'
    | 'Enum'
    | 'FilePath'
    | 'Tile'
    | 'EntityRef'
    | 'Array'

// ============== Tile Rectangle ==============

export interface TileRect {
    tilesetUid: number
    x: number
    y: number
    w: number
    h: number
}

// ============== IntGrid ==============

export interface IntGridValueDef {
    value: number
    identifier: string | null
    color: number  // hex int
    tile: TileRect | null
    groupUid: number
}

export interface IntGridValueGroupDef {
    uid: number
    identifier: string | null
    color: number | null
}

// ============== Auto-Layer Rules ==============

export interface AutoLayerRuleDef {
    uid: number
    active: boolean
    size: number  // Pattern size (3, 5, 7)
    pattern: number[]  // NxN grid of matchers
    tileRectsIds: number[][]  // Tiles to place when matched
    alpha: number
    chance: number  // 0-1 probability
    breakOnMatch: boolean
    flipX: boolean
    flipY: boolean
    xModulo: number
    yModulo: number
    xOffset: number
    yOffset: number
    tileXOffset: number
    tileYOffset: number
    tileRandomXMin: number
    tileRandomXMax: number
    tileRandomYMin: number
    tileRandomYMax: number
    checker: AutoLayerRuleCheckerMode
    tileMode: AutoLayerRuleTileMode
    pivotX: number
    pivotY: number
    outOfBoundsValue: number | null
    perlinActive: boolean
    perlinSeed: number
    perlinScale: number
    perlinOctaves: number
    invalidated: boolean
}

export interface AutoLayerRuleGroupDef {
    uid: number
    name: string
    color: number | null
    icon: TileRect | null
    active: boolean
    collapsed: boolean
    isOptional: boolean
    usesWizard: boolean
    requiredBiomeValues: string[]
    biomeRequirementMode: 'And' | 'Or'
    rules: AutoLayerRuleDef[]
}

// ============== Field Definitions ==============

export interface FieldDef {
    uid: number
    identifier: string
    type: FieldType
    isArray: boolean
    canBeNull: boolean
    arrayMinLength: number | null
    arrayMaxLength: number | null
    editorDisplayMode: string
    editorDisplayPos: string
    editorDisplayScale: number
    editorAlwaysShow: boolean
    editorCutLongValues: boolean
    editorTextPrefix: string | null
    editorTextSuffix: string | null
    defaultOverride: unknown
    min: number | null
    max: number | null
    regex: string | null
    acceptFileTypes: string[] | null
    allowedRefs: string
    allowedRefsEntityUid: number | null
    allowedRefTags: string[]
    tilesetUid: number | null
    enumDefUid: number | null
    symmetricalRef: boolean
    autoChainRef: boolean
    allowOutOfLevelRef: boolean
    textLanguageMode: string | null
    doc: string | null
    useForSmartColor: boolean
}

// ============== Entity Definition ==============

export interface EntityDef {
    uid: number
    identifier: string
    tags: string[]
    exportToToc: boolean
    allowOutOfBounds: boolean
    doc: string | null
    width: number
    height: number
    resizableX: boolean
    resizableY: boolean
    minWidth: number | null
    minHeight: number | null
    maxWidth: number | null
    maxHeight: number | null
    keepAspectRatio: boolean
    tileOpacity: number
    fillOpacity: number
    lineOpacity: number
    hollow: boolean
    color: number
    tilesetId: number | null
    tileId: number | null
    tileRenderMode: string
    tileRect: TileRect | null
    nineSliceBorders: number[]
    maxCount: number
    limitScope: string
    limitBehavior: string
    pivotX: number
    pivotY: number
    fieldDefs: FieldDef[]
    renderMode: string
}

// ============== Tileset Definition ==============

export interface TilesetDef {
    uid: number
    identifier: string
    relPath: string | null
    embedAtlas: string | null
    pxWid: number
    pxHei: number
    tileGridSize: number
    spacing: number
    padding: number
    tags: string[]
    tagsSourceEnumUid: number | null
    enumTags: Array<{ enumValueId: string; tileIds: number[] }>
    customData: Array<{ tileId: number; data: string }>
    savedSelections: Array<{ ids: number[]; mode: string }>
    // Computed
    cWid: number
    cHei: number
}

// ============== Layer Definition ==============

export interface LayerDef {
    uid: number
    identifier: string
    type: LayerType
    doc: string | null
    uiColor: string | null
    gridSize: number
    guideGridWid: number
    guideGridHei: number
    displayOpacity: number
    inactiveOpacity: number
    hideInList: boolean
    hideFieldsWhenInactive: boolean
    canSelectWhenInactive: boolean
    renderInWorldView: boolean
    pxOffsetX: number
    pxOffsetY: number
    parallaxFactorX: number
    parallaxFactorY: number
    parallaxScaling: boolean
    tilesetDefUid: number | null
    biomeFieldUid: number | null
    autoSourceLayerDefUid: number | null
    autoTilesKilledByOtherLayerUid: number | null
    intGridValues: IntGridValueDef[]
    intGridValuesGroups: IntGridValueGroupDef[]
    autoRuleGroups: AutoLayerRuleGroupDef[]
    tilePivotX: number
    tilePivotY: number
    requiredTags: string[]
    excludedTags: string[]
    uiFilterTags: string[]
    useAsyncRender: boolean
}

// ============== Enum Definition ==============

export interface EnumValueDef {
    id: string
    tileRect: TileRect | null
    color: number
}

export interface EnumDef {
    uid: number
    identifier: string
    values: EnumValueDef[]
    iconTilesetUid: number | null
    externalRelPath: string | null
    externalFileChecksum: string | null
    tags: string[]
}

// ============== Definitions Container ==============

export interface Definitions {
    layers: LayerDef[]
    entities: EntityDef[]
    tilesets: TilesetDef[]
    enums: EnumDef[]
    externalEnums: EnumDef[]
    levelFields: FieldDef[]
}
