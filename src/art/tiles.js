// 지형 블록 그림 생성
import { PixelCanvas, rng, shade, mix } from '../render/pixel.js';
import { drawIsoBox, topEdgeInfo } from './iso-draw.js';

export const VARIANTS = 4;

// 재질 팔레트
export const MATERIALS = {
  grass: {
    top: 0x6cbd45,
    topDark: 0x4f9b36,
    topLight: 0x92d65e,
    blade: 0xb2e872,
    side: 0x8b5a35,
    sideDark: 0x6a4228,
    sideLight: 0xa36d43,
    lip: 0x5aa33b,
    lipDark: 0x3f8030,
  },
  dirt: {
    top: 0x9b6a40,
    topDark: 0x7c522f,
    topLight: 0xb27e4f,
    side: 0x8b5a35,
    sideDark: 0x6a4228,
    sideLight: 0xa36d43,
  },
  path: {
    top: 0xcfb07c,
    topDark: 0xa98a5c,
    topLight: 0xe3c896,
    side: 0x8b5a35,
    sideDark: 0x6a4228,
    sideLight: 0xa36d43,
    lip: 0xb89a68,
    lipDark: 0x957a50,
  },
  stone: {
    top: 0x9a9ca6,
    topDark: 0x787a86,
    topLight: 0xb8bac2,
    side: 0x8a8c97,
    sideDark: 0x666876,
    sideLight: 0xa3a5ae,
  },
  under: {
    top: 0x7a5a40,
    topDark: 0x5e4432,
    topLight: 0x8e6a4c,
    side: 0x6e5040,
    sideDark: 0x4e3a30,
    sideLight: 0x84634c,
    rocky: true,
  },
};

function paintFor(mat, hpx, seed) {
  const r = rng(seed * 7919 + 13);
  const m = MATERIALS[mat];
  // 미리 무늬를 정해둔다 (같은 블록 안에서 일관되게)
  const topNoise = new Float32Array(32 * 16).map(() => r());
  const sideNoise = new Float32Array(32 * hpx).map(() => r());
  const lipDepth = new Uint8Array(32).map(() => 2 + Math.floor(r() * 2.2) + (r() < 0.18 ? 2 : 0));

  return (face, x, y, u, v) => {
    if (face === 'top') {
      const n = topNoise[v * 32 + x] ?? 0.5;
      const e = topEdgeInfo(32, x, y);
      let c = m.top;
      if (mat === 'grass') {
        if (n < 0.06) c = m.topDark;
        else if (n > 0.955) c = m.topLight;
        else if (n > 0.925 && v > 1) c = m.blade;
        else if (n < 0.16) c = mix(m.top, m.topDark, 0.4);
      } else if (mat === 'path') {
        if (n < 0.2) c = m.topDark;
        else if (n > 0.85) c = m.topLight;
      } else if (mat === 'stone') {
        if (n < 0.1) c = m.topDark;
        else if (n > 0.88) c = m.topLight;
        // 돌판 틈
        if ((x + v * 2) % 23 === 0) c = m.topDark;
      } else {
        if (n < 0.18) c = m.topDark;
        else if (n > 0.86) c = m.topLight;
      }
      // 돌은 판석 경계를 살짝 보여준다 (풀/흙은 이어져 보이도록 경계 없음)
      if (mat === 'stone' && e.isTopEdge) c = shade(c, 1.1);
      return c;
    }

    // 옆면
    const left = face === 'left';
    const n = sideNoise[v * 32 + x] ?? 0.5;
    let c = m.side;
    if (n < 0.16) c = m.sideDark;
    else if (n > 0.88) c = m.sideLight;
    if (m.rocky && (n > 0.7 && n < 0.76)) c = m.sideLight;
    // 풀/길 테두리가 옆면 위로 늘어짐
    if (m.lip && v < lipDepth[x]) c = v === lipDepth[x] - 1 ? m.lipDark : m.lip;
    // 아래쪽 경계선
    if (v === hpx - 1) c = shade(c, 0.82);
    // 앞쪽 세로 모서리 하이라이트
    if (left && x === 15) c = shade(c, 1.1);
    c = shade(c, left ? 0.86 : 0.66);
    return c;
  };
}

export function makeBlock(mat, hpx, variant) {
  const pc = new PixelCanvas(32, 16 + hpx);
  drawIsoBox(pc, 0, 0, 32, hpx, paintFor(mat, hpx, variant * 101 + hpx * 17 + mat.length * 3));
  return pc;
}

// 섬 아래쪽 바위 고드름 (바닥 블록 밑에 매달리는 장식)
export function makeStalactite(seed) {
  const r = rng(seed * 31 + 7);
  const pc = new PixelCanvas(32, 28);
  const base = MATERIALS.under;
  // 마름모 아래 가장자리에서 아래로 뾰족하게
  // 블록 아랫면 가장자리(마름모 아래쪽 선)를 따라 시작
  for (let x = 2; x < 30; x++) {
    const m = x < 16 ? x : 31 - x;
    const startY = m >> 1;
    const len = Math.max(0, Math.floor((m / 16) * 18 * (0.5 + r() * 0.7)) + (r() < 0.2 ? 5 : 0));
    for (let y = 0; y < len; y++) {
      const t = y / Math.max(1, len);
      let c = mix(base.side, base.sideDark, t);
      if (x >= 16) c = shade(c, 0.78);
      if (r() < 0.06) c = base.sideLight;
      pc.px(x, startY + y, c);
    }
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
