// 초원 몬스터, 보스, 함정, 상자, 동전, 파편 그림 (플랫 픽셀 + 외곽선)
import { PixelCanvas, shade } from '../render/pixel.js';

const O = 0x16141e;

// ---------------- 들개 (옆모습, 오른쪽을 봄) ----------------
function dog(frame, elite) {
  const pc = new PixelCanvas(20, 14);
  const fur = elite ? 0x7a6a8a : 0x9c7c5a;
  const dark = shade(fur, 0.72);
  const light = shade(fur, 1.25);
  const leg = [0, 1, 0, -1][frame] || 0;
  const bite = frame === 4;
  // 다리
  for (const [x, o] of [[5, leg], [7, -leg], [11, -leg], [13, leg]]) pc.rect(x, 9 + Math.max(0, o), 2, 3 - Math.max(0, o), x < 9 ? dark : fur);
  // 꼬리
  pc.px(2, 5, dark);
  pc.px(1, 4, dark);
  pc.px(3, 6, dark);
  // 몸
  pc.ellipse(9, 7.5, 6, 3.2, fur);
  pc.hline(5, 12, 10, light);
  // 머리
  const hx = bite ? 15.5 : 15;
  pc.ellipse(hx, 5, 3.4, 3, fur);
  pc.rect(Math.round(hx) + 2, bite ? 4 : 5, 3, 2, light);
  pc.px(Math.round(hx) + 4, bite ? 4 : 5, O);
  pc.px(Math.round(hx), 4, O);
  pc.px(Math.round(hx), 5, O);
  // 귀
  pc.px(Math.round(hx) - 2, 1, dark);
  pc.px(Math.round(hx) - 2, 2, dark);
  pc.px(Math.round(hx) - 1, 2, dark);
  if (bite) {
    pc.px(Math.round(hx) + 3, 6, 0xffffff);
    pc.px(Math.round(hx) + 2, 6, 0xffffff);
  }
  pc.outline(O);
  return pc;
}

