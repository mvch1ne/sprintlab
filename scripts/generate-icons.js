'use strict';
// Renders the SprintLab SVG logo to a 1024×1024 PNG for use by electron-icon-builder.
// Run via: npm run electron:icons

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../frontend/public/logo.svg');
const outDir = path.join(__dirname, '../build');
const out = path.join(outDir, 'icon.png');

fs.mkdirSync(outDir, { recursive: true });

sharp(src)
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(out)
  .then(() => console.log(`✅ Generated ${out}`))
  .catch((err) => { console.error('Icon generation failed:', err); process.exit(1); });
