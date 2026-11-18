import * as THREE from 'three';

export function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#1f232b';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle asphalt aggregate grain
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const v = 24 + Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks along the 4 lanes
  const laneCenters = [160, 394, 630, 864];
  for (const cx of laneCenters) {
    const grad = ctx.createLinearGradient(cx - 80, 0, cx + 80, 0);
    grad.addColorStop(0, 'rgba(12,14,18,0)');
    grad.addColorStop(0.3, 'rgba(12,14,18,0.34)');
    grad.addColorStop(0.5, 'rgba(12,14,18,0.1)');
    grad.addColorStop(0.7, 'rgba(12,14,18,0.34)');
    grad.addColorStop(1, 'rgba(12,14,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 80, 0, 160, 1024);
  }

  // Outer rumble curbs (alternating amber/slate)
  const curbWidth = 28;
  const segmentH = 64;
  for (let y = 0; y < 1024; y += segmentH) {
    const isAccent = (y / segmentH) % 2 === 0;
    ctx.fillStyle = isAccent ? '#dc2626' : '#e4e4e7';
    ctx.fillRect(0, y, curbWidth, segmentH);
    ctx.fillRect(1024 - curbWidth, y, curbWidth, segmentH);
  }

  // Solid edge shoulder lines
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(42, 0, 10, 1024);
  ctx.fillRect(1024 - 52, 0, 10, 1024);

  // Center double amber divider
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(502, 0, 7, 1024);
  ctx.fillRect(515, 0, 7, 1024);

  // Dashed lane lines between lanes 1-2 and 3-4
  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  const dashLen = 110;
  const gapLen = 146;
  for (let y = 24; y < 1024; y += dashLen + gapLen) {
    ctx.fillRect(274, y, 8, dashLen);
    ctx.fillRect(742, y, 8, dashLen);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 22);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createShoulderTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3a3a3c';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 48 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 24);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.48)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createSkyGradientTexture(topHex: string, horizonHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, topHex);
  grad.addColorStop(0.58, horizonHex);
  grad.addColorStop(1, horizonHex);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