// ---------------- 고블린 (앞모습) ----------------
const GOB = { skin: 0x82c34a, dark: 0x5a8f2f, vest: 0x8d6a4a, vestD: 0x6a4c32, pants: 0x4a3c30 };
function goblinBase(pc, frame, ox = 0, oy = 0, pal = GOB) {
  const b = frame === 1 ? 1 : 0;
  const P = (x, y, c) => pc.px(x + ox, y + oy, c);
  const R = (x, y, w, h, c) => pc.rect(x + ox, y + oy, w, h, c);
  // 다리
  R(5, 13, 2, 3, pal.pants);
  R(9, 13, 2, 3, pal.pants);
  // 몸
  R(4, 9 + b, 8, 5 - b, pal.vest);
  R(4, 9 + b, 2, 5 - b, pal.vestD);
  R(3, 10 + b, 1, 3, pal.skin);
  R(12, 10 + b, 1, 3, pal.skin);
  // 머리
  R(4, 2 + b, 8, 7, pal.skin);
  R(5, 1 + b, 6, 1, pal.skin);
  R(4, 8 + b, 8, 1, pal.dark);
  // 귀
  P(1, 4 + b, pal.skin);
  P(2, 4 + b, pal.skin);
  P(3, 4 + b, pal.skin);
  P(2, 5 + b, pal.dark);
  P(3, 5 + b, pal.skin);
  P(12, 4 + b, pal.skin);
  P(13, 4 + b, pal.skin);
  P(14, 4 + b, pal.skin);
  P(12, 5 + b, pal.skin);
  P(13, 5 + b, pal.dark);
  // 눈, 이빨
  P(6, 4 + b, O);
  P(6, 5 + b, 0xffd84a);
  P(9, 4 + b, O);
  P(9, 5 + b, 0xffd84a);
  P(7, 7 + b, 0xffffff);
  P(8, 7 + b, O);
  return b;
}
function goblin(kind, frame, elite) {
  const pc = new PixelCanvas(18, 18);
  const pal = elite ? { ...GOB, skin: 0x9a7ad8, dark: 0x6a4ea8 } : GOB;
  const ox = 1;
  const oy = 1;
  const b = goblinBase(pc, frame % 2, ox, oy, pal);
  const atk = frame >= 2;
  if (kind === 'thrower') {
    // 돌을 든 손
    const y = atk ? 2 : 9 + b;
    pc.ellipse(14 + ox, y + oy, 2, 2, 0x9a9ca6);
    pc.px(13 + ox, y + oy - 1, 0xc4c6ce);
  } else if (kind === 'shield') {
    // 둥근 나무 방패 (앞)
    pc.ellipse(8 + ox, 11 + oy, 5, 4.5, 0xa06a44);
    pc.ellipse(8 + ox, 11 + oy, 2, 2, 0x77492e);
    pc.vline(8 + ox, 7 + oy, 15 + oy, 0x77492e);
    pc.px(8 + ox, 11 + oy, 0xd8b45a);
    if (atk) pc.rect(12 + ox, 6 + oy, 2, 6, 0x6e4529);
  } else if (kind === 'shaman') {
    // 해골 가면과 나뭇잎 지팡이
    pc.rect(4 + ox, 1 + b + oy, 8, 3, 0xece3cf);
    pc.px(6 + ox, 2 + b + oy, O);
    pc.px(9 + ox, 2 + b + oy, O);
    pc.vline(14 + ox, 2 + oy, 15 + oy, 0x8a5a2a);
    pc.ellipse(14 + ox, 2 + oy, 2.2, 2.2, atk ? 0x9dff8a : 0x5fbf4b);
  } else if (kind === 'bomber') {
    // 빨간 두건 + 폭탄
    pc.rect(4 + ox, 1 + b + oy, 8, 2, 0xd94f4f);
    pc.px(3 + ox, 2 + b + oy, 0xd94f4f);
    pc.ellipse(13 + ox, 11 + oy, 3, 3, 0x2a2834);
    pc.px(12 + ox, 10 + oy, 0x6a6878);
    pc.px(14 + ox, 7 + oy, 0x8a5a2a);
    pc.px(15 + ox, 6 + oy, atk ? 0xffe066 : 0xff8a3d);
  }
  pc.outline(O);
  return pc;
}

