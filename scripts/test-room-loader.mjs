import assert from 'node:assert/strict';

import { loadRoomDataFromContent } from '../src/lib/room-loader.ts';

async function testSpudTileJson() {
  const content = JSON.stringify({
    id: 'room_a',
    width: 4,
    height: 3,
    tileSize: 16,
    layers: [
      { name: 'Floor', type: 'tilelayer', visible: true, locked: false, data: new Array(12).fill(0) },
      { name: 'Entities', type: 'objectgroup', visible: true, locked: false, objects: [] },
    ],
    metadata: { editedAt: new Date().toISOString(), exportedFrom: 'spudtile', version: '1.0.0' },
  });

  const result = await loadRoomDataFromContent('room_a.json', content);
  assert.equal(result.data.width, 4);
  assert.equal(result.data.layers.length, 2);
}

async function testLdtkJson() {
  const content = JSON.stringify({
    jsonVersion: '1.5.3',
    defs: {
      tilesets: [
        {
          uid: 1,
          identifier: 'Terrain',
          relPath: 'tilesets/terrain.png',
          tileGridSize: 16,
          cWid: 4,
          cHei: 4,
        },
      ],
    },
    worlds: [
      {
        identifier: 'World',
        levels: [
          {
            identifier: 'Level_0',
            iid: 'level-iid',
            pxWid: 64,
            pxHei: 64,
            layerInstances: [
              {
                __identifier: 'Floor',
                __type: 'Tiles',
                __tilesetDefUid: 1,
                __gridSize: 16,
                __opacity: 1,
                visible: true,
                __cWid: 4,
                __cHei: 4,
                gridTiles: [{ px: [0, 0], t: 1 }],
                autoLayerTiles: [],
                intGridCsv: [],
                entityInstances: [],
              },
            ],
          },
        ],
      },
    ],
  });

  const result = await loadRoomDataFromContent('project.ldtk', content);
  assert.equal(result.data.id, 'Level_0');
  assert.equal(result.data.width, 4);
  assert.equal(result.data.layers[0].data?.[0], 2);
  assert.equal(result.tilesets.length, 1);
  assert.equal(result.tilesets[0].firstGid, 1);
}

async function testTmx() {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<map width="3" height="2" tilewidth="16" tileheight="16">
  <tileset firstgid="1" name="Terrain" tilewidth="16" tileheight="16" tilecount="16" columns="4">
    <image source="tilesets/terrain.png" width="64" height="64" />
  </tileset>
  <layer name="Floor" width="3" height="2">
    <data encoding="csv">1,2,3,4,5,6</data>
  </layer>
  <objectgroup name="Entities">
    <object id="1" name="Spawn" type="spawn_point" x="16" y="32" width="16" height="16" />
  </objectgroup>
</map>`;

  const result = await loadRoomDataFromContent('room.tmx', content);
  assert.equal(result.data.width, 3);
  assert.equal(result.data.layers.length, 2);
  assert.equal(result.data.layers[0].data?.[5], 6);
  assert.equal(result.data.layers[1].objects?.[0]?.type, 'spawn_point');
  assert.equal(result.tilesets.length, 1);
  assert.ok(result.tilesets[0].sourcePath.toLowerCase().includes('tilesets/terrain.png'));
}

async function testTmxExternalTsx() {
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<map width="2" height="2" tilewidth="16" tileheight="16">
  <tileset firstgid="1" source="tilesets/terrain.tsx"/>
  <layer name="Floor" width="2" height="2">
    <data encoding="csv">1,2,3,4</data>
  </layer>
</map>`;

  const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="Terrain" tilewidth="16" tileheight="16" tilecount="16" columns="4">
  <image source="terrain.png" width="64" height="64"/>
</tileset>`;

  const result = await loadRoomDataFromContent('maps/room.tmx', content, async (requestPath) => {
    if (requestPath.toLowerCase().endsWith('terrain.tsx')) {
      return tsx;
    }
    throw new Error(`Unexpected read path: ${requestPath}`);
  });

  assert.equal(result.tilesets.length, 1);
  assert.ok(result.tilesets[0].sourcePath.toLowerCase().endsWith('/maps/tilesets/terrain.png'));
}

async function testTiledJsonExternalTsx() {
  const content = JSON.stringify({
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    layers: [
      {
        name: 'Floor',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [1, 2, 3, 4],
      },
    ],
    tilesets: [
      { firstgid: 1, source: 'tilesets/main.tsx' },
    ],
  });

  const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="Main" tilewidth="16" tileheight="16" tilecount="16" columns="4">
  <image source="main.png" width="64" height="64"/>
</tileset>`;

  const result = await loadRoomDataFromContent('maps/room.json', content, async (requestPath) => {
    if (requestPath.toLowerCase().endsWith('main.tsx')) {
      return tsx;
    }
    throw new Error(`Unexpected read path: ${requestPath}`);
  });

  assert.equal(result.tilesets.length, 1);
  assert.ok(result.tilesets[0].sourcePath.toLowerCase().endsWith('/maps/tilesets/main.png'));
}

async function run() {
  await testSpudTileJson();
  await testLdtkJson();
  await testTmx();
  await testTmxExternalTsx();
  await testTiledJsonExternalTsx();
  console.log('room-loader tests: PASS');
}

run().catch((err) => {
  console.error('room-loader tests: FAIL');
  console.error(err);
  process.exitCode = 1;
});
