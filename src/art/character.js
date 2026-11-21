// 2.5등신 픽셀 캐릭터 생성기
// 방향: D(앞), DR(앞-오른쪽), R(오른쪽), UR(뒤-오른쪽), U(뒤). 왼쪽 방향은 좌우 반전으로 만든다.
import { PixelCanvas, shade, mix } from '../render/pixel.js';

export const CHAR_W = 24;
export const CHAR_H = 32;
export const CHAR_AX = 12;
export const CHAR_AY = 29; // 발바닥 위치

export const DIRS = ['D', 'DR', 'R', 'UR', 'U'];
export const ANIMS = { idle: 4, walk: 6, roll: 5 };

export const DEFAULT_LOOK = {
  skin: 0xf3c9a0,
  hair: 0x6b3f24,
  eye: 0x3a6fd8,
  tunic: 0x3d6fc4,
  trim: 0xe8d48a,
  cape: 0xc23b3b,
  pants: 0x4a3c56,
  boots: 0x6a4228,
  belt: 0x5a3820,
  buckle: 0xf2c14e,
};

const OUTLINE = 0x24161a;

function headRows(front) {
  // 행별 [시작, 끝] (상대 x). front: 12칸 폭, side: 11칸 폭
  if (front)
    return [
      [2, 9], [1, 10], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [0, 11], [1, 10], [2, 9],
    ];
  return [[2, 8], [1, 9], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [1, 9], [2, 8]];
}

// ---------------- 머리 ----------------
function drawHead(pc, L, dir, hx, hy) {
  const front = dir !== 'R';
  const rows = headRows(front);
  const hairD = shade(L.hair, 0.72);
  const hairL = shade(L.hair, 1.25);
  const skinD = shade(L.skin, 0.86);
  for (let r = 0; r < rows.length; r++) {
    const [a, b] = rows[r];
    for (let x = a; x <= b; x++) {
      let c = L.hair;
      const rx = x;
      let isFace = false;
      if (dir === 'D') isFace = r >= 4 && rx >= 2 && rx <= 9;
      else if (dir === 'DR') isFace = r >= 4 && rx >= 3 && rx <= 10;
      else if (dir === 'R') isFace = r >= 4 && rx >= 5 && rx <= 10;
      else if (dir === 'UR') isFace = r >= 6 && r <= 9 && rx >= 10;
      else isFace = false;
      // 앞머리 (들쭉날쭉)
      if (isFace && r === 4) {
        if (dir === 'D') isFace = !(rx === 2 || rx === 3 || rx === 5 || rx === 8 || rx === 9);
        else if (dir === 'DR') isFace = !(rx === 3 || rx === 4 || rx === 6 || rx === 9);
        else if (dir === 'R') isFace = !(rx === 5 || rx === 6 || rx === 8);
      }
      if (isFace && r === 5 && dir === 'R' && rx === 5) isFace = false;
      if (isFace) {
        c = L.skin;
        if (r === 10 || rx === b) c = skinD;
      } else {
        if (r === 1 && rx >= 3 && rx <= 6) c = hairL;
        else if (r >= 8 || (rx === a && r > 2) || (rx === b && r > 2)) c = hairD;
      }
      pc.px(hx + x, hy + r, c);
    }
  }
  // 옆머리가 얼굴 옆으로 내려옴
  if (dir === 'D') {
    for (let r = 4; r <= 8; r++) {
      pc.px(hx + 0, hy + r, hairD);
      pc.px(hx + 1, hy + r, L.hair);
      pc.px(hx + 10, hy + r, L.hair);
      pc.px(hx + 11, hy + r, hairD);
    }
  } else if (dir === 'DR') {
    for (let r = 4; r <= 9; r++) {
      pc.px(hx + 0, hy + r, hairD);
      pc.px(hx + 1, hy + r, L.hair);
      pc.px(hx + 2, hy + r, L.hair);
    }
    pc.px(hx + 11, hy + 4, L.hair);
    pc.px(hx + 11, hy + 5, hairD);
  }
  // 얼굴
  const eyeDark = 0x24161a;
  if (dir === 'D') {
    for (const ex of [3, 8]) {
      pc.px(hx + ex, hy + 6, eyeDark);
      pc.px(hx + ex, hy + 7, L.eye);
    }
    pc.px(hx + 2, hy + 8, mix(L.skin, 0xf07a6a, 0.45));
    pc.px(hx + 9, hy + 8, mix(L.skin, 0xf07a6a, 0.45));
    pc.px(hx + 5, hy + 9, shade(L.skin, 0.7));
    pc.px(hx + 6, hy + 9, shade(L.skin, 0.7));
  } else if (dir === 'DR') {
    for (const ex of [5, 9]) {
      pc.px(hx + ex, hy + 6, eyeDark);
      pc.px(hx + ex, hy + 7, L.eye);
    }
    pc.px(hx + 4, hy + 8, mix(L.skin, 0xf07a6a, 0.45));
    pc.px(hx + 10, hy + 8, mix(L.skin, 0xf07a6a, 0.45));
    pc.px(hx + 7, hy + 9, shade(L.skin, 0.7));
  } else if (dir === 'R') {
    pc.px(hx + 8, hy + 6, eyeDark);
    pc.px(hx + 8, hy + 7, L.eye);
    pc.px(hx + 9, hy + 8, mix(L.skin, 0xf07a6a, 0.45));
    pc.px(hx + 10, hy + 9, shade(L.skin, 0.7));
    // 귀
    pc.px(hx + 4, hy + 7, shade(L.skin, 0.9));
    pc.px(hx + 4, hy + 8, shade(L.skin, 0.9));
  }
}

