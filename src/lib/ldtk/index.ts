/**
 * LDtk Module - Main export
 * 
 * This is the ported LDtk data model for PrairieBob.
 * It provides LDtk-compatible types and can read/write LDtk project files.
 */

// Core types
export * from './types'

// Data structures
export * from './project'
export * from './world'
export * from './level'
export * from './layer-instance'
export * from './camera'

// Auto-layer rules (THE killer feature)
export * from './auto-layer-rule'

// JSON I/O
export * from './json-io'

// Tools
export * from './tools/tool'
export * from './tools/pan-tool'
export * from './tools/pick-tool'
export * from './tools/registry'

// Tools
export * from './tools/tool'
export * from './tools/registry'
