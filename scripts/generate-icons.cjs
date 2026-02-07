/**
 * Generate app icons from legacy/SpudTile_icon/ PNGs (multi-size icon set).
 * Produces spudtile.ico (16/24/32/48/64/256) plus fallback PNGs in public/icons/.
 */
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../legacy/SpudTile_icon');
const iconsDir = path.join(__dirname, '../public/icons');

async function main() {
  try {
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Source PNGs at native sizes
    const sizes = [
      { file: 'icon_16.png',  size: 16 },
      { file: 'icon_24.png',  size: 24 },
      { file: 'icon_32.png',  size: 32 },
      { file: 'icon_64.png',  size: 64 },
      { file: 'icon_256.png', size: 256 },
    ];

    // Verify sources exist
    for (const s of sizes) {
      const p = path.join(srcDir, s.file);
      if (!fs.existsSync(p)) throw new Error('Missing source: ' + p);
    }

    // Create a 48px variant from 64px
    const tmp48 = path.join(iconsDir, '_tmp_48.png');
    await sharp(path.join(srcDir, 'icon_64.png')).resize(48, 48).png().toFile(tmp48);
    console.log('Created 48x48 from 64px source');

    // Collect PNGs for ico (order: small → large)
    const icoPngs = [
      path.join(srcDir, 'icon_16.png'),
      path.join(srcDir, 'icon_24.png'),
      path.join(srcDir, 'icon_32.png'),
      tmp48,
      path.join(srcDir, 'icon_64.png'),
      path.join(srcDir, 'icon_256.png'),
    ];

    // Build multi-size ICO
    const icoBuf = await pngToIco(icoPngs);
    fs.writeFileSync(path.join(iconsDir, 'spudtile.ico'), icoBuf);
    console.log('Created ICO:', path.join(iconsDir, 'spudtile.ico'), '(' + icoBuf.length + ' bytes)');

    // Clean up temp
    fs.unlinkSync(tmp48);

    // Copy fallback PNGs
    fs.copyFileSync(path.join(srcDir, 'icon_256.png'), path.join(iconsDir, 'spudtile-256.png'));
    fs.copyFileSync(path.join(srcDir, 'icon_256.png'), path.join(iconsDir, 'spudtile-icon.png'));
    fs.copyFileSync(path.join(srcDir, 'icon_32.png'),  path.join(iconsDir, 'spudtile-32.png'));
    fs.copyFileSync(path.join(srcDir, 'icon_16.png'),  path.join(iconsDir, 'spudtile-16.png'));
    console.log('Copied fallback PNGs');

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