// ---------------- 몸 ----------------
function drawBody(pc, L, dir, f) {
  const { bx, by, armSwing, legA, legB, stride } = f;
  const tunicD = shade(L.tunic, 0.72);
  const tunicL = shade(L.tunic, 1.2);
  const capeD = shade(L.cape, 0.7);
  const pantsD = shade(L.pants, 0.75);
  const bootsD = shade(L.boots, 0.75);

  if (dir === 'D' || dir === 'DR') {
    const shift = dir === 'DR' ? 1 : 0;
    // 망토 (몸 뒤로 살짝 보임)
    for (let y = 0; y <= 7; y++) {
      pc.px(bx + 1 + shift, by + y, capeD);
      if (dir === 'D') pc.px(bx + 10, by + y, capeD);
    }
    // 다리
    drawLegFront(pc, L, bx + 3 + shift, by + 7, legA, pantsD, bootsD);
    drawLegFront(pc, L, bx + 7 + shift, by + 7, legB, pantsD, bootsD);
    // 몸통
    for (let y = 0; y <= 6; y++) {
      const x0 = y === 0 ? 2 : 3;
      const x1 = y === 0 ? 9 : 8;
      for (let x = x0; x <= x1; x++) {
        let c = L.tunic;
        if (x === x1) c = tunicD;
        else if (x === x0 + 1 && y > 0) c = tunicL;
        pc.px(bx + x + shift, by + y, c);
      }
    }
    // 옷깃, 벨트
    for (let x = 4; x <= 7; x++) pc.px(bx + x + shift, by, L.trim);
    for (let x = 3; x <= 8; x++) pc.px(bx + x + shift, by + 5, L.belt);
    pc.px(bx + 5 + shift, by + 5, L.buckle);
    pc.px(bx + 6 + shift, by + 5, L.buckle);
    // 팔
    const aL = armSwing;
    const aR = -armSwing;
    drawArmFront(pc, L, bx + 1 + shift, by + 1 + aL, tunicD);
    if (dir === 'D') drawArmFront(pc, L, bx + 9, by + 1 + aR, tunicD);
    else drawArmFront(pc, L, bx + 10, by + 1 + aR, tunicD);
  } else if (dir === 'R') {
    // 망토 (뒤쪽으로 펄럭)
    for (let y = 0; y <= 8; y++) {
      pc.px(bx + 2, by + y, L.cape);
      if (y > 2) pc.px(bx + 1, by + y, capeD);
    }
    // 다리: 뒷다리 먼저
    drawLegSide(pc, L, bx + 4 - stride, by + 7, legB, true);
    drawLegSide(pc, L, bx + 5 + stride, by + 7, legA, false);
    // 몸통
    for (let y = 0; y <= 6; y++)
      for (let x = 3; x <= 8; x++) {
        let c = L.tunic;
        if (x === 3) c = tunicD;
        if (x === 8 && y > 0) c = tunicL;
        pc.px(bx + x, by + y, c);
      }
    for (let x = 6; x <= 8; x++) pc.px(bx + x, by, L.trim);
    for (let x = 3; x <= 8; x++) pc.px(bx + x, by + 5, L.belt);
    pc.px(bx + 8, by + 5, L.buckle);
    // 팔 (앞쪽)
    const ax = bx + 5 + Math.round(armSwing * 1.5);
    for (let y = 1; y <= 4; y++) {
      pc.px(ax, by + y, tunicD);
      pc.px(ax + 1, by + y, L.tunic);
    }
    pc.px(ax, by + 5, L.skin);
    pc.px(ax + 1, by + 5, shade(L.skin, 0.88));
  } else {
    // 뒤쪽 (U, UR): 망토가 몸을 덮음
    const shift = dir === 'UR' ? 1 : 0;
    drawLegFront(pc, L, bx + 3 + shift, by + 7, legA, pantsD, bootsD);
    drawLegFront(pc, L, bx + 7 + shift, by + 7, legB, pantsD, bootsD);
    // 팔
    drawArmFront(pc, L, bx + 1 + shift, by + 1 - armSwing, tunicD);
    drawArmFront(pc, L, bx + 9 + shift + (dir === 'UR' ? 1 : 0), by + 1 + armSwing, tunicD);
    // 망토
    for (let y = 0; y <= 8; y++) {
      const x0 = y < 2 ? 3 : 2;
      const x1 = y < 2 ? 8 : 9;
      for (let x = x0; x <= x1; x++) {
        let c = L.cape;
        if (x === x1 || (x - x0) % 3 === 2) c = capeD;
        if (y === 8 && (x % 2 === 0)) continue;
        pc.px(bx + x + shift, by + y, c);
      }
    }
    for (let x = 3; x <= 8; x++) pc.px(bx + x + shift, by, shade(L.cape, 1.15));
  }
}

