// 아이소메트릭 좌표 변환
// 월드 좌표: x, y (바닥 평면, 칸 단위), z (높이, 블록 단위)
// 화면 좌표: 게임 픽셀

export const TILE_W = 32; // 윗면 마름모 너비
export const TILE_H = 16; // 윗면 마름모 높이
export const BLOCK_H = 16; // 블록 한 층 높이 (픽셀)
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export function toScreenX(x, y) {
  return (x - y) * HW;
}

export function toScreenY(x, y, z = 0) {
  return (x + y) * HH - z * BLOCK_H;
}

// 화면 방향 벡터 -> 월드 방향 벡터 (정규화)
export function screenDirToWorld(dx, dy) {
  const wx = dx / TILE_W + dy / TILE_H;
  const wy = dy / TILE_H - dx / TILE_W;
  const len = Math.hypot(wx, wy);
  if (len < 1e-6) return [0, 0];
  return [wx / len, wy / len];
}

// 월드 방향 -> 화면 방향 (정규화하지 않음)
export function worldDirToScreen(wx, wy) {
  return [(wx - wy) * HW, (wx + wy) * HH];
}

// 그리기 순서 키
// 같은 대각선(x+y) 안에서: 블록(아래->위) 다음에 캐릭터. 대각선이 클수록 앞.
// 맵 크기는 최대 64x64, 블록 높이 k는 -16..31 범위를 가정한다.
const DIAG = 4096;
export function blockDepth(i, j, k) {
  return (i + j) * DIAG + i * 48 + (k + 16);
}

export function entityDepth(x, y) {
  const diag = Math.floor(x) + Math.floor(y);
  const frac = x + y - diag; // 0..2
  return diag * DIAG + 3100 + frac * 400;
}

// 화면 8방향 인덱스: 0=동,1=남동,2=남,3=남서,4=서,5=북서,6=북,7=북동
export function dir8FromScreen(sx, sy) {
  const a = Math.atan2(sy, sx);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}
