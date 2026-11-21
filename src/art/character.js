// 귀여운 플랫 픽셀 캐릭터 (큰 머리, 점 눈, 단색 + 그림자 한 단계, 어두운 외곽선)
// 방향: D(앞), U(뒤), R(옆), RL(옆 반전)
import { PixelCanvas } from '../render/pixel.js';

export const CHAR_W = 16;
export const CHAR_H = 21;
export const CHAR_AX = 8;
export const CHAR_AY = 20;
export const CHAR_ANIMS = { idle: 2, walk: 4, roll: 4 };
export const CHAR_DIRS = ['D', 'U', 'R', 'RL'];

export const HERO_PALETTE = {
  o: 0x1d1b29, // 외곽선
  h: 0x7a4a2c, // 머리카락
  H: 0x9c6640, // 머리카락 하이라이트
  d: 0x5c3520, // 머리카락 그늘
  s: 0xf6cfa6, // 피부
  S: 0xe0aa82, // 피부 그늘
  e: 0x1d1b29, // 눈
  r: 0x4f83dc, // 옷
  R: 0x3a64b4, // 옷 그늘
  g: 0xf2c94c, // 금장식
  m: 0xd5dce6, // 어깨 금속
  M: 0x9aa4b6, // 금속 그늘
  b: 0x7a4e2c, // 벨트
  c: 0xd94f4f, // 망토
  C: 0xa83a3a, // 망토 그늘
  p: 0x433c5a, // 바지
  k: 0x6b4428, // 장화
};

const W = CHAR_W;

// ---------------- 앞모습 ----------------
const HEAD_D = [
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhHHhhhhhho..',
  '..ohHhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhshhshhho..',
  '..ohssssssssho..',
  '..ohsessssesho..',
  '..ohsessssesho..',
  '..oSssssssssSo..',
  '...oSssssssSo...',
];
const BODY_D = [
  '...ommrggrmmo...',
  '..oMmrrggrrmMo..',
  '..osrrrggrrrso..',
  '..oobbbggbbboo..',
  '...oRrrrrrrRo...',
];
const LEGS = {
  N: ['....oppooppo....', '....okkookko....', '....oooooooo....'],
  L: ['....okkooppo....', '....oooookko....', '........oooo....'],
  R: ['....oppookko....', '....okkooooo....', '....oooo........'],
};

// ---------------- 뒷모습 ----------------
const HEAD_U = [
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhHHhhhhhho..',
  '..ohHhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..odhhhhhhhhdo..',
  '..oddhhhhhhddo..',
  '...oddddddddo...',
];
const BODY_U = [
  '...ommgccgmmo...',
  '..oMmcCccCcmMo..',
  '..oscCccCccCso..',
  '..oocCccCccCoo..',
  '...oCCccCCcCo...',
];

// ---------------- 옆모습 (오른쪽을 봄) ----------------
const HEAD_R = [
  '....ooooooo.....',
  '...ohhhhhhhoo...',
  '..ohhHHhhhhhho..',
  '..ohHhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhshho..',
  '..ohhhhSssssso..',
  '..ohhhhSssseso..',
  '..ohhhhSsssesso.',
  '..odhhhsssssSo..',
  '...oddoSsssSo...',
];
const BODY_R = [
  '....occmmggo....',
  '...oCcMmrrgro...',
  '...oCcrrrsrro...',
  '...oCcbbbgbbo...',
  '....oCRrrrRo....',
];
const LEGS_R = {
  N: ['.....oppppo.....', '.....okkkko.....', '.....oooooo.....'],
  L: ['....oppo.oppo...', '....okko.okkko..', '....oooo.ooooo..'],
  R: ['......opppo.....', '......okkkko....', '......oooooo....'],
};

function check(rows, name) {
  for (const r of rows) if (r.length !== W) throw new Error(`${name} 너비 오류: "${r}" (${r.length})`);
}
check(HEAD_D, 'HEAD_D');
check(BODY_D, 'BODY_D');
check(HEAD_U, 'HEAD_U');
check(BODY_U, 'BODY_U');
check(HEAD_R, 'HEAD_R');
check(BODY_R, 'BODY_R');
for (const v of Object.values(LEGS)) check(v, 'LEGS');
for (const v of Object.values(LEGS_R)) check(v, 'LEGS_R');

function stamp(pc, rows, oy, pal) {
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      pc.px(x, oy + y, pal[ch]);
    }
}

function drawStand(pal, dir, legs, headBob) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  const side = dir === 'R';
  const head = dir === 'D' ? HEAD_D : dir === 'U' ? HEAD_U : HEAD_R;
  const body = dir === 'D' ? BODY_D : dir === 'U' ? BODY_U : BODY_R;
  const legSet = side ? LEGS_R : LEGS;
  // 다리 -> 몸 -> 머리 순 (머리가 위에 겹침)
  stamp(pc, legSet[legs], 18, pal);
  stamp(pc, body, 13, pal);
  stamp(pc, head, 2 + headBob, pal);
  return pc;
}

function drawRoll(pal, i) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  const cx = 8;
  const cy = 14;
  pc.ellipse(cx, cy, 6, 5.5, pal.r);
  // 망토와 머리가 돌아가며 보임
  const a = (i / 4) * Math.PI * 2;
  pc.ellipse(cx + Math.cos(a) * 2.5, cy + Math.sin(a) * 2.2, 3, 3, pal.h);
  pc.ellipse(cx + Math.cos(a + Math.PI) * 2.5, cy + Math.sin(a + Math.PI) * 2.2, 2.5, 2.5, pal.c);
  pc.px(cx - 3, cy - 3, pal.H);
  pc.px(cx - 2, cy - 4, pal.H);
  pc.outline(pal.o);
  return pc;
}

export function drawCharFrame(pal, dir, anim, i) {
  if (anim === 'roll') return drawRoll(pal, i);
  if (anim === 'idle') return drawStand(pal, dir, 'N', i === 1 ? 1 : 0);
  // 걷기: 왼발 -> 모음 -> 오른발 -> 모음
  const legs = ['L', 'N', 'R', 'N'][i];
  return drawStand(pal, dir, legs, 0);
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

// 화면 8방향 -> 스프라이트 방향 (0=동, 1=남동, 2=남, 3=남서, 4=서, 5=북서, 6=북, 7=북동)
export const DIR8_TO_SPRITE = ['R', 'D', 'D', 'D', 'RL', 'U', 'U', 'U'];
