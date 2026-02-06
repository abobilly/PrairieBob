import assert from 'node:assert/strict'
import {
  deriveCollisionFromLinkedLayers,
  mergeCollisionMaps,
  resolveCollisionSourcesFromMetadata,
} from '../src/lib/collision-model.js'
import {
  resolveNpcWanderBounds,
  chooseNpcWanderDirection,
  isRectInsideBounds,
} from '../src/lib/npc-runtime.js'

const map = {
  id: 't',
  width: 4,
  height: 3,
  tileSize: 16,
  layers: [
    { name: 'Walls', type: 'tilelayer', visible: true, locked: false, data: [1,1,1,1, 1,0,0,1, 1,1,1,1] },
    { name: 'Furniture', type: 'tilelayer', visible: true, locked: false, data: [0,0,0,0, 0,2,0,0, 0,0,0,0] },
    { name: 'Collision', type: 'tilelayer', visible: true, locked: false, data: [0,0,0,0, 0,0,3,0, 0,0,0,0] },
  ],
  metadata: {
    editedAt: new Date().toISOString(),
    exportedFrom: 'test',
    version: '1.0.0',
    collision: { linkedLayerNames: ['Walls', 'Furniture'], showDerivedOverlay: true },
  },
}

const cfg = resolveCollisionSourcesFromMetadata(map)
assert.deepEqual(cfg.linkedLayerNames, ['Walls', 'Furniture'])

const derived = deriveCollisionFromLinkedLayers(map, cfg)
assert.equal(derived[0], 1)
assert.equal(derived[5], 1)

const merged = mergeCollisionMaps(map.layers[2].data, derived)
assert.equal(merged[6], 1)
assert.equal(merged[5], 1)

const zones = new Map([
  ['kitchen', { id: 'kitchen', x: 32, y: 32, width: 64, height: 64 }],
])

const bounds = resolveNpcWanderBounds({
  x: 48,
  y: 48,
  width: 16,
  height: 16,
  homeX: 48,
  homeY: 48,
  zoneId: 'kitchen',
  zoneDeviationTiles: 1,
}, zones, 16)

assert.equal(bounds.x, 16)
assert.equal(bounds.y, 16)
assert.equal(bounds.width, 96)
assert.equal(bounds.height, 96)

assert.equal(isRectInsideBounds(40, 40, 16, 16, bounds), true)
assert.equal(isRectInsideBounds(0, 0, 16, 16, bounds), false)

const dir = chooseNpcWanderDirection({
  x: 80,
  y: 48,
  width: 16,
  height: 16,
  currentDirX: 1,
  currentDirY: 0,
  speedTilesPerSecond: 2,
}, bounds, 16, () => 0.99)

assert.equal(dir.x <= 0, true)

console.log('behavior checks passed')
