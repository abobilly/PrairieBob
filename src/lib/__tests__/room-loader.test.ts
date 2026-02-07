/**
 * Phase 6.3 — TMX/Kimbar load path and fallback tests
 *
 * Unit tests for loadRoomDataFromContent() in room-loader.ts.
 * Verifies TMX, Tiled JSON, SpudTile JSON, and LDtk parsing,
 * as well as graceful fallback on invalid input.
 */

import { describe, it, expect } from 'vitest'
import { loadRoomDataFromContent } from '../room-loader'

// ---------------------------------------------------------------------------
// TMX format
// ---------------------------------------------------------------------------

describe('loadRoomDataFromContent — TMX format', () => {
  it('parses a minimal TMX map with CSV data', async () => {
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" width="3" height="2" tilewidth="16" tileheight="16">
  <tileset firstgid="1" name="test" tilewidth="16" tileheight="16">
    <image source="tiles.png" width="64" height="64"/>
  </tileset>
  <layer name="Ground" width="3" height="2">
    <data encoding="csv">
1,2,3,
4,5,6
    </data>
  </layer>
</map>`

    const result = await loadRoomDataFromContent('test.tmx', tmx)
    expect(result.sourceFormat).toBe('tmx')
    expect(result.data.width).toBe(3)
    expect(result.data.height).toBe(2)
    expect(result.data.tileSize).toBe(16)
    expect(result.data.layers).toHaveLength(1)
    expect(result.data.layers[0].type).toBe('tilelayer')
    expect(result.data.layers[0].data).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.tilesets).toHaveLength(1)
    expect(result.tilesets[0].name).toBe('test')
  })

  it('parses TMX object groups as entities', async () => {
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" width="4" height="4" tilewidth="16" tileheight="16">
  <objectgroup name="Entities">
    <object id="1" name="door" type="door" x="32" y="48" width="16" height="16"/>
    <object id="2" name="npc" type="npc" x="64" y="64" width="16" height="16">
      <properties>
        <property name="speed" type="float" value="1.5"/>
      </properties>
    </object>
  </objectgroup>
</map>`

    const result = await loadRoomDataFromContent('entities.tmx', tmx)
    expect(result.sourceFormat).toBe('tmx')
    const entityLayer = result.data.layers.find((l) => l.type === 'objectgroup')
    expect(entityLayer).toBeDefined()
    expect(entityLayer!.objects).toHaveLength(2)
    expect(entityLayer!.objects![0].type).toBe('door')
    expect(entityLayer!.objects![1].type).toBe('npc')
  })

  it('parses TMX with explicit xml encoding and tile elements', async () => {
    // When encoding is set to something other than "csv", the parser
    // falls through to the <tile gid="N"/> element path.
    const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map width="2" height="1" tilewidth="16" tileheight="16">
  <layer name="L1" width="2" height="1">
    <data encoding="xml">
      <tile gid="5"/>
      <tile gid="10"/>
    </data>
  </layer>
</map>`

    const result = await loadRoomDataFromContent('tile-elements.tmx', tmx)
    expect(result.data.layers[0].data).toEqual([5, 10])
  })
})

// ---------------------------------------------------------------------------
// Tiled JSON format
// ---------------------------------------------------------------------------

describe('loadRoomDataFromContent — Tiled JSON format', () => {
  it('parses a minimal Tiled JSON map', async () => {
    const json = JSON.stringify({
      width: 2,
      height: 2,
      tilewidth: 16,
      tileheight: 16,
      tilesets: [
        { firstgid: 1, image: 'tiles.png', imagewidth: 64, imageheight: 64, name: 'test-ts' },
      ],
      layers: [
        { name: 'Ground', type: 'tilelayer', data: [1, 0, 0, 2], visible: true, opacity: 1 },
      ],
    })

    const result = await loadRoomDataFromContent('map.json', json)
    expect(result.sourceFormat).toBe('tiled-json')
    expect(result.data.width).toBe(2)
    expect(result.data.height).toBe(2)
    expect(result.data.layers[0].data).toEqual([1, 0, 0, 2])
    expect(result.tilesets).toHaveLength(1)
    expect(result.tilesets[0].name).toBe('test-ts')
  })

  it('parses Tiled JSON with object layers', async () => {
    const json = JSON.stringify({
      width: 4,
      height: 4,
      tilewidth: 16,
      layers: [
        {
          name: 'Objects',
          type: 'objectgroup',
          objects: [
            { id: '1', type: 'spawn_point', x: 0, y: 0, width: 16, height: 16 },
          ],
          visible: true,
        },
      ],
    })

    const result = await loadRoomDataFromContent('obj.json', json)
    expect(result.sourceFormat).toBe('tiled-json')
    const layer = result.data.layers[0]
    expect(layer.type).toBe('objectgroup')
    expect(layer.objects![0].type).toBe('spawn_point')
  })
})

// ---------------------------------------------------------------------------
// SpudTile JSON format
// ---------------------------------------------------------------------------

describe('loadRoomDataFromContent — SpudTile JSON format', () => {
  it('parses a valid SpudTile JSON level', async () => {
    const json = JSON.stringify({
      id: 'room_1',
      width: 3,
      height: 3,
      tileSize: 16,
      layers: [
        { name: 'Floor', type: 'tilelayer', data: [1, 2, 3, 4, 5, 6, 7, 8, 9], visible: true, opacity: 1 },
      ],
    })

    const result = await loadRoomDataFromContent('room.json', json)
    expect(result.sourceFormat).toBe('spudtile-json')
    expect(result.data.id).toBe('room_1')
    expect(result.data.layers[0].data).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(result.tilesets).toEqual([])
  })

  it('normalizes SpudTile JSON with missing optional fields', async () => {
    const json = JSON.stringify({
      width: 2,
      height: 2,
      tileSize: 16,
      layers: [
        { name: 'L1', type: 'tilelayer', data: [1, 2], visible: true },
      ],
    })

    const result = await loadRoomDataFromContent('room2.json', json)
    expect(result.sourceFormat).toBe('spudtile-json')
    // Data should be padded to width*height
    expect(result.data.layers[0].data).toHaveLength(4)
    expect(result.data.layers[0].data).toEqual([1, 2, 0, 0])
  })
})

// ---------------------------------------------------------------------------
// Error / fallback cases
// ---------------------------------------------------------------------------

describe('loadRoomDataFromContent — error handling', () => {
  it('throws on completely invalid content (not JSON or XML)', async () => {
    await expect(
      loadRoomDataFromContent('bad.txt', 'this is not valid content at all')
    ).rejects.toThrow(/Unsupported room format/)
  })

  it('throws on valid JSON but unrecognized structure', async () => {
    await expect(
      loadRoomDataFromContent('unknown.json', JSON.stringify({ foo: 'bar' }))
    ).rejects.toThrow(/Unrecognized map JSON format/)
  })

  it('throws on TSX file extension (tileset, not map)', async () => {
    await expect(
      loadRoomDataFromContent('tiles.tsx', '<tileset name="test"/>')
    ).rejects.toThrow(/TSX is a tileset definition/)
  })

  it('throws on TMX missing <map> root', async () => {
    const badTmx = '<?xml version="1.0"?><root/>'
    await expect(
      loadRoomDataFromContent('bad.tmx', badTmx)
    ).rejects.toThrow(/missing <map> root/)
  })

  it('throws on empty string', async () => {
    await expect(
      loadRoomDataFromContent('empty.json', '')
    ).rejects.toThrow()
  })

  it('handles JSON with wrong structure gracefully', async () => {
    // Array at top level — not a valid map structure
    await expect(
      loadRoomDataFromContent('array.json', JSON.stringify([1, 2, 3]))
    ).rejects.toThrow(/Unrecognized map JSON format/)
  })
})

// ---------------------------------------------------------------------------
// LDtk format
// ---------------------------------------------------------------------------

describe('loadRoomDataFromContent — LDtk format', () => {
  it('parses a minimal LDtk project JSON', async () => {
    const ldtk = JSON.stringify({
      jsonVersion: '1.5.3',
      defs: {
        tilesets: [
          {
            uid: 1,
            identifier: 'Terrain',
            relPath: 'terrain.png',
            tileGridSize: 16,
            cWid: 4,
            cHei: 4,
          },
        ],
      },
      levels: [
        {
          identifier: 'Level_0',
          pxWid: 64,
          pxHei: 64,
          layerInstances: [
            {
              __identifier: 'Tiles',
              __type: 'Tiles',
              __gridSize: 16,
              __tilesetDefUid: 1,
              visible: true,
              __opacity: 1,
              intGridCsv: [],
              gridTiles: [
                { px: [0, 0], t: 0 },
                { px: [16, 0], t: 1 },
              ],
              autoLayerTiles: [],
            },
          ],
        },
      ],
    })

    const result = await loadRoomDataFromContent('project.ldtk', ldtk)
    expect(result.sourceFormat).toBe('ldtk')
    expect(result.data.width).toBe(4)
    expect(result.data.height).toBe(4)
    expect(result.tilesets).toHaveLength(1)
    expect(result.tilesets[0].name).toBe('Terrain')
    // First tile at (0,0) should have firstGid + localTileId
    expect(result.data.layers[0].data![0]).toBe(1) // firstGid=1, t=0 → 1+0=1
    expect(result.data.layers[0].data![1]).toBe(2) // firstGid=1, t=1 → 1+1=2
  })

  it('throws on LDtk project with no levels', async () => {
    const ldtk = JSON.stringify({
      jsonVersion: '1.5.3',
      defs: { tilesets: [] },
      levels: [],
    })

    await expect(
      loadRoomDataFromContent('empty.ldtk', ldtk)
    ).rejects.toThrow(/does not contain any levels/)
  })
})