function drawArmFront(pc, L, x, y, sleeve) {
  for (let i = 0; i < 4; i++) {
    pc.px(x, y + i, sleeve);
    pc.px(x + 1, y + i, L.tunic);
  }
  pc.px(x, y + 4, shade(L.skin, 0.9));
  pc.px(x + 1, y + 4, L.skin);
}

function drawLegFront(pc, L, x, y, lift, pantsD, bootsD) {
  const len = 5 - lift;
  for (let i = 0; i < len; i++) {
    const yy = y + i;
    const isBoot = i >= len - 2;
    pc.px(x, yy, isBoot ? bootsD : pantsD);
    pc.px(x + 1, yy, isBoot ? L.boots : L.pants);
  }
  // 발끝
  pc.px(x - 0, y + len, bootsD);
  pc.px(x + 1, y + len, bootsD);
}

function drawLegSide(pc, L, x, y, lift, back) {
  const len = 5 - lift;
  const pants = back ? shade(L.pants, 0.75) : L.pants;
  const boots = back ? shade(L.boots, 0.75) : L.boots;
  for (let i = 0; i < len; i++) {
    const isBoot = i >= len - 2;
    pc.px(x, y + i, isBoot ? boots : pants);
    pc.px(x + 1, y + i, isBoot ? boots : pants);
  }
  pc.px(x, y + len, shade(boots, 0.8));
  pc.px(x + 1, y + len, shade(boots, 0.8));
  pc.px(x + 2, y + len, shade(boots, 0.8)); // 발끝은 앞으로
}

