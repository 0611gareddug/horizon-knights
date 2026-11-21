// 전투용 그림: 무기, 투사체, 베기 궤적, 숫자, 슬라임, 허수아비, 스킬 아이콘
import { PixelCanvas, shade } from '../render/pixel.js';

const O = 0x16141e;

// ---------- 숫자 (3x5 + 외곽선) ----------
const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '!': ['1', '1', '1', '0', '1'],
};

function digit(ch) {
  const rows = DIGITS[ch];
  const w = rows[0].length;
  const pc = new PixelCanvas(w + 2, 7);
  rows.forEach((r, y) => [...r].forEach((b, x) => b === '1' && pc.px(x + 1, y + 1, 0xffffff)));
  pc.outline(O);
  return pc;
}

// ---------- 무기 (손에 쥐는 그림, 오른쪽을 향함, 손잡이가 왼쪽) ----------
function sword() {
  const pc = new PixelCanvas(15, 5);
  pc.hline(0, 2, 2, 0x8a5a2a); // 손잡이
  pc.vline(3, 0, 4, 0xe3b64a); // 가드
  pc.hline(4, 13, 2, 0xeef1f6);
  pc.hline(4, 12, 1, 0xc4ccd8);
  pc.hline(4, 12, 3, 0x9aa3b4);
  pc.px(14, 2, 0xeef1f6);
  pc.outline(O);
  return pc;
}
function bow() {
  const pc = new PixelCanvas(7, 15);
  const pts = [[1, 0], [2, 1], [3, 2], [3, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [3, 11], [3, 12], [2, 13], [1, 14]];
  for (const [x, y] of pts) {
    pc.px(x + 1, y, 0x9a6234);
    pc.px(x + 2, y, 0x74451f);
  }
  for (let y = 1; y < 14; y++) pc.px(1, y, 0xe9e2cf); // 시위
  pc.outline(O);
  return pc;
}
function staff() {
  const pc = new PixelCanvas(16, 7);
  pc.hline(0, 11, 3, 0x8a5a2a);
  pc.hline(0, 11, 4, 0x6a4220);
  pc.ellipse(13, 3.5, 2.6, 2.6, 0xffffff);
  pc.px(12, 2, 0xffffff);
  pc.outline(O);
  return pc;
}

// ---------- 투사체 ----------
function arrow(big) {
  const pc = new PixelCanvas(big ? 14 : 10, 5);
  const L = pc.w;
  pc.hline(1, L - 3, 2, 0xb07a44);
  pc.px(L - 2, 2, 0xe8ecf2);
  pc.px(L - 3, 1, 0xc4ccd8);
  pc.px(L - 3, 3, 0xc4ccd8);
  pc.px(0, 1, 0xffffff);
  pc.px(0, 3, 0xffffff);
  pc.px(1, 1, 0xf0f0f0);
  pc.px(1, 3, 0xf0f0f0);
  if (big) pc.hline(2, L - 4, 1, 0xfff1a8);
  pc.outline(O);
  return pc;
}
function orb(r) {
  const s = Math.ceil(r * 2) + 3;
  const pc = new PixelCanvas(s, s);
  pc.ellipse(s / 2, s / 2, r, r, 0xffffff);
  pc.outline(O);
  return pc;
}
// 베기 궤적 (오른쪽을 향한 반달)
function slash(rad) {
  const s = rad * 2 + 2;
  const pc = new PixelCanvas(s, s);
  const c = s / 2;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      if (Math.abs(a) > 1.15) continue;
      const thick = 3.2 * Math.cos(a * 1.2);
      if (d <= rad && d >= rad - thick) pc.px(x, y, d > rad - 1.2 ? 0xffffff : 0xdfe8ff);
    }
  return pc;
}
// 둥근 파동 (충격파)
function ring(r) {
  const s = r * 2 + 2;
  const pc = new PixelCanvas(s, s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - s / 2, y + 0.5 - s / 2);
      if (d <= r && d >= r - 2) pc.px(x, y, 0xffffff);
    }
  return pc;
}

