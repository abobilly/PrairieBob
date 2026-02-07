/**
 * Generate app icons from SPUDTILE_LOGO_NEW-spud.png (640x640 new logo)
 */
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../legacy/SPUDTILE_LOGO_NEW-spud.png');
const iconsDir = path.join(__dirname, '../public/icons');

async function main() {
  try {
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }

    // Get original dimensions
    const metadata = await sharp(inputPath).metadata();
    console.log('Original:', metadata.width, 'x', metadata.height);
    
    // Create 256x256 version for ico (required by png-to-ico)
    const png256 = path.join(iconsDir, 'spudtile-256.png');
    await sharp(inputPath).resize(256, 256).png().toFile(png256);
    console.log('Created 256x256 PNG');
    
    // Create 32x32 for favicon
    await sharp(inputPath).resize(32, 32).png().toFile(path.join(iconsDir, 'spudtile-32.png'));
    console.log('Created 32x32 PNG');
    
    // Create 16x16 for favicon
    await sharp(inputPath).resize(16, 16).png().toFile(path.join(iconsDir, 'spudtile-16.png'));
    console.log('Created 16x16 PNG');
    
    // Copy original as the main icon
    fs.copyFileSync(inputPath, path.join(iconsDir, 'spudtile-icon.png'));
    console.log('Copied original PNG');
    
    // Create ico from 256x256
    const icoBuf = await pngToIco(png256);
    fs.writeFileSync(path.join(iconsDir, 'spudtile.ico'), icoBuf);
    console.log('Created ICO:', path.join(iconsDir, 'spudtile.ico'));
    
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