// ---------------- 프레임 ----------------
function frameParams(anim, i) {
  if (anim === 'idle') {
    const bob = [0, 0, 1, 1][i];
    return { bob, armSwing: 0, legA: 0, legB: 0, stride: 0 };
  }
  // 걷기 6프레임
  const p = (i / 6) * Math.PI * 2;
  const s = Math.sin(p);
  return {
    bob: Math.abs(Math.cos(p)) > 0.7 ? 0 : -1,
    armSwing: s > 0.3 ? 1 : s < -0.3 ? -1 : 0,
    legA: s > 0.3 ? 1 : 0,
    legB: s < -0.3 ? 1 : 0,
    stride: Math.round(Math.cos(p) * 2),
  };
}

export function drawCharFrame(L, dir, anim, i) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  if (anim === 'roll') return drawRoll(L, dir, i);
  const fp = frameParams(anim, i);
  const headX = dir === 'R' ? 7 : 6;
  const headY = 5 + fp.bob;
  const bx = 6;
  const by = 16 + fp.bob;
  const back = dir === 'U' || dir === 'UR';
  if (back) {
    drawBody(pc, L, dir, { bx, by, ...fp });
    drawHead(pc, L, dir, headX, headY);
  } else {
    drawBody(pc, L, dir, { bx, by, ...fp });
    drawHead(pc, L, dir, headX, headY);
  }
  pc.outline(OUTLINE);
  return pc;
}

function drawRoll(L, dir, i) {
  const pc = new PixelCanvas(CHAR_W, CHAR_H);
  const cx = 12;
  const cy = 22;
  const squash = i === 0 || i === 4 ? 1 : 0;
  pc.ellipse(cx, cy + squash, 7, 7 - squash, L.tunic);
  // 망토 띠
  const ang = (i / 5) * Math.PI * 2 + (dir === 'U' || dir === 'UR' ? Math.PI : 0);
  for (let t = -0.9; t <= 0.9; t += 0.08) {
    const a = ang + t;
    for (let rr = 3; rr <= 7; rr++) {
      const x = Math.round(cx + Math.cos(a) * rr - 0.5);
      const y = Math.round(cy + squash + Math.sin(a) * (rr - squash) - 0.5);
      if (pc.get(x, y) !== -1) pc.px(x, y, rr > 5 ? shade(L.cape, 0.8) : L.cape);
    }
  }
  // 머리카락 덩어리
  const ha = ang + Math.PI * 0.85;
  pc.ellipse(cx + Math.cos(ha) * 3.5, cy + squash + Math.sin(ha) * 3.5, 3.2, 3.2, L.hair);
  // 하이라이트
  pc.px(cx - 3, cy - 4 + squash, shade(L.tunic, 1.3));
  pc.px(cx - 2, cy - 5 + squash, shade(L.tunic, 1.3));
  pc.outline(OUTLINE);
  return pc;
}

// 모든 프레임을 아틀라스에 등록. 이름: `${prefix}_${anim}_${dir}_${i}` (왼쪽 방향은 'L' 접미어)
export function registerCharacter(atlas, prefix, look = DEFAULT_LOOK) {
  for (const [anim, count] of Object.entries(ANIMS)) {
    for (const dir of DIRS) {
      for (let i = 0; i < count; i++) {
        const pc = drawCharFrame(look, dir, anim, i);
        atlas.add(`${prefix}_${anim}_${dir}_${i}`, pc, CHAR_AX, CHAR_AY);
        if (dir !== 'D' && dir !== 'U') atlas.add(`${prefix}_${anim}_${dir}L_${i}`, pc.flipX(), CHAR_W - CHAR_AX, CHAR_AY);
      }
    }
  }
}

// 화면 8방향 인덱스 -> 스프라이트 방향 이름
// 0=동,1=남동,2=남,3=남서,4=서,5=북서,6=북,7=북동
export const DIR8_TO_SPRITE = ['R', 'DR', 'D', 'DRL', 'RL', 'URL', 'U', 'UR'];
