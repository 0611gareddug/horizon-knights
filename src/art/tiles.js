// 지형 블록 그림 생성 — 플랫 스타일 (단색 면 + 드문드문 무늬)
import { PixelCanvas, rng } from '../render/pixel.js';
import { drawIsoBox } from './iso-draw.js';

export const VARIANTS = 4;

export const MATERIALS = {
  grass: { top: 0x74d05e, mark: 0x5cb84e, lipL: 0x5cb84b, lipR: 0x4a9c3e, left: 0xa8744c, right: 0x83583a, spot: 0x8e6040 },
  dirt: { top: 0xb27c50, mark: 0x9a6842, left: 0xa8744c, right: 0x83583a, spot: 0x8e6040 },
  path: { top: 0xeccb90, mark: 0xd2ad72, lipL: 0xd8b67c, lipR: 0xbe9a62, left: 0xa8744c, right: 0x83583a, spot: 0x8e6040 },
  stone: { top: 0xbcc2cc, mark: 0x9da4b2, left: 0x9aa1ae, right: 0x7c8392, spot: 0x878e9c },
  under: { top: 0x8e684c, mark: 0x7a573e, left: 0x8e684c, right: 0x6c4e3a, spot: 0x5c4232 },
};

function topMarks(r, mat) {
  // 윗면 장식 위치 (마름모 안쪽에만)
  const marks = [];
  const n = mat === 'grass' ? Math.floor(r() * 3) : mat === 'path' ? 2 + Math.floor(r() * 3) : Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const x = 8 + Math.floor(r() * 16);
    const yy = 4 + Math.floor(r() * 7);
    marks.push([x, yy]);
  }
  return marks;
}

function paintFor(mat, hpx, seed) {
  const r = rng(seed * 7919 + 13);
  const m = MATERIALS[mat];
  const marks = new Set();
  for (const [x, y] of topMarks(r, mat)) {
    if (mat === 'grass') {
      // 작은 풀잎 'v' 모양
      marks.add(`${x},${y}`);
      marks.add(`${x + 2},${y}`);
      marks.add(`${x + 1},${y + 1}`);
    } else if (mat === 'stone') {
      marks.add(`${x},${y}`);
      marks.add(`${x + 1},${y}`);
      marks.add(`${x + 2},${y + 1}`);
    } else {
      marks.add(`${x},${y}`);
      if (r() < 0.5) marks.add(`${x + 1},${y}`);
    }
  }
  const lip = new Uint8Array(32).map(() => 2 + (r() < 0.22 ? 1 : 0));
  const spots = new Set();
  const nSpots = Math.floor(r() * 3) + (hpx > 8 ? 1 : 0);
  for (let k = 0; k < nSpots; k++) {
    const x = 2 + Math.floor(r() * 28);
    const v = 5 + Math.floor(r() * Math.max(1, hpx - 7));
    spots.add(`${x},${v}`);
    spots.add(`${x + 1},${v}`);
  }

  return (face, x, y, u, v) => {
    if (face === 'top') return marks.has(`${x},${v}`) ? m.mark : m.top;
    const left = face === 'left';
    if (m.lipL && v < lip[x]) return left ? m.lipL : m.lipR;
    if (spots.has(`${x},${v}`)) return left ? m.spot : shadeRight(m.spot);
    return left ? m.left : m.right;
  };
}

function shadeRight(c) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return (Math.round(r * 0.8) << 16) | (Math.round(g * 0.8) << 8) | Math.round(b * 0.85);
}

export function makeBlock(mat, hpx, variant) {
  const pc = new PixelCanvas(32, 16 + hpx);
  drawIsoBox(pc, 0, 0, 32, hpx, paintFor(mat, hpx, variant * 101 + hpx * 17 + mat.length * 3));
  return pc;
}

// 섬 아래쪽 흙 고드름
export function makeStalactite(seed) {
  const r = rng(seed * 31 + 7);
  const pc = new PixelCanvas(32, 26);
  const m = MATERIALS.under;
  let x = 2;
  while (x < 30) {
    const w = 2 + Math.floor(r() * 3);
    const len = 3 + Math.floor(r() * 9) + (r() < 0.25 ? 6 : 0);
    for (let k = 0; k < w && x + k < 30; k++) {
      const xx = x + k;
      const mm = xx < 16 ? xx : 31 - xx;
      const start = mm >> 1;
      // 끝으로 갈수록 좁아짐
      const taper = Math.abs(k - (w - 1) / 2) * 3;
      const l = Math.max(1, len - taper);
      for (let y = 0; y < l; y++) pc.px(xx, start + y, xx < 16 ? m.left : m.right);
    }
    x += w;
  }
  return pc;
}

export function registerTiles(atlas) {
  for (const mat of Object.keys(MATERIALS)) {
    for (let v = 0; v < VARIANTS; v++) {
      atlas.add(`blk_${mat}_16_${v}`, makeBlock(mat, 16, v));
      atlas.add(`blk_${mat}_8_${v}`, makeBlock(mat, 8, v));
    }
  }
  for (let v = 0; v < VARIANTS; v++) atlas.add(`stal_${v}`, makeStalactite(v));
}
