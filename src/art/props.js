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

const WOOD = { base: 0xa06a44, shade: 0x77492e, light: 0xc48a5a };

export function makeFence() {
  const pc = new PixelCanvas(18, 14);
  pc.rect(2, 2, 3, 11, WOOD.base);
  pc.rect(13, 2, 3, 11, WOOD.base);
  pc.rect(0, 4, 18, 2, WOOD.light);
  pc.rect(0, 8, 18, 2, WOOD.base);
  pc.vline(4, 2, 12, WOOD.shade);
  pc.vline(15, 2, 12, WOOD.shade);
  pc.outline(OUT);
  return { pc, ax: 9, ay: 12 };
}

export function makeBanner(color) {
  const pc = new PixelCanvas(14, 30);
  pc.rect(2, 0, 2, 30, WOOD.base);
  pc.vline(3, 0, 29, WOOD.shade);
  pc.rect(4, 2, 8, 12, color);
  for (let x = 4; x < 12; x += 2) pc.px(x, 14, color);
  pc.rect(6, 5, 4, 4, 0xf2c94c);
  pc.outline(OUT);
  return { pc, ax: 3, ay: 28 };
}

export function makeMast() {
  const pc = new PixelCanvas(40, 64);
  pc.rect(18, 4, 4, 60, WOOD.base);
  pc.vline(21, 4, 63, WOOD.shade);
  // 돛
  for (let y = 0; y < 30; y++) {
    const w = 15 - Math.abs(y - 15) * 0.25;
    pc.hline(Math.round(20 - w), Math.round(20 + w), y + 8, y % 9 === 8 ? 0xd9cdb0 : 0xf2ead6);
  }
  pc.rect(17, 2, 6, 3, 0xf2c94c);
  pc.rect(6, 7, 28, 2, WOOD.shade);
  pc.outline(OUT);
  return { pc, ax: 20, ay: 62 };
}

export function makeRail(vertical) {
  const pc = vertical ? new PixelCanvas(6, 20) : new PixelCanvas(18, 12);
  if (vertical) {
    pc.rect(1, 0, 3, 19, WOOD.base);
    pc.vline(3, 0, 18, WOOD.shade);
  } else {
    pc.rect(0, 3, 18, 3, WOOD.light);
    pc.rect(1, 6, 2, 5, WOOD.base);
    pc.rect(15, 6, 2, 5, WOOD.base);
  }
  pc.outline(OUT);
  return { pc, ax: vertical ? 3 : 9, ay: vertical ? 18 : 10 };
}

export function makeWheel() {
  const pc = new PixelCanvas(18, 22);
  pc.rect(8, 12, 2, 9, WOOD.shade);
  pc.ellipse(9, 9, 7, 7, WOOD.base);
  pc.ellipse(9, 9, 4.5, 4.5, -1);
  for (const [dx, dy] of [[0, -8], [0, 8], [-8, 0], [8, 0], [-6, -6], [6, 6], [-6, 6], [6, -6]]) pc.px(9 + dx, 9 + dy, WOOD.light);
  pc.ellipse(9, 9, 1.6, 1.6, 0xf2c94c);
  pc.outline(OUT);
  return { pc, ax: 9, ay: 20 };
}

export function makeCrate() {
  const pc = new PixelCanvas(16, 16);
  pc.rect(1, 1, 14, 14, WOOD.base);
  pc.rect(1, 1, 14, 3, WOOD.light);
  for (let k = 0; k < 11; k++) pc.px(3 + k, 4 + k > 14 ? 14 : 4 + k, WOOD.shade);
  pc.vline(14, 1, 14, WOOD.shade);
  pc.outline(OUT);
  return { pc, ax: 8, ay: 14 };
}

export function makeBarrel() {
  const pc = new PixelCanvas(14, 16);
  pc.ellipse(7, 8, 6, 7, WOOD.base);
  pc.hline(1, 12, 4, 0x6c6c78);
  pc.hline(1, 12, 11, 0x6c6c78);
  pc.ellipse(7, 3, 4.5, 1.6, WOOD.light);
  pc.vline(10, 3, 13, WOOD.shade);
  pc.outline(OUT);
  return { pc, ax: 7, ay: 14 };
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
  const one = (name, r) => atlas.add(`prop_${name}_0`, r.pc, r.ax, r.ay);
  one('fence', makeFence());
  one('banner', makeBanner(0x3a64b4));
  atlas.add('prop_banner_1', makeBanner(0xd94f4f).pc, 3, 28);
  one('mast', makeMast());
  one('railh', makeRail(false));
  one('railv', makeRail(true));
  one('wheel', makeWheel());
  one('crate', makeCrate());
  one('barrel', makeBarrel());
  atlas.add('shadow_m', makeShadow(14, 5), 7, 2);
  atlas.add('shadow_l', makeShadow(30, 10), 15, 5);
}
