// 아이소메트릭 상자(블록, 나뭇잎 덩어리, 바위 등)를 픽셀로 그리는 공용 함수
import { shade, mix } from '../render/pixel.js';

// w: 윗면 너비(4의 배수), sideH: 옆면 높이(px)
// paint(face, x, y, u, v) -> 색 (face: 'top' | 'left' | 'right', u/v: 면 안의 상대 좌표)
export function drawIsoBox(pc, ox, oy, w, sideH, paint) {
  const half = w / 2;
  const q = w / 4;
  for (let x = 0; x < w; x++) {
    const m = x < half ? x : w - 1 - x;
    const top = q - 1 - (m >> 1);
    const bot = q + (m >> 1);
    for (let y = top; y <= bot; y++) {
      const c = paint('top', x, y, x, y - top);
      if (c !== -1 && c !== undefined) pc.px(ox + x, oy + y, c);
    }
    const face = x < half ? 'left' : 'right';
    for (let s = 1; s <= sideH; s++) {
      const c = paint(face, x, bot + s, x < half ? x : x - half, s - 1);
      if (c !== -1 && c !== undefined) pc.px(ox + x, oy + bot + s, c);
    }
  }
}

// 윗면 테두리 위치 판단용
export function topEdgeInfo(w, x, y) {
  const half = w / 2;
  const q = w / 4;
  const m = x < half ? x : w - 1 - x;
  const top = q - 1 - (m >> 1);
  const bot = q + (m >> 1);
  return { top, bot, isTopEdge: y === top, isBotEdge: y === bot };
}

// 기본 3면 음영: 왼쪽 면은 조금 어둡게, 오른쪽 면은 더 어둡게 (빛은 왼쪽 위)
export function faceShade(face) {
  if (face === 'top') return 1;
  if (face === 'left') return 0.8;
  return 0.62;
}

export function tint(c, face) {
  return shade(c, faceShade(face));
}

export { shade, mix };
