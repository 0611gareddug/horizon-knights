// 탑다운 지형 타일 — 풀잎 결이 있는 바닥, 벽돌 무늬 흙 앞면
import { PixelCanvas, rng } from '../render/pixel.js';

export const VARIANTS = 6;
const T = 16;
const LV = 10;

export const PAL = {
  grass: 0x5fbf4b,
  grassLight: 0x7fd565,
  grassDark: 0x4ca83e,
  grassEdge: 0x3f8f35,
  grassHigh: 0x6dcb55,
  grassHighLight: 0x90de72,
  speck: 0x9c6c46,
  path: 0xe4c48c,
  pathLight: 0xf2dab0,
  pathDark: 0xc9a46c,
  stone: 0xbac0ca,
  stoneLight: 0xd6dae2,
  stoneDark: 0x949bab,
  dirt: 0x96603c,
  dirtDark: 0x6e4429,
  dirtLight: 0xab7349,
  plank: 0xb5824e,
  plankDark: 0x7f5530,
  plankLight: 0xcf9d66,
  under: 0x7a5038,
  underDark: 0x5a3a28,
  lip: 0x4ca83e,
  lipLight: 0x7fd565,
};

// 풀 바닥: 세로 풀잎 결 + 작은 흙 점
function grassTop(seed, high = false) {
  const r = rng(seed * 131 + 7);
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, high ? PAL.grassHigh : PAL.grass);
  for (let k = 0; k < 20; k++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * T);
    const len = 1 + Math.floor(r() * 2.4);
    const c = r() < 0.5 ? (high ? PAL.grassHighLight : PAL.grassLight) : PAL.grassDark;
    for (let d = 0; d < len; d++) pc.px(x, (y + d) % T, c);
  }
  if (r() < 0.17) {
    const x = Math.floor(r() * (T - 2));
    const y = Math.floor(r() * T);
    pc.px(x, y, PAL.speck);
    pc.px(x + 1, y, PAL.speck);
  }
  return pc;
}

function pathTop(seed) {
  const r = rng(seed * 173 + 3);
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, PAL.path);
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * T);
    pc.px(x, y, r() < 0.6 ? PAL.pathDark : PAL.pathLight);
    if (r() < 0.3) pc.px(x + 1, y, PAL.pathDark);
  }
  return pc;
}

function stoneTop(seed) {
  const r = rng(seed * 211 + 5);
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, PAL.stone);
  // 판석 이음매
  pc.hline(0, T - 1, 7, PAL.stoneDark);
  pc.vline(r() < 0.5 ? 5 : 10, 0, 6, PAL.stoneDark);
  pc.vline(r() < 0.5 ? 3 : 12, 8, 15, PAL.stoneDark);
  pc.hline(0, T - 1, 0, PAL.stoneLight);
  pc.hline(0, T - 1, 8, PAL.stoneLight);
  return pc;
}

// 앞면 (흙 벽돌). top=true면 위쪽에 풀 테두리
function wallFace(seed, h, kind, top) {
  const r = rng(seed * 97 + h * 13 + (top ? 1 : 0));
  const pc = new PixelCanvas(T, h);
  const base = kind === 'stone' ? PAL.stone : kind === 'under' ? PAL.under : kind === 'wood' ? 0x8a5a34 : PAL.dirt;
  const dark = kind === 'stone' ? PAL.stoneDark : kind === 'under' ? PAL.underDark : kind === 'wood' ? 0x5e3a1e : PAL.dirtDark;
  const light = kind === 'stone' ? PAL.stoneLight : kind === 'under' ? PAL.dirt : kind === 'wood' ? 0xa8713f : PAL.dirtLight;
  pc.rect(0, 0, T, h, base);
  // 벽돌 줄눈
  const off = Math.floor(r() * 8);
  for (let y = 4; y < h; y += 5) pc.hline(0, T - 1, y, dark);
  for (let row = 0; row * 5 < h; row++) {
    const x0 = (off + (row % 2) * 4) % 8;
    for (let x = x0; x < T; x += 8) pc.vline(x, row * 5, Math.min(h - 1, row * 5 + 3), dark);
  }
  // 윗줄 하이라이트
  pc.hline(0, T - 1, 0, light);
  if (top && kind !== 'stone' && kind !== 'wood') {
    // 풀이 앞면 위로 살짝 늘어짐
    for (let x = 0; x < T; x++) {
      const d = 1 + (r() < 0.3 ? 1 : 0);
      for (let y = 0; y < d; y++) pc.px(x, y, y === 0 ? PAL.lipLight : PAL.lip);
    }
  }
  return pc;
}

// 섬 밑바닥 들쭉날쭉한 흙 끝
function fringe(seed) {
  const r = rng(seed * 61 + 11);
  const pc = new PixelCanvas(T, 10);
  let x = 0;
  while (x < T) {
    const w = 2 + Math.floor(r() * 3);
    const len = 2 + Math.floor(r() * 7);
    for (let k = 0; k < w && x + k < T; k++) {
      const l = Math.max(1, len - Math.abs(k - (w - 1) / 2) * 2);
      for (let y = 0; y < l; y++) pc.px(x + k, y, y > l - 2 ? PAL.underDark : PAL.under);
    }
    x += w;
  }
  return pc;
}

// 높은 땅 아래 그림자 (반투명)
function shadowStrip(vertical = false) {
  const w = vertical ? 4 : T;
  const h = vertical ? T : 5;
  const pc = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = vertical ? x / 4 : y / 5;
      pc.px(x, y, 0x1d1b29, Math.round(70 * (1 - d)));
    }
  return pc;
}

// 섬 가장자리 테두리 선
function edgeLine(horizontal) {
  const pc = horizontal ? new PixelCanvas(T, 1) : new PixelCanvas(1, T);
  if (horizontal) pc.hline(0, T - 1, 0, PAL.grassEdge);
  else pc.vline(0, 0, T - 1, PAL.grassEdge);
  return pc;
}

function plankTop(seed) {
  const r = rng(seed * 89 + 17);
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, PAL.plank);
  for (let y = 0; y < T; y += 4) {
    pc.hline(0, T - 1, y + 3, PAL.plankDark);
    const cut = Math.floor(r() * T);
    pc.vline(cut, y, y + 2, PAL.plankDark);
    if (r() < 0.5) pc.px(Math.floor(r() * T), y + 1, PAL.plankLight);
  }
  return pc;
}

export const TOPS = { grass: grassTop, path: pathTop, stone: stoneTop, plank: plankTop };

export function registerTiles(atlas) {
  for (let v = 0; v < VARIANTS; v++) {
    for (const [name, fn] of Object.entries(TOPS)) atlas.add(`top_${name}_${v}`, fn(v + 1));
    atlas.add(`top_grassH_${v}`, grassTop(v + 1, true));
    for (const kind of ['dirt', 'stone', 'under', 'wood']) {
      atlas.add(`wall_${kind}_${LV}_${v}`, wallFace(v + 1, LV, kind, false));
      atlas.add(`wall_${kind}_${LV / 2}_${v}`, wallFace(v + 1, LV / 2, kind, false));
      atlas.add(`wallt_${kind}_${LV}_${v}`, wallFace(v + 1, LV, kind, true));
      atlas.add(`wallt_${kind}_${LV / 2}_${v}`, wallFace(v + 1, LV / 2, kind, true));
    }
    atlas.add(`fringe_${v}`, fringe(v + 1));
  }
  atlas.add('shade_strip', shadowStrip());
  atlas.add('shade_strip_v', shadowStrip(true));
  atlas.add('edge_h', edgeLine(true));
  atlas.add('edge_v', edgeLine(false));
}
