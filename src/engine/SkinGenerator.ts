import { CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three';
import { mulberry32 } from './ProceduralTexture';

export interface SkinTextureSet {
  albedo: CanvasTexture;
  normal: CanvasTexture;
  roughness: CanvasTexture;
  ao: CanvasTexture;
}

/**
 * Generate a full PBR skin texture set at atlas resolution.
 * All textures share the same random seed for consistent detail placement.
 */
export function generateSkinAtlas(width = 2048, height = 2048, tone = '#e8c4a0', seed = 0): SkinTextureSet {
  const rng = mulberry32(seed + 1);
  const base = parseColor(tone);

  // ── Albedo ──────────────────────────────────────────────────────────
  const albedoCtx = createCanvas(width, height);
  // Base skin tone with gradient
  fillGradient(albedoCtx, width, height, base, rng);
  // Subsurface reddening (cheeks, nose, ears)
  addSubsurface(albedoCtx, width, height, rng);
  // Pores & fine noise
  addPores(albedoCtx, width, height, rng, 0.10);
  // Freckles & pigmentation
  addFreckles(albedoCtx, width, height, rng);
  // Veins
  addVeins(albedoCtx, width, height, rng, 0.04);
  // Hair follicles
  addFollicles(albedoCtx, width, height, rng, 0.10);
  // Oily highlights (albedo brightening)
  addOilyPatches(albedoCtx, width, height, rng, 0.04);

  const albedo = new CanvasTexture(albedoCtx.canvas);
  albedo.wrapS = albedo.wrapT = RepeatWrapping;
  albedo.colorSpace = SRGBColorSpace;

  // ── Normal map (from albedo height) ─────────────────────────────────
  const normal = generateNormalFromCanvas(albedoCtx.canvas, width, height, 2.5);
  normal.colorSpace = LinearSRGBColorSpace;

  // ── Roughness map ───────────────────────────────────────────────────
  const roughCtx = createCanvas(width, height);
  const rg = roughCtx.createRadialGradient(width * 0.3, height * 0.25, 0, width * 0.4, height * 0.4, width * 0.7);
  rg.addColorStop(0, '#555');   // center face — oilier (smoother = darker)
  rg.addColorStop(0.3, '#777');
  rg.addColorStop(0.7, '#999'); // body — drier (rougher = lighter)
  rg.addColorStop(1, '#aaa');
  roughCtx.fillStyle = rg; roughCtx.fillRect(0, 0, width, height);
  // Noise on roughness
  addPores(roughCtx, width, height, rng, 0.15);
  addOilyPatches(roughCtx, width, height, rng, 0.08);

  const roughness = new CanvasTexture(roughCtx.canvas);
  roughness.wrapS = roughness.wrapT = RepeatWrapping;
  roughness.colorSpace = LinearSRGBColorSpace;

  // ── AO map ──────────────────────────────────────────────────────────
  const aoCtx = createCanvas(width, height);
  aoCtx.fillStyle = '#ccc'; aoCtx.fillRect(0, 0, width, height);
  addPores(aoCtx, width, height, rng, 0.06);

  const ao = new CanvasTexture(aoCtx.canvas);
  ao.wrapS = ao.wrapT = RepeatWrapping;
  ao.colorSpace = LinearSRGBColorSpace;

  return { albedo, normal, roughness, ao };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function createCanvas(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c.getContext('2d')!;
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function fillGradient(ctx: CanvasRenderingContext2D, w: number, h: number, base: { r: number; g: number; b: number }, rng: () => number) {
  const g = ctx.createRadialGradient(w * 0.45 + rng() * w * 0.1, h * 0.3 + rng() * h * 0.1, 0, w * 0.5, h * 0.4, w * 0.85);
  const bright = `rgb(${Math.min(255, base.r + 10)},${Math.min(255, base.g + 5)},${Math.min(255, base.b + 5)})`;
  const dark = `rgb(${Math.max(0, base.r - 60)},${Math.max(0, base.g - 55)},${Math.max(0, base.b - 50)})`;
  g.addColorStop(0, bright);
  g.addColorStop(0.4, `rgb(${base.r},${base.g},${base.b})`);
  g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function addSubsurface(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) {
  // Cheek/nose warmth
  for (let i = 0; i < 8; i++) {
    const x = w * (0.2 + rng() * 0.6), y = h * (0.15 + rng() * 0.35), r = w * (0.05 + rng() * 0.12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(210,${80 + rng() * 40},${50 + rng() * 30},0.07)`);
    g.addColorStop(1, 'rgba(210,80,50,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

function addPores(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha = 0.12) {
  for (let i = 0; i < 5000; i++) {
    const x = rng() * w, y = rng() * h, r = 0.3 + rng() * 1.5;
    const d = Math.floor(10 + rng() * 20);
    ctx.fillStyle = `rgba(${d},${d},${d},${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function addFreckles(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number) {
  const count = 80 + Math.floor(rng() * 120);
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h, r = 1 + rng() * 4;
    const b = Math.floor(55 + rng() * 45);
    ctx.fillStyle = `rgba(${b},${Math.floor(b * 0.6)},${Math.floor(b * 0.3)},0.22)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function addVeins(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha = 0.03) {
  for (let i = 0; i < 20; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.strokeStyle = `rgba(${100 + rng() * 80},${30 + rng() * 40},${30 + rng() * 30},${alpha})`;
    ctx.lineWidth = 0.4 + rng() * 1.0;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      ctx.lineTo(x + (rng() - 0.5) * 24, y + (rng() - 0.5) * 18);
    }
    ctx.stroke();
  }
}

function addFollicles(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha = 0.10) {
  for (let i = 0; i < 300; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.fillStyle = `rgba(35,25,20,${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, 0.5 + rng() * 0.8, 0, Math.PI * 2); ctx.fill();
  }
}

function addOilyPatches(ctx: CanvasRenderingContext2D, w: number, h: number, rng: () => number, alpha = 0.03) {
  for (let i = 0; i < 30; i++) {
    const x = rng() * w, y = rng() * h, r = 8 + rng() * 20;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function generateNormalFromCanvas(src: HTMLCanvasElement, w: number, h: number, strength = 2.0): CanvasTexture {
  const normCanvas = document.createElement('canvas');
  normCanvas.width = w; normCanvas.height = h;
  const nctx = normCanvas.getContext('2d')!;

  const imgData = nctx.createImageData(w, h);
  const out = imgData.data;

  // Read source pixels
  const tmpCtx = document.createElement('canvas').getContext('2d')!;
  tmpCtx.canvas.width = w; tmpCtx.canvas.height = h;
  tmpCtx.drawImage(src, 0, 0);
  const srcData = tmpCtx.getImageData(0, 0, w, h).data;

  const heightAt = (x: number, y: number): number => {
    const ix = Math.max(0, Math.min(w - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(h - 1, Math.floor(y)));
    const idx = (iy * w + ix) * 4;
    return (srcData[idx] + srcData[idx + 1] + srcData[idx + 2]) / (3 * 255);
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const hL = heightAt(x - 1, y), hR = heightAt(x + 1, y);
      const hD = heightAt(x, y - 1), hU = heightAt(x, y + 1);
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * w + x) * 4;
      out[idx] = Math.floor((dx / len + 1) * 127);
      out[idx + 1] = Math.floor((dy / len + 1) * 127);
      out[idx + 2] = Math.floor((dz / len + 1) * 127);
      out[idx + 3] = 255;
    }
  }
  nctx.putImageData(imgData, 0, 0);

  const normalMap = new CanvasTexture(normCanvas);
  normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
  return normalMap;
}
