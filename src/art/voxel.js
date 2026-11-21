// 복셀 모델 -> 쿼터뷰 픽셀 스프라이트 렌더러
// 파츠(상자)마다 회전/이동을 주고, 화면 픽셀마다 광선을 쏴서 가장 앞에 보이는 면을 찾는다.
// 지형과 같은 투영: 화면 x = (x - y), 화면 y = (x + y) / 2 - z   (1복셀 = 1픽셀, 지형 1칸 = 16복셀)
import { PixelCanvas, shade, mix } from '../render/pixel.js';

// 3x3 회전 행렬 유틸
function rotZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function rotY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function apply(m, v) {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
function transpose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const Rot = { rotX, rotY, rotZ, mul, I3 };

// 파츠 정의:
// { name, size:[sx,sy,sz], pivot:[px,py,pz] (파츠 안의 회전 중심, 복셀 단위),
//   at:[x,y,z] (부모 좌표계에서 pivot 위치), parent, color(ix,iy,iz,face) }
// face: 'px','nx','py','ny','pz','nz'  (모델 기준 +x = 앞, +y = 왼쪽, +z = 위)
// pose: { [name]: 회전행렬 } , root: { yaw, pitch, offset:[x,y,z] }

function resolve(parts, pose, root) {
  const byName = new Map(parts.map((p) => [p.name, p]));
  const cache = new Map();
  const rootR = mul(rotZ(root.yaw || 0), root.pitchR || I3);
  const rootT = root.offset || [0, 0, 0];
  const world = (p) => {
    if (cache.has(p.name)) return cache.get(p.name);
    let R;
    let T;
    const local = pose[p.name] || I3;
    if (p.parent) {
      const par = world(byName.get(p.parent));
      // 부모 좌표계에서 at 위치 = 부모 원점 기준 좌표
      R = mul(par.R, local);
      const at = apply(par.R, p.at);
      T = [par.T[0] + at[0], par.T[1] + at[1], par.T[2] + at[2]];
    } else {
      R = mul(rootR, local);
      const at = apply(rootR, p.at);
      T = [rootT[0] + at[0], rootT[1] + at[1], rootT[2] + at[2]];
    }
    // T: pivot의 월드 위치. 파츠 원점(0,0,0 모서리)은 T - R*pivot
    const pv = apply(R, p.pivot);
    const res = { R, T, O: [T[0] - pv[0], T[1] - pv[1], T[2] - pv[2]], Rt: transpose(R), p };
    cache.set(p.name, res);
    return res;
  };
  return parts.map(world);
}

const FACE_N = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

// 빛: 윗면 1.0, 화면 왼쪽(+y) 0.82, 화면 오른쪽(+x) 0.62  — 지형 블록과 동일
function lightFor(n) {
  const x = Math.max(0, n[0]);
  const y = Math.max(0, n[1]);
  const z = Math.max(0, n[2]);
  const s = x * x + y * y + z * z;
  if (s < 1e-6) return 0.5;
  return (0.64 * x * x + 0.84 * y * y + 1.0 * z * z) / s;
}

export function renderVoxel(parts, pose, root, W, H, ox, oy, { outline = 0x1b1216 } = {}) {
  const res = resolve(parts, pose, root);
  const pc = new PixelCanvas(W, H);
  const depth = new Float32Array(W * H).fill(-1e9);
  const pid = new Int16Array(W * H).fill(-1);
  const d = [1, 1, 1]; // 카메라 쪽 방향
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const sx = px + 0.5 - ox;
      const sy = py + 0.5 - oy;
      // z=0 평면 위의 점
      const P0 = [sy + sx / 2, sy - sx / 2, 0];
      let best = -1e9;
      let bestC = -1;
      let bestPart = -1;
      for (let k = 0; k < res.length; k++) {
        const r = res[k];
        const [a, b, c] = r.p.size;
        // 로컬 좌표로 변환
        const rel = [P0[0] - r.O[0], P0[1] - r.O[1], P0[2] - r.O[2]];
        const o = apply(r.Rt, rel);
        const v = apply(r.Rt, d);
        let t0 = -1e9;
        let t1 = 1e9;
        let exitAxis = -1;
        let exitSign = 0;
        const lo = [0, 0, 0];
        const hi = [a, b, c];
        let miss = false;
        for (let ax = 0; ax < 3; ax++) {
          if (Math.abs(v[ax]) < 1e-9) {
            if (o[ax] < lo[ax] || o[ax] > hi[ax]) {
              miss = true;
              break;
            }
            continue;
          }
          let ta = (lo[ax] - o[ax]) / v[ax];
          let tb = (hi[ax] - o[ax]) / v[ax];
          let sign = -1; // tb에서 나가면 hi 면(+)
          if (ta > tb) {
            const tmp = ta;
            ta = tb;
            tb = tmp;
            sign = 1;
          } else sign = 1;
          // 나가는 면: 진행 방향 v의 부호에 따라
          if (ta > t0) t0 = ta;
          if (tb < t1) {
            t1 = tb;
            exitAxis = ax;
            exitSign = v[ax] > 0 ? 1 : -1;
          }
          void sign;
        }
        if (miss || t0 > t1 || t1 <= best) continue;
        // 카메라에 가장 가까운 점 = t1 (광선이 +d 쪽으로 나가는 곳)
        const hit = [o[0] + v[0] * (t1 - 1e-4), o[1] + v[1] * (t1 - 1e-4), o[2] + v[2] * (t1 - 1e-4)];
        const ix = Math.min(a - 1, Math.max(0, Math.floor(hit[0])));
        const iy = Math.min(b - 1, Math.max(0, Math.floor(hit[1])));
        const iz = Math.min(c - 1, Math.max(0, Math.floor(hit[2])));
        const face = ['x', 'y', 'z'][exitAxis];
        const faceName = (exitSign > 0 ? 'p' : 'n') + face;
        const col = r.p.color(ix, iy, iz, faceName);
        if (col === -1 || col === undefined) continue;
        const wn = apply(r.R, FACE_N[faceName]);
        let cc = shade(col, lightFor(wn));
        // 파츠 모서리 살짝 어둡게 (블록 느낌)
        const u = [hit[0], hit[1], hit[2]];
        const edge =
          (exitAxis !== 0 && (u[0] < 0.6 || u[0] > a - 0.6) ? 1 : 0) +
          (exitAxis !== 1 && (u[1] < 0.6 || u[1] > b - 0.6) ? 1 : 0) +
          (exitAxis !== 2 && (u[2] < 0.6 || u[2] > c - 0.6) ? 1 : 0);
        if (edge && r.p.edge !== false) cc = shade(cc, 0.93);
        best = t1;
        bestC = cc;
        bestPart = k;
      }
      if (bestC !== -1) {
        pc.px(px, py, bestC);
        depth[py * W + px] = best;
        pid[py * W + px] = bestPart;
      }
    }
  }
  // 파츠 경계에서 뒤에 있는 쪽을 어둡게 (깊이감)
  const out = pc.data.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (pid[i] < 0) continue;
      let dark = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (pid[j] >= 0 && pid[j] !== pid[i] && depth[j] > depth[i] + 1.2) dark = true;
      }
      if (dark) out[i] = shade(pc.data[i], 0.78);
    }
  pc.data.set(out);
  if (outline !== null) pc.outline(outline, { darken: 0.35 });
  return pc;
}

export { mix };
