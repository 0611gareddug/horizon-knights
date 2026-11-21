// 제1장 초원 섬: 착륙 지점 → 전투 구역 4개(랜덤 템플릿, 랜덤 순서) → 보스 아레나
// 구역 사이는 나무 다리. 구역 하나에는 숨은 스위치로 열리는 비밀 방이 있다.
import { Terrain, MAT } from './terrain.js';
import { rng } from '../render/pixel.js';
import { computeBottoms } from './zones.js';

export const TEMPLATE_NAMES = {
  field: '풀밭',
  ruins: '옛 성터',
  hills: '언덕길',
  forest: '작은 숲',
  traps: '함정 길',
  camp: '고블린 야영지',
  gatehouse: '울타리 관문',
};

const CY = 12; // 다리 가운데 줄
const Y0 = 5; // 일반 구역 위쪽 줄
const CH = 16; // 일반 구역 높이

export function buildIsland1(seed = (Date.now() & 0xffff) + 1) {
  const r = rng(seed);
  const pick = Object.keys(TEMPLATE_NAMES).sort(() => r() - 0.5).slice(0, 4);
  const pieces = [{ type: 'landing', w: 12 }, ...pick.map((type) => ({ type, w: 20 })), { type: 'arena', w: 26 }];
  const BR = 4;
  const W = pieces.reduce((a, p) => a + p.w, 0) + BR * (pieces.length - 1) + 4;
  const H = 26;
  const t = new Terrain(W, H);
  const objects = [];
  const zones = [];

  const setCell = (i, j, h = 0, mat = MAT.grass) => {
    if (!t.inBounds(i, j)) return;
    t.top[t.idx(i, j)] = h;
    t.mat[t.idx(i, j)] = mat;
  };
  const exists = (i, j) => !t.isVoid(i, j);
  const prop = (type, i, j, v = 0, solid = true) => {
    if (!exists(i, j) || t.isSolid(i, j)) return false;
    t.props.push({ type, v, i, j });
    if (solid) t.solid[t.idx(i, j)] = 1;
    return true;
  };
  const obj = (o) => {
    objects.push(o);
    if (o.solid && exists(o.i, o.j)) t.solid[t.idx(o.i, o.j)] = 1;
    return o;
  };

  // ---------- 1) 모양 ----------
  let x = 2;
  pieces.forEach((pc, k) => {
    pc.x0 = x;
    pc.x1 = x + pc.w - 1;
    if (pc.type === 'arena') {
      const cx = x + pc.w / 2;
      for (let j = 0; j < H; j++)
        for (let i = x; i <= pc.x1; i++) {
          const d = Math.hypot(i + 0.5 - cx, (j + 0.5 - (CY + 0.5)) * 1.05);
          if (d < 11.6 + (r() - 0.5) * 0.8 || (i < x + 4 && Math.abs(j - CY) <= 2)) setCell(i, j);
        }
      pc.cx = cx;
    } else {
      const w = pc.w;
      const rad = 4;
      for (let v = 0; v < CH; v++)
        for (let u = 0; u < w; u++) {
          const dx = Math.max(0, Math.abs(u + 0.5 - w / 2) - (w / 2 - rad));
          const dy = Math.max(0, Math.abs(v + 0.5 - CH / 2) - (CH / 2 - rad));
          const keep = Math.hypot(dx, dy) <= rad + (r() - 0.6) * 1.4 || Math.abs(Y0 + v - CY) <= 2;
          if (keep) setCell(x + u, Y0 + v);
        }
    }
    x += pc.w;
    if (k < pieces.length - 1) {
      // 다리
      for (let i = x; i < x + BR; i++)
        for (let j = CY - 2; j <= CY + 2; j++) {
          setCell(i, j, 0, MAT.plank);
          if (j === CY - 2 || j === CY + 2) prop(j < CY ? 'railh' : 'railh', i, j);
        }
      x += BR;
    }
  });
  // 바다 위 섬처럼 바닥 깊이
  computeBottoms(t, seed, 7);
  for (let id = 0; id < W * H; id++) if (t.mat[id] === MAT.plank) t.bottom[id] = -1;

  // ---------- 2) 구역 내용 ----------
  const free = (i, j) => exists(i, j) && !t.isSolid(i, j) && Math.abs(j - CY) > 0 && !objects.some((o) => o.i === i && o.j === j);
  const randCell = (pc, cond = () => true, tries = 200) => {
    for (let n = 0; n < tries; n++) {
      const i = pc.x0 + 1 + Math.floor(r() * (pc.w - 2));
      const j = Y0 + 1 + Math.floor(r() * (CH - 2));
      if (free(i, j) && cond(i, j)) return [i, j];
    }
    return null;
  };
  const scatter = (pc, type, n, cond, solid = true, variants = 3) => {
    for (let k = 0; k < n; k++) {
      const c = randCell(pc, cond);
      if (c) prop(type, c[0], c[1], Math.floor(r() * variants), solid);
    }
  };
  const breakables = [];
  const addBreak = (pc, n, tex) => {
    for (let k = 0; k < n; k++) {
      const c = randCell(pc, (i, j) => Math.abs(j - CY) > 2);
      if (c) {
        breakables.push({ x: c[0] + 0.5, y: c[1] + 0.5, tex });
        objects.push({ type: 'reserved', i: c[0], j: c[1] });
      }
    }
  };
  const edgeish = (pc) => (i, j) => j < Y0 + 3 || j > Y0 + CH - 4 || i < pc.x0 + 3 || i > pc.x1 - 3;
  const inner = (pc) => (i, j) => i > pc.x0 + 3 && i < pc.x1 - 3;

  const T = {
    landing(pc) {
      prop('banner', pc.x0 + 2, CY - 3, 0);
      prop('banner', pc.x0 + 2, CY + 3, 1);
      scatter(pc, 'tree', 3, edgeish(pc), true, 4);
      scatter(pc, 'bush', 2, edgeish(pc));
    },
    field(pc) {
      scatter(pc, 'tree', 6, edgeish(pc), true, 4);
      scatter(pc, 'bush', 4, () => true);
      scatter(pc, 'rock', 3, inner(pc));
      addBreak(pc, 3, 'pot');
      addBreak(pc, 2, 'prop_crate_0');
    },
    ruins(pc) {
      for (let k = 0; k < 5; k++) {
        const cx = pc.x0 + 3 + Math.floor(r() * (pc.w - 6));
        const cy = Y0 + 2 + Math.floor(r() * (CH - 4));
        for (let a = -2; a <= 2; a++) for (let b = -1; b <= 1; b++) if (exists(cx + a, cy + b) && r() < 0.75) t.mat[t.idx(cx + a, cy + b)] = MAT.stone;
      }
      // 돌 단상
      const u0 = pc.x0 + 7;
      for (let i = u0; i < u0 + 6; i++) for (let j = Y0 + 2; j < Y0 + 5; j++) setCell(i, j, 1, MAT.stone);
      setCell(u0 + 2, Y0 + 5, 0.5, MAT.stone);
      setCell(u0 + 3, Y0 + 5, 0.5, MAT.stone);
      scatter(pc, 'rock', 6, inner(pc));
      addBreak(pc, 4, 'pot');
    },
    hills(pc) {
      for (let i = pc.x0 + 2; i <= pc.x1 - 2; i++) for (let j = Y0; j < Y0 + 5; j++) if (exists(i, j)) setCell(i, j, 1);
      const sx = pc.x0 + 9;
      setCell(sx, Y0 + 5, 0.5, MAT.stone);
      setCell(sx + 1, Y0 + 5, 0.5, MAT.stone);
      scatter(pc, 'tree', 4, (i, j) => j < Y0 + 2);
      scatter(pc, 'bush', 3, (i, j) => j > CY + 2);
      addBreak(pc, 3, 'pot');
      pc.high = true;
    },
    forest(pc) {
      for (let i = pc.x0 + 2; i <= pc.x1 - 2; i++)
        for (let j = Y0 + 1; j < Y0 + CH - 1; j++) {
          if (Math.abs(j - CY) <= 1 || !free(i, j)) continue;
          if (r() < 0.2) prop('tree', i, j, Math.floor(r() * 4));
          else if (r() < 0.05) prop('bush', i, j, Math.floor(r() * 3));
        }
      addBreak(pc, 2, 'prop_crate_0');
    },
    traps(pc) {
      for (let i = pc.x0 + 5; i <= pc.x1 - 5; i++)
        for (let j = CY - 4; j <= CY + 4; j++) {
          if (!exists(i, j) || (i + j) % 2) continue;
          obj({ type: 'spike', i, j, phase: ((i - pc.x0) * 0.35) % 2.4 });
        }
      for (const u of [4, 10, 15]) {
        const i = pc.x0 + u;
        let j = Y0;
        while (j < CY - 3 && !exists(i, j)) j++;
        if (exists(i, j)) obj({ type: 'launcher', i, j, solid: true, dx: 0, dy: 1, every: 2.6, offset: u * 0.3 });
      }
      scatter(pc, 'rock', 3, (i, j) => j > CY + 4);
    },
    camp(pc) {
      const tents = [
        [pc.x0 + 4, Y0 + 3],
        [pc.x0 + 15, Y0 + 3],
        [pc.x0 + 10, Y0 + 13],
      ];
      for (const [i, j] of tents) if (prop('tent', i, j)) for (const a of [-1, 1]) if (exists(i + a, j)) t.solid[t.idx(i + a, j)] = 1;
      obj({ type: 'campfire', i: pc.x0 + 10, j: CY - 3, solid: true });
      scatter(pc, 'barrel', 3, () => true, true, 1);
      addBreak(pc, 3, 'prop_crate_0');
      addBreak(pc, 2, 'pot');
    },
    gatehouse(pc) {
      const fx = pc.x0 + 12;
      for (let j = Y0; j < Y0 + CH; j++) {
        if (!exists(fx, j)) continue;
        if (Math.abs(j - CY) <= 1) obj({ type: 'door', i: fx, j, solid: true });
        else prop('fence', fx, j);
      }
      const side = r() < 0.5 ? Y0 + 2 : Y0 + CH - 3;
      const c = randCell(pc, (i, j) => i < fx - 3 && Math.abs(j - side) <= 1) || [pc.x0 + 5, side];
      obj({ type: 'plate', i: c[0], j: c[1] });
      scatter(pc, 'bush', 3, (i) => i > fx);
      addBreak(pc, 3, 'pot');
    },
    arena(pc) {
      const cx = pc.cx;
      for (let j = 0; j < H; j++)
        for (let i = pc.x0; i <= pc.x1; i++) {
          if (!exists(i, j)) continue;
          const d = Math.hypot(i + 0.5 - cx, (j + 0.5 - (CY + 0.5)) * 1.05);
          if (d >= 9.4 && d < 10.6) {
            if (Math.abs(j - CY) <= 1 && i < cx) obj({ type: 'gate', i, j, solid: false, zone: zones.length, role: 'in' });
            else obj({ type: 'rockwall', i, j, solid: true });
          }
        }
    },
  };

  pieces.forEach((pc, k) => {
    T[pc.type](pc);
    if (pc.type === 'landing') return;
    const z = {
      index: zones.length,
      type: pc.type,
      name: pc.type === 'arena' ? '보스 아레나' : TEMPLATE_NAMES[pc.type],
      x0: pc.x0,
      x1: pc.x1,
      boss: pc.type === 'arena',
      high: !!pc.high,
      cx: pc.cx,
      entry: { x: pc.x0 + 1.5, y: CY + 0.5 },
    };
    zones.push(z);
    if (pc.type !== 'arena') {
      for (let j = CY - 1; j <= CY + 1; j++) {
        obj({ type: 'gate', i: pc.x0, j, solid: false, zone: z.index, role: 'in' });
        obj({ type: 'gate', i: pc.x1, j, solid: true, zone: z.index, role: 'out' });
      }
    }
  });

  // ---------- 3) 비밀 방 ----------
  const sz = zones.filter((z) => !z.boss)[Math.floor(r() * 4)];
  {
    const pc = pieces.find((p) => p.x0 === sz.x0);
    const u0 = pc.x0 + 7;
    for (let i = u0; i < u0 + 6; i++) for (let j = 0; j < 4; j++) setCell(i, j, 0, MAT.grass);
    for (let j = 4; j <= Y0 + 1; j++) for (const i of [u0 + 2, u0 + 3]) setCell(i, j, sz.high ? (j >= Y0 ? 1 : 0) : 0, MAT.grass);
    // 높은 언덕 위라면 비밀 방도 높게
    if (sz.high) for (let i = u0; i < u0 + 6; i++) for (let j = 0; j <= Y0 + 1; j++) if (exists(i, j)) t.top[t.idx(i, j)] = 1;
    for (const i of [u0 + 2, u0 + 3]) {
      t.solid[t.idx(i, 4)] = 0;
      obj({ type: 'rockwall', i, j: 4, solid: true, secret: true });
    }
    obj({ type: 'chest', i: u0 + 2, j: 1, solid: true, secret: true });
    const sw = randCell(pc, (i, j) => (j < Y0 + 3 || j > Y0 + CH - 4) && !(i >= u0 && i < u0 + 6 && j < Y0 + 2) && t.topAt(i, j) === (sz.high && j < Y0 + 5 ? 1 : 0));
    if (sw) obj({ type: 'hswitch', i: sw[0], j: sw[1], solid: true });
    sz.secret = true;
    computeBottoms(t, seed + 7, 7);
    for (let id = 0; id < W * H; id++) if (t.mat[id] === MAT.plank) t.bottom[id] = -1;
  }

  // ---------- 4) 장식 ----------
  for (let n = 0; n < 260; n++) {
    const i = Math.floor(r() * W);
    const j = Math.floor(r() * H);
    if (!free(i, j) || t.mat[t.idx(i, j)] !== MAT.grass) continue;
    const type = r() < 0.45 ? 'flowers' : 'tuft';
    t.decals.push({ type, v: Math.floor(r() * 4), x: i + 0.2 + r() * 0.6, y: j + 0.2 + r() * 0.6 });
  }

  const land = pieces[0];
  t.spawn = { x: land.x0 + 4.5, y: CY + 0.5 };
  t.zones = zones;
  t.objects = objects.filter((o) => o.type !== 'reserved');
  t.breakables = breakables;
  t.seed = seed;
  return t;
}
