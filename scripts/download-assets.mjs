/**
 * The House — Asset Setup
 *
 * Prepares directory structure for avatar GLB files.
 * Procedural avatars are generated at runtime by AvatarSystem as fallback.
 *
 * For higher-quality visuals, download CC0 human GLB models and place them at:
 *   public/models/avatars/{npcName}/{layer}.glb
 *
 * Layers: body, dressed, sleepwear, towel, swimwear
 *
 * CC0 human model sources:
 *   - https://opensourceavatars.com/  (VRM/GLB CC0 human avatars)
 *   - https://sketchfab.com/ (filter by CC0 license)
 *   - https://polyhaven.com/models (photoreal CC0)
 *
 * Run: `npm run assets`
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, '..', 'public', 'models');
const AVATARS_DIR = join(MODELS_DIR, 'avatars');

const HOUSEMATES = ['alex', 'jordan', 'sam'];
const LAYERS = ['body', 'dressed', 'sleepwear', 'towel', 'swimwear'];

function main() {
  console.log('=== The House — Asset Setup ===\n');

  // Ensure directory structure
  for (const d of [MODELS_DIR, AVATARS_DIR, join(MODELS_DIR, 'house'), join(MODELS_DIR, 'textures')]) {
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true });
      console.log(`Created ${d}`);
    }
  }

  // Write .gitkeep files to track empty dirs in git
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
        console.log(`  ✓ avatars/${name}/${layer}.glb`);
      } else {
        console.log(`  · avatars/${name}/${layer}.glb  (runtime fallback will be used)`);
      }
    }
  }

  console.log('\n--- Runtime Notes ---');
  console.log('Procedural box-mesh avatars will be used by default.');
  console.log('To use real human models, place CC0 GLB files in the directories above.');
  console.log('See top of this script for CC0 sourcing recommendations.');
  console.log('\nDone.');
}

main();