// ---------------- 뿔멧돼지 (옆모습) ----------------
function boar(frame, scale = 1, opts = {}) {
  const W = Math.round(24 * scale);
  const H = Math.round(17 * scale) + (opts.rocks ? Math.round(10 * scale) : 0);
  const pc = new PixelCanvas(W, H);
  const s = scale;
  const top = opts.rocks ? Math.round(10 * s) : 0;
  const fur = opts.rage ? 0xa8503a : opts.elite ? 0x7a5a8a : 0x8d5a3c;
  const dark = shade(fur, 0.7);
  const light = shade(fur, 1.25);
  const leg = [0, 1, 0, -1, 0][frame] || 0;
  const charge = frame === 4;
  // 다리
  for (const [x, o] of [[6, leg], [9, -leg], [15, -leg], [18, leg]])
    pc.rect(Math.round(x * s), Math.round(top + (12 + Math.max(0, o)) * s), Math.max(2, Math.round(2 * s)), Math.round((4 - Math.max(0, o)) * s), dark);
  // 몸
  pc.ellipse(11 * s, top + 8.5 * s, 9 * s, 5 * s, fur);
  pc.ellipse(11 * s, top + 11 * s, 7 * s, 2 * s, light);
  // 등 갈기
  for (let x = 4; x < 17; x += 2) pc.px(Math.round(x * s), Math.round(top + 3.4 * s), dark);
  // 머리
  const hx = (charge ? 19.5 : 19) * s;
  pc.ellipse(hx, top + 9 * s, 4.2 * s, 4 * s, fur);
  pc.ellipse(hx + 3 * s, top + 10.5 * s, 1.8 * s, 1.6 * s, 0xd99a8a);
  pc.px(Math.round(hx + 3.5 * s), Math.round(top + 10 * s), O);
  // 눈
  if (opts.dizzy) {
    const ex = Math.round(hx - 0.5 * s);
    const ey = Math.round(top + 7.5 * s);
    pc.px(ex - 1, ey - 1, O);
    pc.px(ex + 1, ey + 1, O);
    pc.px(ex + 1, ey - 1, O);
    pc.px(ex - 1, ey + 1, O);
  } else {
    pc.px(Math.round(hx - 0.5 * s), Math.round(top + 7.5 * s), O);
    pc.px(Math.round(hx - 0.5 * s), Math.round(top + 8.5 * s), opts.rage ? 0xff4040 : O);
  }
  // 엄니
  for (let k = 0; k < Math.max(2, Math.round(3 * s)); k++) pc.px(Math.round(hx + 2 * s) + k, Math.round(top + 12 * s) - k, 0xf6f1e0);
  // 귀
  pc.px(Math.round(hx - 2 * s), Math.round(top + 4.5 * s), dark);
  pc.px(Math.round(hx - 2 * s), Math.round(top + 5.5 * s), dark);
  // 등 위 바위 (보스)
  if (opts.rocks) {
    const rocks = opts.broken
      ? [[8, 4, 3.2], [13, 5, 2.6]]
      : [[6, 5, 3.6], [11, 3, 4.6], [16, 5, 3.4], [9, 7, 2.6], [14, 7.5, 2.4]];
    for (const [rx, ry0, rr] of rocks) {
      const ry = ry0 - 3 + top / s;
      pc.ellipse(rx * s, ry * s, rr * s, rr * s * 0.85, 0x9aa0ac);
      pc.ellipse((rx - rr * 0.35) * s, (ry - rr * 0.35) * s, rr * 0.4 * s, rr * 0.35 * s, 0xc8ccd6);
      pc.px(Math.round((rx + rr * 0.4) * s), Math.round((ry + rr * 0.3) * s), 0x6c7280);
    }
  }
  pc.outline(O);
  return pc;
}

// ---------------- 투사체 ----------------
function rock() {
  const pc = new PixelCanvas(8, 8);
  pc.ellipse(4, 4, 3, 3, 0x9a9ca6);
  pc.px(3, 3, 0xc8ccd6);
  pc.outline(O);
  return pc;
}
function bombFlash() {
  const pc = new PixelCanvas(9, 9);
  pc.ellipse(4.5, 4.5, 3.5, 3.5, 0xffffff);
  return pc;
}