// ---------- 슬라임 ----------
const SLIME = {
  green: { base: 0x6fd36a, light: 0xa9f08f, dark: 0x3f9a4c },
  red: { base: 0xe85c4f, light: 0xff9a7f, dark: 0xa8343a },
};
function slime(pal, squash) {
  const pc = new PixelCanvas(18, 13);
  const w = 7 + squash * 1.4;
  const h = 5.2 - squash * 1.2;
  const cy = 12 - h;
  pc.ellipse(9, cy + 0.5, w, h, pal.base);
  // 바닥 평평하게
  for (let x = Math.round(9 - w + 1); x < Math.round(9 + w - 1); x++) pc.px(x, 11, pal.dark);
  // 하이라이트
  pc.px(5, Math.round(cy - h * 0.45), pal.light);
  pc.px(6, Math.round(cy - h * 0.55), pal.light);
  pc.px(6, Math.round(cy - h * 0.35), pal.light);
  // 눈
  const ey = Math.round(cy - 0.5);
  pc.px(7, ey, O);
  pc.px(7, ey + 1, O);
  pc.px(11, ey, O);
  pc.px(11, ey + 1, O);
  pc.outline(O);
  return pc;
}

// ---------- 허수아비 ----------
function dummy() {
  const pc = new PixelCanvas(16, 22);
  pc.rect(7, 12, 2, 10, 0x8a5a2a);
  pc.rect(2, 9, 12, 2, 0x8a5a2a);
  pc.ellipse(8, 11, 4.5, 4, 0xe0c27a);
  pc.hline(4, 11, 12, 0xc9a65c);
  pc.ellipse(8, 5, 3.6, 3.6, 0xeed79c);
  pc.px(7, 4, O);
  pc.px(9, 4, O);
  pc.hline(4, 12, 2, 0x9a6234);
  pc.hline(5, 11, 1, 0x9a6234);
  pc.outline(O);
  return pc;
}

