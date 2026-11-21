// 미니멀 픽셀 기사 (은빛 투구, 네모 눈, 단색 옷, 등에 멘 검)
// 방향: D(앞), U(뒤), R(옆), RL(옆 반전)
import { PixelCanvas } from '../render/pixel.js';

export const CHAR_W = 14;
export const CHAR_H = 16;
export const CHAR_AX = 7;
export const CHAR_AY = 16;
export const CHAR_ANIMS = { idle: 2, walk: 4, roll: 4 };

export const HERO_PALETTE = {
  o: 0x16141e, // 외곽선
  W: 0xf1f3f7, // 투구 하이라이트
  m: 0xc9cfda, // 투구
  M: 0x8f97a8, // 투구 그늘
  s: 0xf4c89e, // 피부
  n: 0xcf9470, // 피부 그늘
  e: 0x16141e, // 눈
  r: 0xe0524b, // 옷
  R: 0xa9343a, // 옷 그늘
  b: 0x6e4529, // 벨트
  g: 0xf2c94c, // 버클
  p: 0x3b3449, // 바지
  k: 0x4b3326, // 장화
  x: 0xe8ecf3, // 칼날
  X: 0x9b6a35, // 손잡이
};

const W = CHAR_W;

// ---------------- 앞 ----------------
const D_TOP = [
  '....oooooo....',
  '...oWmmmmMo...',
  '..oWmmmmmmMo..',
  '..oMMMMMMMMo..',
  '..oMssssssMo..',
  '..oMsessesMo..',
  '..oMsessesMo..',
  '...onssssno...',
  '....onnnno....',
  '..osrrrrrrso..',
  '..osrRrrRrso..',
  '...obbggbbo...',
  '...orRrrRro...',
];
// ---------------- 뒤 ----------------
const U_TOP = [
  '....oooooo....',
  '...oWmmmmMo...',
  '..oWmmmmmmMo..',
  '..oMmmmmmmMo..',
  '..oMmmmmmmMo..',
  '..oMmmmmmmMo..',
  '..oMMmmmmMMo..',
  '...oMMMMMMo...',
  '....onnnno....',
  '..osrrrrrbso..',
  '..osrrrrbrso..',
  '...obbbbbbo...',
  '...orrbrrro...',
];
// ---------------- 옆 (오른쪽) ----------------
const R_TOP = [
  '....ooooo.....',
  '...oWmmmmo....',
  '..oWmmmmmMo...',
  '..oMMMMMMMo...',
  '..oMmmMsssso..',
  '..oMmmMsseso..',
  '..oMmmMsseso..',
  '...oMMnssso...',
  '....onnnno....',
  '...orrrrro....',
  '...orrsrro....',
  '...obbbgbo....',
  '...orRrrRo....',
];

const LEGS = {
  N: ['...oppooppo...', '...okkookko...', '...oooooooo...'],
  L: ['...okkooppo...', '...ooooookko..', '........ooo...'],
  R: ['...oppookko...', '..okkooooooo..', '...ooo........'],
};
const LEGS_R = {
  N: ['....opppo.....', '....okkkko....', '....oooooo....'],
  L: ['...oppoppo....', '...okkookko...', '...oooooooo...'],
  R: ['.....oppo.....', '.....okkko....', '.....ooooo....'],
};

for (const rows of [D_TOP, U_TOP, R_TOP, ...Object.values(LEGS), ...Object.values(LEGS_R)])
  for (const r of rows) if (r.length !== W) throw new Error(`캐릭터 너비 오류: "${r}" (${r.length})`);

function stamp(pc, rows, oy, pal) {
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      if (ch !== '.') pc.px(x, oy + y, pal[ch]);
    }
}

// 등에 멘 검 (어깨 위로 손잡이와 칼끝이 보임)
function backSword(pc, pal, dir) {
  if (dir === 'D') {
    // 오른쪽 어깨 위로 손잡이
    pc.px(11, 6, pal.o);
    pc.px(12, 5, pal.o);
    pc.px(12, 6, pal.X);
    pc.px(13, 5, pal.o);
    pc.px(12, 4, pal.o);
  } else if (dir === 'U') {
    // 등에 대각선으로
    const pts = [[11, 5], [10, 6], [9, 7], [8, 8], [7, 9], [6, 10], [5, 11], [4, 12]];
    pts.forEach(([x, y], k) => pc.px(x, y, k < 2 ? pal.X : pal.x));
  } else {
    pc.px(1, 8, pal.X);
    pc.px(1, 9, pal.x);
    pc.px(1, 10, pal.x);
    pc.px(1, 11, pal.x);
    pc.px(1, 12, pal.x);
  }
}

function drawStand(pal, dir, legs, bob) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  const top = dir === 'D' ? D_TOP : dir === 'U' ? U_TOP : R_TOP;
  const legSet = dir === 'R' ? LEGS_R : LEGS;
  if (dir !== 'U') backSword(pc, pal, dir);
  stamp(pc, legSet[legs], 13 + 0, pal);
  stamp(pc, top, 0 + bob, pal);
  if (dir === 'U') backSword(pc, pal, dir);
  return pc;
}

function drawRoll(pal, i) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  const cx = 7;
  const cy = 11;
  pc.ellipse(cx, cy, 5, 4.6, pal.r);
  const a = (i / 4) * Math.PI * 2;
  pc.ellipse(cx + Math.cos(a) * 2, cy + Math.sin(a) * 1.8, 2.6, 2.6, pal.m);
  pc.px(Math.round(cx + Math.cos(a) * 2 - 1), Math.round(cy + Math.sin(a) * 1.8 - 1), pal.W);
  pc.ellipse(cx + Math.cos(a + Math.PI) * 2.2, cy + Math.sin(a + Math.PI) * 2, 1.6, 1.6, pal.k);
  pc.outline(pal.o);
  return pc;
}

export function drawCharFrame(pal, dir, anim, i) {
  if (anim === 'roll') return drawRoll(pal, i);
  if (anim === 'idle') return drawStand(pal, dir, 'N', i === 1 ? 1 : 0);
  return drawStand(pal, dir, ['L', 'N', 'R', 'N'][i], 0);
}

export function registerCharacter(atlas, prefix, pal = HERO_PALETTE) {
  for (const [anim, n] of Object.entries(CHAR_ANIMS))
    for (const dir of ['D', 'U', 'R'])
      for (let i = 0; i < n; i++) {
        const pc = drawCharFrame(pal, dir, anim, i);
        atlas.add(`${prefix}_${anim}_${dir}_${i}`, pc, CHAR_AX, CHAR_AY);
        if (dir === 'R') atlas.add(`${prefix}_${anim}_RL_${i}`, pc.flipX(), CHAR_W - CHAR_AX, CHAR_AY);
      }
}