// ---------------- 함정, 장치, 물건 ----------------
function spike(up) {
  const pc = new PixelCanvas(16, 16);
  pc.rect(1, 1, 14, 14, 0x8f96a3);
  pc.rect(2, 2, 12, 12, 0x6c7280);
  for (const [x, y] of [[4, 4], [10, 4], [7, 7], [4, 10], [10, 10]]) {
    if (up) {
      pc.px(x, y - 2, 0xeef1f6);
      pc.px(x, y - 1, 0xd5dbe4);
      pc.px(x - 1, y, 0xaeb6c4);
      pc.px(x, y, 0xd5dbe4);
      pc.px(x + 1, y, 0x8f96a3);
    } else {
      pc.px(x, y, 0x2c2a36);
      pc.px(x + 1, y, 0x2c2a36);
    }
  }
  return pc;
}
function launcher() {
  const pc = new PixelCanvas(16, 22);
  pc.rect(1, 2, 14, 19, 0x9aa1ae);
  pc.rect(1, 2, 14, 4, 0xbcc2cc);
  pc.rect(5, 11, 6, 5, 0x2c2a36);
  pc.hline(1, 14, 20, 0x7c8392);
  pc.outline(O);
  return pc;
}
function gate(open) {
  const pc = new PixelCanvas(16, 22);
  if (open) {
    pc.rect(1, 17, 3, 4, 0x77492e);
    pc.rect(12, 16, 3, 5, 0x77492e);
    pc.rect(5, 19, 6, 2, 0xa06a44);
  } else {
    for (const x of [1, 6, 11]) {
      pc.rect(x, 3, 4, 18, 0xa06a44);
      pc.vline(x + 3, 3, 20, 0x77492e);
      pc.px(x + 1, 2, 0xa06a44);
      pc.px(x + 2, 2, 0xa06a44);
      pc.px(x + 1, 1, 0xa06a44);
    }
    pc.rect(0, 8, 16, 2, 0x6e4529);
    pc.rect(0, 15, 16, 2, 0x6e4529);
  }
  pc.outline(O);
  return pc;
}
function plate(pressed) {
  const pc = new PixelCanvas(16, 16);
  pc.rect(2, 2, 12, 12, 0x7c8392);
  pc.rect(3, pressed ? 4 : 3, 10, pressed ? 9 : 9, pressed ? 0x9aa1ae : 0xbcc2cc);
  pc.rect(6, pressed ? 7 : 6, 4, 3, pressed ? 0x7dff8a : 0xf2c94c);
  return pc;
}
function hiddenSwitch(lit) {
  const pc = new PixelCanvas(12, 12);
  pc.ellipse(6, 7, 5, 4.5, 0x9aa1ae);
  pc.ellipse(5, 5.5, 2, 1.5, 0xbcc2cc);
  // 희미한 문양
  pc.px(6, 7, lit ? 0x9df0ff : 0x868d9a);
  pc.px(7, 8, lit ? 0x9df0ff : 0x868d9a);
  pc.px(5, 8, lit ? 0x9df0ff : 0x868d9a);
  pc.outline(O);
  return pc;
}
function rockWall() {
  const pc = new PixelCanvas(16, 20);
  pc.ellipse(8, 12, 7.5, 7, 0x9aa0ac);
  pc.ellipse(5, 8, 4, 3.5, 0xbcc2cc);
  pc.px(11, 14, 0x6c7280);
  pc.px(12, 13, 0x6c7280);
  pc.outline(O);
  return pc;
}
function chest(open) {
  const pc = new PixelCanvas(18, 16);
  pc.rect(1, 6, 16, 9, 0xa06a44);
  pc.rect(1, 6, 16, 2, 0x77492e);
  pc.vline(1, 6, 14, 0x77492e);
  pc.vline(16, 6, 14, 0x77492e);
  if (open) {
    pc.rect(1, 1, 16, 4, 0x77492e);
    pc.rect(3, 5, 12, 2, 0xf2c94c);
    pc.px(5, 4, 0xfff1a8);
    pc.px(11, 4, 0xfff1a8);
  } else {
    pc.rect(1, 2, 16, 5, 0xc48a5a);
    pc.hline(1, 16, 2, 0xd8a06a);
    pc.rect(7, 5, 4, 4, 0xf2c94c);
    pc.px(8, 7, O);
  }
  pc.outline(O);
  return pc;
}
function pot() {
  const pc = new PixelCanvas(12, 13);
  pc.ellipse(6, 7.5, 5, 4.8, 0xc07a52);
  pc.rect(4, 1, 4, 3, 0xc07a52);
  pc.hline(3, 8, 1, 0x8f553a);
  pc.ellipse(4, 6, 1.4, 2, 0xe0a07a);
  pc.hline(2, 9, 9, 0x8f553a);
  pc.outline(O);
  return pc;
}
function tent() {
  const pc = new PixelCanvas(30, 24);
  for (let y = 0; y < 20; y++) {
    const w = Math.round((y / 20) * 14);
    pc.hline(15 - w, 15 + w, y + 2, y % 5 === 4 ? 0xa88a5a : 0xc9a86a);
    pc.px(15 + w, y + 2, 0x8f7348);
  }
  for (let y = 10; y < 22; y++) {
    const w = Math.round(((y - 10) / 12) * 4);
    pc.hline(15 - w, 15 + w, y, 0x3a2a1a);
  }
  pc.vline(15, 0, 3, 0x6e4529);
  pc.px(16, 0, 0xd94f4f);
  pc.px(17, 1, 0xd94f4f);
  pc.outline(O);
  return pc;
}
function coin(f) {
  const pc = new PixelCanvas(7, 7);
  const w = [3, 2, 1, 2][f];
  pc.ellipse(3.5, 3.5, w, 3, 0xf2c94c);
  if (w > 1) pc.vline(3, 2, 4, 0xfff1a8);
  pc.outline(0x8a5a10);
  return pc;
}
function shard() {
  const pc = new PixelCanvas(12, 18);
  const pts = [[6, 0], [10, 6], [8, 16], [4, 16], [2, 6]];
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 12; x++) {
      // 다각형 내부 판정
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) pc.px(x, y, x < 6 ? 0x9df0ff : 0x5ac8f0);
    }
  pc.vline(5, 3, 12, 0xffffff);
  pc.outline(0x1a4a6a);
  return pc;
}
function fireTile() {
  const pc = new PixelCanvas(12, 10);
  pc.ellipse(6, 6, 5, 3.5, 0xff8a3d);
  pc.ellipse(6, 5, 3, 2.5, 0xffd84a);
  return pc;
}

