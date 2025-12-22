/**
 * PWA Icon Generator
 *
 * Generates simple placeholder icons for the PWA.
 * For production, replace these with properly designed icons.
 *
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Simple SVG icon template - Soccer ball style
function createSvgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#bg)"/>
  <!-- Soccer ball circle -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.35}" fill="white" stroke="#00e676" stroke-width="${size * 0.02}"/>
  <!-- Pentagon pattern (simplified) -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.12}" fill="#1a1a2e"/>
  <!-- Accent lines -->
  <line x1="${size * 0.5}" y1="${size * 0.15}" x2="${size * 0.5}" y2="${size * 0.27}" stroke="#1a1a2e" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${size * 0.5}" y1="${size * 0.73}" x2="${size * 0.5}" y2="${size * 0.85}" stroke="#1a1a2e" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${size * 0.15}" y1="${size * 0.5}" x2="${size * 0.27}" y2="${size * 0.5}" stroke="#1a1a2e" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <line x1="${size * 0.73}" y1="${size * 0.5}" x2="${size * 0.85}" y2="${size * 0.5}" stroke="#1a1a2e" stroke-width="${size * 0.03}" stroke-linecap="round"/>
  <!-- Green accent -->
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.05}" fill="#00e676"/>
</svg>`;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons
const sizes = [192, 512];
sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = path.join(iconsDir, `icon-${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created: ${filename}`);
});

// Create favicon.ico placeholder (SVG)
const faviconSvg = createSvgIcon(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), faviconSvg);
console.log('Created: public/favicon.svg');

// Create apple-touch-icon
const appleTouchIcon = createSvgIcon(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleTouchIcon);
console.log('Created: public/icons/apple-touch-icon.svg');

console.log('\n✅ Icons generated successfully!');
console.log('\n⚠️  Note: These are SVG placeholders.');
console.log('   For production, convert to PNG using:');
console.log('   - https://realfavicongenerator.net/');
console.log('   - Or: npx svg-to-png public/icons/*.svg');
