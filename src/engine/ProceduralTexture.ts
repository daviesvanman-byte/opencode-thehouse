import { CanvasTexture, RepeatWrapping } from 'three';

export function generateSkinTexture(width = 512, height = 512, tone = '#f0d0b0', variant = 0): { map: CanvasTexture; normalMap: CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const base = parseColor(tone);
  const rng = mulberry32(variant + 100);

  // Base skin tone with gradient (lighter center, darker edges)
  const grad = ctx.createRadialGradient(width * 0.5, height * 0.35, 0, width * 0.5, height * 0.35, width * 0.8);
  grad.addColorStop(0, `rgb(${base.r + 20},${base.g + 15},${base.b + 10})`);
  grad.addColorStop(0.5, tone);
  grad.addColorStop(1, `rgb(${Math.max(0, base.r - 35)},${Math.max(0, base.g - 30)},${Math.max(0, base.b - 25)})`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

  // Subsurface scatter simulation — reddish glow under skin
  const sss = ctx.createRadialGradient(width * 0.4, height * 0.3, 0, width * 0.4, height * 0.3, width * 0.5);
  sss.addColorStop(0, 'rgba(220,120,80,0.06)');
  sss.addColorStop(1, 'rgba(220,120,80,0)');
  ctx.fillStyle = sss; ctx.fillRect(0, 0, width, height);

  // Pore structure — fine noise
  for (let i = 0; i < 3000; i++) {
    const x = rng() * width, y = rng() * height, r = 0.3 + rng() * 1.2;
    const d = Math.floor(10 + rng() * 18);
    ctx.fillStyle = `rgba(${d},${d},${d},0.12)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Freckles / skin spots
  for (let i = 0; i < 60 + Math.floor(rng() * 60); i++) {
    const x = rng() * width, y = rng() * height, r = 1 + rng() * 3;
    const b = Math.floor(50 + rng() * 40);
    ctx.fillStyle = `rgba(${b},${Math.floor(b * 0.65)},${Math.floor(b * 0.35)},0.25)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Fine wrinkles / skin lines
  ctx.strokeStyle = `rgba(160,90,70,0.04)`; ctx.lineWidth = 0.4;
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    let x = rng() * width, y = rng() * height;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (rng() - 0.5) * 16;
      y += (rng() - 0.5) * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Hair follicle dots (darker small dots)
  for (let i = 0; i < 200; i++) {
    const x = rng() * width, y = rng() * height;
    ctx.fillStyle = `rgba(30,20,15,0.08)`;
    ctx.beginPath(); ctx.arc(x, y, 0.4 + rng() * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Capillary veins (subtle red/blue lines)
  for (let i = 0; i < 15; i++) {
    const x = rng() * width, y = rng() * height;
    ctx.strokeStyle = `rgba(${120 + rng() * 60},${40 + rng() * 30},${40 + rng() * 20},0.03)`;
    ctx.lineWidth = 0.3 + rng() * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      ctx.lineTo(x + (rng() - 0.5) * 20, y + (rng() - 0.5) * 15);
    }
    ctx.stroke();
  }

  // Highlight patches (oily shine)
  for (let i = 0; i < 20; i++) {
    const x = rng() * width, y = rng() * height, r = 5 + rng() * 12;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;

  // Normal map generation from height
  const normCanvas = document.createElement('canvas');
  normCanvas.width = width; normCanvas.height = height;
  const nctx = normCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;
  const outData = nctx.createImageData(width, height);
  const out = outData.data;
  const heightAt = (x: number, y: number): number => {
    const ix = Math.max(0, Math.min(width - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const idx = (iy * width + ix) * 4;
    return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / (3 * 255);
  };
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const hL = heightAt(x - 1, y), hR = heightAt(x + 1, y), hD = heightAt(x, y - 1), hU = heightAt(x, y + 1);
      const dx = (hL - hR) * 3.0, dy = (hD - hU) * 3.0, dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * width + x) * 4;
      out[idx] = Math.floor((dx / len + 1) * 127);
      out[idx + 1] = Math.floor((dy / len + 1) * 127);
      out[idx + 2] = Math.floor((dz / len + 1) * 127);
      out[idx + 3] = 255;
    }
  }
  nctx.putImageData(outData, 0, 0);
  const normalMap = new CanvasTexture(normCanvas);
  normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
  return { map, normalMap };
}

export function generateClothTexture(width = 256, height = 256, baseColor = '#666688'): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(baseColor.charCodeAt(1) + baseColor.charCodeAt(3));

  // Base color
  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);

  // Subtle noise
  for (let i = 0; i < 3000; i++) {
    const x = rng() * width, y = rng() * height;
    const b = Math.floor(rng() * 18) - 9;
    ctx.fillStyle = `rgba(${c.r + b},${c.g + b},${c.b + b},0.2)`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Weave pattern — horizontal and vertical threads
  const threadW = 2;
  for (let y = 0; y < height; y += 6) {
    for (let x = 0; x < width; x += 6) {
      const offset = Math.floor(rng() * 4) - 2;
      ctx.fillStyle = `rgba(${c.r + offset + 8},${c.g + offset + 8},${c.b + offset + 8},0.25)`;
      ctx.fillRect(x, y, threadW, 3);
    }
  }
  for (let x = 0; x < width; x += 6) {
    for (let y = 0; y < height; y += 6) {
      const offset = Math.floor(rng() * 4) - 2;
      ctx.fillStyle = `rgba(${c.r + offset + 5},${c.g + offset + 5},${c.b + offset + 5},0.2)`;
      ctx.fillRect(x, y, 3, threadW);
    }
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateWoodTexture(width = 256, height = 256, baseColor = '#8a7a6a', targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(42);

  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 60; i++) {
    const y = rng() * height;
    ctx.strokeStyle = `rgba(${c.r - 20 + Math.floor(rng() * 30)},${c.g - 15 + Math.floor(rng() * 25)},${c.b - 10 + Math.floor(rng() * 20)},0.3)`;
    ctx.lineWidth = 1 + rng() * 3;
    ctx.beginPath();
    let x = 0;
    ctx.moveTo(x, y);
    while (x < width) {
      x += 2 + rng() * 6;
      ctx.lineTo(x, y + (rng() - 0.5) * 4);
    }
    ctx.stroke();
  }
  // Knots
  for (let i = 0; i < 4; i++) {
    const kx = rng() * width, ky = rng() * height;
    ctx.fillStyle = `rgba(${c.r - 40},${c.g - 30},${c.b - 20},0.5)`;
    ctx.beginPath(); ctx.ellipse(kx, ky, 4 + rng() * 6, 3 + rng() * 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(0,0,0,0.2)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(kx, ky, 6 + rng() * 4, 4 + rng() * 3, 0, 0, Math.PI * 2); ctx.stroke();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateTileTexture(width = 256, height = 256, baseColor = '#5a5a5a', tileSize = 32, targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(77);

  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const offset = Math.floor(rng() * 12) - 6;
      ctx.fillStyle = `rgb(${c.r + offset},${c.g + offset},${c.b + offset})`;
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      ctx.strokeStyle = `rgba(0,0,0,0.15)`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, tileSize, tileSize);
    }
  }

  // Grout variation
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(200,200,200,0.05)`;
    ctx.fillRect(rng() * width, rng() * height, 2, 2);
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generatePlasterTexture(width = 256, height = 256, baseColor = '#7a7a7a', targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(33);

  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);

  // Stucco/plaster grain
  for (let i = 0; i < 1500; i++) {
    const x = rng() * width, y = rng() * height, r = 1 + rng() * 3;
    const b = Math.floor(rng() * 25) - 12;
    ctx.fillStyle = `rgba(${c.r + b},${c.g + b},${c.b + b},0.2)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Subtle horizontal streaks
  for (let i = 0; i < 40; i++) {
    const y = rng() * height;
    ctx.fillStyle = `rgba(255,255,255,0.03)`;
    ctx.fillRect(0, y, width, 0.5 + rng() * 1.5);
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateGrassTexture(width = 256, height = 256, targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(55);

  ctx.fillStyle = '#2a5a2a'; ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 3000; i++) {
    const x = rng() * width, y = rng() * height;
    const g = 70 + Math.floor(rng() * 60);
    const b = 30 + Math.floor(rng() * 30);
    ctx.fillStyle = `rgb(30,${g},${b})`;
    ctx.fillRect(x, y, 0.5 + rng() * 1.5, 2 + rng() * 4);
  }

  // Darker patches
  for (let i = 0; i < 30; i++) {
    const x = rng() * width, y = rng() * height, r = 5 + rng() * 15;
    ctx.fillStyle = `rgba(10,40,10,0.15)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateFabricTexture(width = 128, height = 128, baseColor = '#5a6a7a', targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(88);

  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);

  // Fuzzy noise
  for (let i = 0; i < 2000; i++) {
    const x = rng() * width, y = rng() * height;
    const b = Math.floor(rng() * 20) - 10;
    ctx.fillStyle = `rgba(${c.r + b},${c.g + b},${c.b + b},0.3)`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Thread lines
  for (let i = 0; i < 20; i++) {
    const y = rng() * height;
    ctx.strokeStyle = `rgba(${c.r - 15},${c.g - 10},${c.b - 5},0.15)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x < width; x += 2) ctx.lineTo(x, y + (rng() - 0.5) * 2);
    ctx.stroke();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateMarbleTexture(width = 256, height = 256, baseColor = '#c8c8c8', targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c = parseColor(baseColor);
  const rng = mulberry32(111);

  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, width, height);

  // Veins
  for (let i = 0; i < 12; i++) {
    const startX = rng() * width, startY = rng() * height;
    ctx.strokeStyle = `rgba(${c.r - 20 + Math.floor(rng() * 15)},${c.g - 15 + Math.floor(rng() * 15)},${c.b - 10 + Math.floor(rng() * 10)},${0.1 + rng() * 0.3})`;
    ctx.lineWidth = 0.5 + rng() * 2.5;
    ctx.beginPath(); ctx.moveTo(startX, startY);
    let x = startX, y = startY;
    for (let j = 0; j < 20; j++) {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle noise
  for (let i = 0; i < 800; i++) {
    const x = rng() * width, y = rng() * height;
    const b = Math.floor(rng() * 15) - 7;
    ctx.fillStyle = `rgba(${c.r + b},${c.g + b},${c.b + b},0.1)`;
    ctx.beginPath(); ctx.arc(x, y, 0.5 + rng() * 2, 0, Math.PI * 2); ctx.fill();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateTerracottaTexture(width = 256, height = 256, targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(122);

  ctx.fillStyle = '#c47a4a'; ctx.fillRect(0, 0, width, height);

  // Tile grid
  const tileS = 32;
  for (let y = 0; y < height; y += tileS) {
    for (let x = 0; x < width; x += tileS) {
      const offset = Math.floor(rng() * 20) - 10;
      ctx.fillStyle = `rgb(${196 + offset},${122 + offset},${74 + offset})`;
      ctx.fillRect(x + 1, y + 1, tileS - 2, tileS - 2);
      ctx.strokeStyle = `rgba(100,60,30,0.15)`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, tileS, tileS);
    }
  }

  // Wear patches
  for (let i = 0; i < 40; i++) {
    const x = rng() * width, y = rng() * height, r = 3 + rng() * 10;
    ctx.fillStyle = `rgba(160,100,60,0.1)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

export function generateCheckerboardTexture(width = 256, height = 256, color1 = '#e8d0d8', color2 = '#d0b0c0', tileSize = 32, targetCanvas?: HTMLCanvasElement): CanvasTexture {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  const rng = mulberry32(66);

  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const isColor1 = ((x / tileSize) + (y / tileSize)) % 2 === 0;
      const c = isColor1 ? c1 : c2;
      const offset = Math.floor(rng() * 8) - 4;
      ctx.fillStyle = `rgb(${c.r + offset},${c.g + offset},${c.b + offset})`;
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  // Subtle grout lines between tiles
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= height; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  for (let x = 0; x <= width; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }

  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  return map;
}

/** Generate a normal map from a source CanvasTexture's pixel data */
export function generateNormalMapFromCanvas(canvas: HTMLCanvasElement, strength = 2.0): CanvasTexture {
  const w = canvas.width, h = canvas.height;
  const nc = document.createElement('canvas');
  nc.width = w; nc.height = h;
  const nctx = nc.getContext('2d')!;
  const srcData = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  const src = srcData.data;
  const outData = nctx.createImageData(w, h);
  const out = outData.data;
  const heightAt = (x: number, y: number): number => {
    const ix = Math.max(0, Math.min(w - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(h - 1, Math.floor(y)));
    const idx = (iy * w + ix) * 4;
    return (src[idx] + src[idx + 1] + src[idx + 2]) / (3 * 255);
  };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const hL = heightAt(x - 1, y), hR = heightAt(x + 1, y);
      const hD = heightAt(x, y - 1), hU = heightAt(x, y + 1);
      const dx = (hL - hR) * strength, dy = (hD - hU) * strength, dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const idx = (y * w + x) * 4;
      out[idx] = Math.floor((dx / len + 1) * 127);
      out[idx + 1] = Math.floor((dy / len + 1) * 127);
      out[idx + 2] = Math.floor((dz / len + 1) * 127);
      out[idx + 3] = 255;
    }
  }
  nctx.putImageData(outData, 0, 0);
  const nm = new CanvasTexture(nc);
  nm.wrapS = nm.wrapT = RepeatWrapping;
  return nm;
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export function mulberry32(a: number): () => number {
  return () => { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
