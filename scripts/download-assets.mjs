/**
 * The House — Asset Setup & CC0 Avatar Downloader
 *
 * Downloads CC0-licensed photorealistic rigged human avatars from open-source
 * 3D asset repositories and places them in the correct NPC directories.
 *
 * Usage:
 *   npm run assets          # download all avatars
 *   npm run assets -- --dry # preview without downloading
 *
 * Avatar sources (all CC0 / public domain):
 *   https://opensource3dassets.com — 991+ CC0 GLB models
 *   https://quaternius.com — CC0 characters by Quaternius
 *   https://sketchfab.com/3d-models/human-models-set-malefemale-rigged-7311fcfdc03e4234900eeced42a1e669
 */

import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '..', 'public', 'models');
const AVATARS_DIR = join(MODELS_DIR, 'avatars');

const HOUSEMATES = ['alex', 'jordan', 'sam'];
const LAYERS = ['body', 'dressed', 'sleepwear', 'towel', 'swimwear'];

// CC0 photorealistic rigged avatar sources per NPC
// These are direct GLB download URLs (CC0 licensed)
const AVATAR_SOURCES = {
  alex: {
    dressed: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/male-athletic.glb',
    sleepwear: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/male-athletic-sleep.glb',
  },
  jordan: {
    dressed: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/female-athletic.glb',
    sleepwear: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/female-athletic-sleep.glb',
  },
  sam: {
    dressed: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/male-casual.glb',
    sleepwear: 'https://raw.githubusercontent.com/ToxSam/open-source-3d-assets/main/models/avatars/male-casual-sleep.glb',
  },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

async function main() {
  const isDry = process.argv.includes('--dry');
  console.log('=== The House — Asset Setup ===\n');

  // Ensure directory structure
  for (const d of [MODELS_DIR, AVATARS_DIR, join(MODELS_DIR, 'house'), join(MODELS_DIR, 'textures')]) {
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true });
      console.log(`Created ${d}`);
    }
  }

  // Write .gitkeep files
  for (const d of [AVATARS_DIR, join(MODELS_DIR, 'house'), join(MODELS_DIR, 'textures')]) {
    const gk = join(d, '.gitkeep');
    if (!existsSync(gk)) {
      writeFileSync(gk, '');
      console.log(`Created ${gk}`);
    }
  }

  console.log('\n--- Avatar Directories ---');
  for (const name of HOUSEMATES) {
    const dir = join(AVATARS_DIR, name);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    for (const layer of LAYERS) {
      const f = join(dir, `${layer}.glb`);
      if (existsSync(f)) {
        const size = (await stat(f)).size;
        console.log(`  ✓ ${name}/${layer}.glb  (${(size / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        console.log(`  · ${name}/${layer}.glb  (missing — runtime procedural fallback)`);
      }
    }
  }

  // Download photorealistic CC0 avatars
  console.log('\n--- Downloading CC0 Photorealistic Avatars ---');
  console.log('Sources: opensource3dassets.com, quaternius.com, sketchfab.com (CC0/CC-BY)\n');

  if (isDry) {
    console.log('[DRY RUN] Would download:');
    for (const [name, layers] of Object.entries(AVATAR_SOURCES)) {
      for (const [layer, url] of Object.entries(layers)) {
        console.log(`  ${name}/${layer}.glb  ←  ${url}`);
      }
    }
    console.log('\nRun without --dry to download.');
    return;
  }

  for (const [name, layers] of Object.entries(AVATAR_SOURCES)) {
    const dir = join(AVATARS_DIR, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    for (const [layer, url] of Object.entries(layers)) {
      const dest = join(dir, `${layer}.glb`);
      if (existsSync(dest)) {
        console.log(`  Skipping ${name}/${layer}.glb (already exists)`);
        continue;
      }
      try {
        console.log(`  Downloading ${name}/${layer}.glb ...`);
        await download(url, dest);
        console.log(`  ✓ ${name}/${layer}.glb`);
      } catch (e) {
        console.warn(`  ✗ Failed to download ${name}/${layer}.glb: ${e.message}`);
        console.log('    Run `npm run dev` — procedural fallback will be used automatically.');
      }
    }
  }

  console.log('\n--- Runtime Notes ---');
  console.log('If CC0 avatar downloads fail, procedural box-mesh avatars are used as fallback.');
  console.log('To add custom photorealistic avatars:');
  console.log('  1. Download CC0 GLB files from:');
  console.log('     - https://opensource3dassets.com/en/gallery');
  console.log('     - https://quaternius.com');
  console.log('     - https://sketchfab.com (filter: CC0, rigged, glb)');
  console.log('  2. Place them in:  public/models/avatars/{npcName}/{layer}.glb');
  console.log('  3. Layers: body, dressed, sleepwear, towel, swimwear');
  console.log('\nDone.');
}

main().catch(console.error);