// ---------- 스킬 아이콘 (16x16) ----------
function icon(draw, bg) {
  const pc = new PixelCanvas(16, 16);
  if (bg !== null) {
    pc.rect(0, 0, 16, 16, bg);
    pc.hline(0, 15, 0, shade(bg, 1.25));
  }
  draw(pc);
  if (bg === null) pc.outline(0x16141e);
  return pc;
}
const ICONS = {
  slash: (pc) => {
    for (let k = 0; k < 9; k++) pc.px(3 + k, 12 - k, 0xffffff);
    for (let k = 0; k < 8; k++) pc.px(4 + k, 12 - k, 0xc4ccd8);
    pc.px(3, 11, 0xe3b64a);
    pc.px(4, 13, 0xe3b64a);
  },
  shield: (pc) => {
    pc.rect(4, 3, 8, 7, 0xc9cfda);
    for (let k = 0; k < 4; k++) pc.hline(4 + k, 11 - k, 10 + k, 0xc9cfda);
    pc.vline(8, 4, 12, 0xe3b64a);
    pc.hline(5, 11, 6, 0xe3b64a);
  },
  shout: (pc) => {
    pc.ellipse(6, 8, 3, 3, 0xf4c89e);
    for (const r of [5, 7]) for (let a = -0.7; a <= 0.7; a += 0.15) pc.px(Math.round(6 + Math.cos(a) * r), Math.round(8 + Math.sin(a) * r), 0xffe08a);
  },
  slam: (pc) => {
    pc.rect(3, 11, 10, 2, 0x9a6234);
    for (const [x, h] of [[4, 3], [7, 5], [10, 4]]) pc.rect(x, 11 - h, 2, h, 0xc9cfda);
  },
  fortress: (pc) => {
    pc.rect(3, 5, 10, 8, 0xffe08a);
    for (let x = 3; x < 13; x += 3) pc.rect(x, 3, 2, 2, 0xffe08a);
    pc.rect(7, 9, 2, 4, 0x6e4529);
  },
  arrow: (pc) => {
    for (let k = 0; k < 10; k++) pc.px(3 + k, 12 - k, 0xb07a44);
    pc.px(12, 3, 0xffffff);
    pc.px(13, 2, 0xffffff);
    pc.px(3, 11, 0xffffff);
    pc.px(2, 12, 0xffffff);
  },
  leap: (pc) => {
    for (let k = 0; k < 6; k++) pc.px(10 - k, 4 + k, 0xffffff);
    pc.hline(3, 8, 11, 0xffe08a);
    pc.hline(5, 10, 13, 0xffe08a);
  },
  mark: (pc) => {
    pc.ellipse(8, 8, 5, 5, 0xe0524b);
    pc.ellipse(8, 8, 3, 3, 0xffffff);
    pc.ellipse(8, 8, 1.2, 1.2, 0xe0524b);
  },
  rain: (pc) => {
    for (const x of [3, 7, 11]) for (let y = 2; y < 9; y++) pc.px(x + (y >> 2), y + (x % 2), 0xe9e2cf);
    pc.hline(2, 13, 12, 0x6fd36a);
  },
  snipe: (pc) => {
    pc.ellipse(8, 8, 5, 5, 0xffe08a);
    pc.ellipse(8, 8, 4, 4, 0x2a2140);
    pc.hline(2, 13, 8, 0xffe08a);
    pc.vline(8, 2, 13, 0xffe08a);
  },
  orb: (pc) => {
    pc.ellipse(8, 8, 4, 4, 0xffffff);
    pc.ellipse(8, 8, 2.5, 2.5, 0xffe08a);
  },
  bolt: (pc) => {
    pc.ellipse(9, 7, 4, 4, 0xff8a3d);
    for (let k = 0; k < 5; k++) pc.px(2 + k, 13 - k, 0xffd08a);
  },
  field: (pc) => {
    pc.ellipse(8, 10, 6, 3, 0x7ad0ff);
    pc.ellipse(8, 10, 4, 2, 0xd8f2ff);
  },
  blink: (pc) => {
    pc.ellipse(5, 8, 2, 4, 0xb48cff);
    pc.ellipse(11, 8, 2, 4, 0xffffff);
    pc.hline(6, 10, 8, 0xd8c4ff);
  },
  overload: (pc) => {
    pc.ellipse(5, 6, 2.5, 2.5, 0xff8a3d);
    pc.ellipse(11, 6, 2.5, 2.5, 0x7ad0ff);
    pc.ellipse(8, 11, 2.5, 2.5, 0xd59cff);
  },
  potion: (pc) => {
    pc.rect(6, 2, 4, 3, 0xd9c7a0);
    pc.ellipse(8, 10, 4.5, 4.5, 0xe0524b);
    pc.px(6, 8, 0xff9a8f);
    pc.px(6, 9, 0xff9a8f);
  },
  swap: (pc) => {
    pc.ellipse(5, 8, 2.5, 2.5, 0xff8a3d);
    pc.ellipse(11, 8, 2.5, 2.5, 0x7ad0ff);
    pc.hline(6, 10, 4, 0xffffff);
    pc.hline(6, 10, 12, 0xffffff);
  },
};

export function iconDataURL(name, bg = 0x3b2a20) {
  const pc = icon(ICONS[name], bg);
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.putImageData(pc.toImageData(ctx), 0, 0);
  return c.toDataURL();
}

export function registerFx(atlas) {
  for (const ch of Object.keys(DIGITS)) atlas.add(`dig_${ch}`, digit(ch));
  atlas.add('wpn_sword', sword(), 2, 2);
  atlas.add('wpn_bow', bow(), 2, 7);
  atlas.add('wpn_staff', staff(), 2, 3);
  atlas.add('arrow', arrow(false), 5, 2);
  atlas.add('arrow_big', arrow(true), 7, 2);
  atlas.add('orb_s', orb(2.5));
  atlas.add('orb_m', orb(3.5));
  atlas.add('orb_l', orb(5));
  atlas.add('slash', slash(14));
  atlas.add('slash_big', slash(20));
  atlas.add('ring', ring(12));
  for (const [name, pal] of Object.entries(SLIME))
    for (let s = 0; s < 4; s++) atlas.add(`slime_${name}_${s}`, slime(pal, [0, 0.5, 1, -0.6][s]), 9, 12);
  atlas.add('dummy', dummy(), 8, 21);
}