export function registerMonsters(atlas) {
  for (let f = 0; f < 5; f++) {
    atlas.add(`dog_${f}`, dog(f, false), 10, 12);
    atlas.add(`dogE_${f}`, dog(f, true), 10, 12);
  }
  for (const k of ['thrower', 'shield', 'shaman', 'bomber'])
    for (let f = 0; f < 4; f++) {
      atlas.add(`gob_${k}_${f}`, goblin(k, f, false), 9, 17);
      atlas.add(`gobE_${k}_${f}`, goblin(k, f, true), 9, 17);
    }
  for (let f = 0; f < 5; f++) {
    atlas.add(`boar_${f}`, boar(f, 1), 12, 16);
    atlas.add(`boarE_${f}`, boar(f, 1, { elite: true }), 12, 16);
  }
  atlas.add('boar_dizzy', boar(0, 1, { dizzy: true }), 12, 16);
  // 보스: 2배 크기, 등에 바위
  const B = 2;
  for (let f = 0; f < 5; f++) {
    atlas.add(`king_${f}`, boar(f, B, { rocks: true }), 24, 52);
    atlas.add(`kingB_${f}`, boar(f, B, { rocks: true, broken: true }), 24, 52);
    atlas.add(`kingR_${f}`, boar(f, B, { rocks: true, broken: true, rage: true }), 24, 52);
  }
  atlas.add('king_dizzy', boar(0, B, { rocks: true, broken: true, dizzy: true }), 24, 52);
  atlas.add('rock_proj', rock());
  atlas.add('flash9', bombFlash());
  atlas.add('spike_0', spike(false));
  atlas.add('spike_1', spike(true));
  atlas.add('launcher', launcher(), 8, 20);
  atlas.add('gate_0', gate(false), 8, 20);
  atlas.add('gate_1', gate(true), 8, 20);
  atlas.add('plate_0', plate(false));
  atlas.add('plate_1', plate(true));
  atlas.add('hswitch_0', hiddenSwitch(false), 6, 10);
  atlas.add('hswitch_1', hiddenSwitch(true), 6, 10);
  atlas.add('rockwall', rockWall(), 8, 18);
  atlas.add('chest_0', chest(false), 9, 14);
  atlas.add('chest_1', chest(true), 9, 14);
  atlas.add('pot', pot(), 6, 12);
  atlas.add('prop_tent_0', tent(), 15, 22);
  for (let f = 0; f < 4; f++) atlas.add(`coin_${f}`, coin(f), 3, 6);
  atlas.add('shard', shard(), 6, 16);
  atlas.add('fire_tile', fireTile(), 6, 6);
}
