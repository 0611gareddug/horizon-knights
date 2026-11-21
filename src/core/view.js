// 탑다운(위에서 비스듬히 내려다보는) 좌표 변환
// 월드: x(오른쪽), y(아래쪽), z(높이). 칸 단위.
export const TILE = 16; // 칸 하나의 윗면 크기 (픽셀)
export const LEVEL = 10; // 높이 1층의 앞면 높이 (픽셀)

export function sx(x) {
  return x * TILE;
}

export function sy(y, z = 0) {
  return y * TILE - z * LEVEL;
}

// 이동 방향 -> 스프라이트 방향 이름
export function facingName(fx, fy) {
  if (Math.abs(fx) > Math.abs(fy) * 1.05) return fx > 0 ? 'R' : 'RL';
  return fy >= 0 ? 'D' : 'U';
}
