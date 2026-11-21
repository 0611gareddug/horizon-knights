// 나무, 덤불, 바위, 꽃, 풀 같은 지형 장식
import { PixelCanvas, rng, shade, mix } from '../render/pixel.js';
import { drawIsoBox, topEdgeInfo } from './iso-draw.js';

const LEAF = { base: 0x3f9a3c, dark: 0x2c7431, light: 0x6cc24a, hi: 0x9ade63 };
const BARK = { base: 0x7a4f2e, dark: 0x5a3820, light: 0x956239 };

function leafPaint(r, w) {
  return (face, x, y, u, v) => {
    const n = r();
    let c = LEAF.base;
    if (face === 'top') {
      const e = topEdgeInfo(w, x, y);
      if (n < 0.18) c = LEAF.dark;
      else if (n > 0.8) c = LEAF.light;
      if (n > 0.95) c = LEAF.hi;
      if (e.isTopEdge) c = LEAF.light;
      return c;
    }
    if (n < 0.22) c = LEAF.dark;
    else if (n > 0.86) c = LEAF.light;
    // 아래로 갈수록 어둡게
    c = shade(c, face === 'left' ? 0.84 - v * 0.008 : 0.66 - v * 0.008);
    return c;
  };
}

// 나무: 기둥 + 블록 모양 나뭇잎 2단
export function makeTree(seed) {
  const r = rng(seed * 977 + 3);
  const W = 48;
  const H = 84;
  const pc = new PixelCanvas(W, H);
  const cx = W / 2;
  const baseY = H - 6; // 기둥 밑동 (칸 중심과 맞춤)
  // 기둥 (작은 아이소 기둥)
  const trunkW = 8;
  const trunkH = 30;
  drawIsoBox(pc, cx - trunkW / 2, baseY - trunkH - trunkW / 4 + 2, trunkW, trunkH, (face, x, y, u, v) => {
    const n = r();
    let c = BARK.base;
    if (n < 0.2 || v % 7 === 3) c = BARK.dark;
    else if (n > 0.85) c = BARK.light;
    if (face === 'left') return shade(c, 0.95);
    if (face === 'right') return shade(c, 0.7);
    return BARK.light;
  });
  // 큰 잎 덩어리
  const big = 40;
  const bigSide = 18;
  const bigY = baseY - trunkH - bigSide - big / 4 + 6;
  drawIsoBox(pc, cx - big / 2, bigY, big, bigSide, leafPaint(r, big));
  // 작은 윗 덩어리
  const small = 24;
  const smallSide = 10;
  drawIsoBox(pc, cx - small / 2 + (r() < 0.5 ? -2 : 2), bigY - smallSide - small / 4 + 4, small, smallSide, leafPaint(r, small));
  // 잎 사이로 삐져나온 잎사귀
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(cx - big / 2 + 2 + r() * (big - 4));
    const y = Math.floor(bigY + big / 4 + bigSide - 1 + r() * 3);
    if (pc.get(x, y - 1) !== -1) pc.px(x, y, LEAF.dark);
  }
  pc.outline(0x1f3a1c, { darken: 0.5 });
  return { pc, ax: cx, ay: baseY };
}

export function makeBush(seed) {
  const r = rng(seed * 331 + 5);
  const pc = new PixelCanvas(28, 26);
  drawIsoBox(pc, 3, 4, 20, 9, leafPaint(r, 20));
  drawIsoBox(pc, 6 + (r() < 0.5 ? -2 : 2), 0, 12, 5, leafPaint(r, 12));
  // 열매
  if (r() < 0.5)
    for (let i = 0; i < 3; i++) pc.px(7 + Math.floor(r() * 14), 9 + Math.floor(r() * 8), 0xe2504a);
  pc.outline(0x1f3a1c, { darken: 0.5 });
  return { pc, ax: 13, ay: 20 };
}

export function makeRock(seed) {
  const r = rng(seed * 557 + 11);
  const pc = new PixelCanvas(26, 22);
  const base = 0x9a9ca6;
  const paint = (face, x, y, u, v) => {
    const n = r();
    let c = base;
    if (n < 0.15) c = 0x7d7f8a;
    else if (n > 0.9) c = 0xbec0c8;
    if (face === 'top') return shade(c, 1.08);
    return shade(c, face === 'left' ? 0.82 : 0.62);
  };
  drawIsoBox(pc, 2, 6, 16, 8, paint);
  drawIsoBox(pc, 11, 9, 12, 5, paint);
  // 이끼
  for (let i = 0; i < 6; i++) {
    const x = 4 + Math.floor(r() * 16);
    const y = 6 + Math.floor(r() * 5);
    if (pc.get(x, y) !== -1) pc.px(x, y, 0x6cbd45);
  }
  pc.outline(0x2a2830, { darken: 0.4 });
  return { pc, ax: 12, ay: 17 };
}

export function makeFlowers(seed) {
  const r = rng(seed * 89 + 1);
  const colors = [0xf25c54, 0xffd25e, 0xffffff, 0xb784f5, 0x6ec3ff];
  const pc = new PixelCanvas(16, 10);
  const n = 3 + Math.floor(r() * 3);
  const col = colors[Math.floor(r() * colors.length)];
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(r() * 12);
    const y = 3 + Math.floor(r() * 5);
    pc.px(x, y + 1, 0x3f8030);
    pc.px(x, y, col);
    pc.px(x - 1, y, shade(col, 0.8));
    pc.px(x + 1, y, shade(col, 0.8));
    pc.px(x, y - 1, shade(col, 1.15));
  }
  return { pc, ax: 8, ay: 7 };
}

export function makeTuft(seed) {
  const r = rng(seed * 61 + 9);
  const pc = new PixelCanvas(12, 8);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(r() * 8);
    const h = 2 + Math.floor(r() * 4);
    for (let y = 0; y < h; y++) pc.px(x + (y > 2 && r() < 0.4 ? 1 : 0), 7 - y, y === h - 1 ? 0xa6e070 : mix(0x4f9a3a, 0x7fcf55, y / h));
  }
  return { pc, ax: 6, ay: 7 };
}

// 바닥 그림자 (반투명 타원)
export function makeShadow(w, h) {
  const pc = new PixelCanvas(w, h);
  pc.ellipse(w / 2, h / 2, w / 2, h / 2, 0x000000, 90);
  return pc;
}

export const PROP_VARIANTS = { tree: 4, bush: 3, rock: 3, flowers: 6, tuft: 4 };

export function registerProps(atlas) {
  const makers = { tree: makeTree, bush: makeBush, rock: makeRock, flowers: makeFlowers, tuft: makeTuft };
  for (const [name, count] of Object.entries(PROP_VARIANTS)) {
    for (let v = 0; v < count; v++) {
      const { pc, ax, ay } = makers[name](v + 1);
      atlas.add(`prop_${name}_${v}`, pc, ax, ay);
    }
  }
  atlas.add('shadow_m', makeShadow(16, 6), 8, 3);
  atlas.add('shadow_l', makeShadow(30, 10), 15, 5);
}
