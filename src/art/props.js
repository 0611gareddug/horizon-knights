// 나무, 덤불, 바위, 꽃, 풀 — 플랫 스타일 (단색 + 그림자 한 단계 + 하이라이트 + 외곽선)
import { PixelCanvas, rng } from '../render/pixel.js';

const OUT = 0x1d1b29;
const LEAF = { base: 0x57c063, shade: 0x3d9c4f, hi: 0x8ce27e };
const BARK = { base: 0xa06a44, shade: 0x77492e };
const ROCK = { base: 0xbcc2cc, shade: 0x8f97a6, hi: 0xe6e9ee };

// 여러 타원을 합친 덩어리를 칠하고, 아래/오른쪽은 그늘, 왼쪽 위는 하이라이트
function blob(pc, ellipses, pal, lightX, lightY) {
  const inside = (x, y) =>
    ellipses.some(([cx, cy, rx, ry]) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      return dx * dx + dy * dy <= 1;
    });
  let minY = 1e9;
  let maxY = -1e9;
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (inside(x, y)) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      if (!inside(x, y)) continue;
      let c = pal.base;
      // 아랫부분과 오른쪽 가장자리는 그늘
      const below = !inside(x, y + 2) || !inside(x + 2, y + 1);
      if (y > minY + (maxY - minY) * 0.62 || below) c = pal.shade;
      pc.px(x, y, c);
    }
  // 하이라이트
  if (pal.hi && lightX !== undefined) {
    for (let y = 0; y < pc.h; y++)
      for (let x = 0; x < pc.w; x++) {
        const dx = (x + 0.5 - lightX) / 2.6;
        const dy = (y + 0.5 - lightY) / 1.7;
        if (dx * dx + dy * dy <= 1 && inside(x, y)) pc.px(x, y, pal.hi);
      }
  }
}

export function makeTree(seed) {
  const r = rng(seed * 977 + 3);
  const W = 34;
  const H = 44;
  const pc = new PixelCanvas(W, H);
  const cx = 17;
  const baseY = 40;
  // 줄기
  pc.rect(cx - 2, baseY - 12, 4, 12, BARK.base);
  pc.rect(cx + 1, baseY - 12, 1, 12, BARK.shade);
  pc.rect(cx - 2, baseY - 12, 4, 2, BARK.shade);
  // 나뭇잎 덩어리
  const cy = 18 + Math.floor(r() * 2);
  const ells = [
    [cx, cy + 2, 12, 9.5],
    [cx - 4 + r() * 2, cy - 5, 8, 7],
    [cx + 5, cy - 2, 7, 6.5],
  ];
  blob(pc, ells, LEAF, cx - 6, cy - 7);
  // 잎 결 몇 개
  for (let k = 0; k < 4; k++) {
    const x = cx - 7 + Math.floor(r() * 14);
    const y = cy - 3 + Math.floor(r() * 7);
    if (pc.get(x, y) === LEAF.base) {
      pc.px(x, y, LEAF.shade);
      pc.px(x + 1, y + 1, LEAF.shade);
    }
  }
  pc.outline(OUT);
  return { pc, ax: cx, ay: baseY };
}

export function makeBush(seed) {
  const r = rng(seed * 331 + 5);
  const pc = new PixelCanvas(22, 16);
  blob(pc, [[11, 9.5, 8, 5], [8, 7, 5, 4.5], [14, 7.5, 5, 4]], LEAF, 7.5, 5.5);
  if (r() < 0.6) {
    for (const [x, y] of [[6, 9], [13, 8], [15, 11]]) {
      pc.px(x, y, 0xf0545a);
      pc.px(x, y - 1, 0xff9aa0);
    }
  }
  pc.outline(OUT);
  return { pc, ax: 11, ay: 14 };
}

export function makeRock(seed) {
  const r = rng(seed * 557 + 11);
  const pc = new PixelCanvas(18, 13);
  const big = r() < 0.5;
  blob(pc, big ? [[8.5, 7, 7, 4.8], [12, 8.5, 4.5, 3]] : [[9, 7.5, 6, 4], [5, 8.5, 3.5, 2.5]], ROCK, 6, 4.8);
  pc.outline(OUT);
  return { pc, ax: 9, ay: 11 };
}

export function makeFlowers(seed) {
  const r = rng(seed * 89 + 1);
  const colors = [0xffffff, 0xff8fb1, 0xffd25e, 0x9fc6ff, 0xc9a0ff];
  const pc = new PixelCanvas(14, 9);
  const n = 2 + Math.floor(r() * 2);
  const col = colors[Math.floor(r() * colors.length)];
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(r() * 10);
    const y = 2 + Math.floor(r() * 5);
    pc.px(x, y + 2, 0x3d9c4f);
    pc.px(x - 1, y, col);
    pc.px(x + 1, y, col);
    pc.px(x, y - 1, col);
    pc.px(x, y + 1, col);
    pc.px(x, y, 0xffd25e);
  }
  return { pc, ax: 7, ay: 6 };
}

export function makeTuft(seed) {
  const r = rng(seed * 61 + 9);
  const pc = new PixelCanvas(10, 6);
  const c = 0x4fae46;
  const x = 2 + Math.floor(r() * 3);
  // 'w' 모양 풀잎
  for (const [dx, dy] of [[0, 2], [0, 3], [1, 4], [2, 3], [2, 2], [2, 1], [3, 4], [4, 3], [4, 2]]) pc.px(x + dx, dy, c);
  return { pc, ax: 5, ay: 5 };
}

export function makeShadow(w, h) {
  const pc = new PixelCanvas(w, h);
  pc.ellipse(w / 2, h / 2, w / 2, h / 2, 0x1d1b29, 70);
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
  atlas.add('shadow_m', makeShadow(14, 5), 7, 2);
  atlas.add('shadow_l', makeShadow(30, 10), 15, 5);
}
