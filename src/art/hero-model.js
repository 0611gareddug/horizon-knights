// 수습 기사단원 복셀 모델 (오리지널 디자인)
// 모델 좌표: +x = 앞, +y = 왼쪽, +z = 위. 원점 = 두 발 사이 바닥.
import { renderVoxel, Rot } from './voxel.js';
import { shade } from '../render/pixel.js';

const { rotY, rotX, mul, I3 } = Rot;

export const HERO_W = 44;
export const HERO_H = 64;
export const HERO_AX = 22;
export const HERO_AY = 52;
export const HERO_ANIMS = { idle: 4, walk: 8, roll: 6 };
export const YAWS = 8;

export const HERO_LOOK = {
  skin: 0xe9b58c,
  skinDark: 0xc98d6a,
  hair: 0x5b3420,
  hairDark: 0x43251a,
  eye: 0x2d58b8,
  tunic: 0x3a6cc0,
  tunicDark: 0x2b5299,
  trim: 0xe2b84c,
  metal: 0xa4aec0,
  metalDark: 0x7d879b,
  belt: 0x5a3a22,
  buckle: 0xf3c94f,
  pants: 0x3b3547,
  boots: 0x6b4426,
  bootCuff: 0x8a5a34,
  cape: 0xbd3535,
  capeDark: 0x8f2626,
  blade: 0xcdd6e2,
  bladeEdge: 0xf2f6fb,
  guard: 0xc9962f,
  grip: 0x4e321e,
};

function buildParts(L) {
  const head = {
    name: 'head',
    parent: 'torso',
    size: [8, 8, 8],
    pivot: [4, 4, 0],
    at: [0, 0, 10],
    color(x, y, z, f) {
      if (f === 'pz') return (x + y) % 5 === 0 ? L.hairDark : L.hair;
      if (f === 'nz') return L.skinDark;
      if (f === 'nx') return z < 1 ? L.hairDark : (y + z) % 4 === 0 ? L.hairDark : L.hair;
      if (f === 'px') {
        if (z === 7) return L.hair;
        if (z === 6) return y === 0 || y === 1 || y === 3 || y === 7 ? L.hair : L.skin; // 앞머리
        // 눈썹
        if (z === 5) return (y >= 1 && y <= 2) || (y >= 5 && y <= 6) ? L.hairDark : L.skin;
        if (z === 4) return y === 0 || y === 7 ? L.hair : L.skin;
        // 눈: 바깥 흰자, 안쪽 눈동자
        if (z === 3) {
          if (y === 1 || y === 6) return 0xf4f2ee;
          if (y === 2 || y === 5) return L.eye;
          return L.skin;
        }
        if (z === 1 && (y === 3 || y === 4)) return L.skinDark;
        if (y === 0 || y === 7) return z >= 2 ? L.hair : L.skin; // 옆머리
        return L.skin;
      }
      // 옆면
      if (z >= 6) return L.hair;
      if (x <= 2) return z >= 1 ? L.hair : L.hairDark;
      if (x === 3 && z >= 3) return L.hair;
      if (x >= 6 && z === 5) return L.hair; // 구레나룻
      if (x >= 4 && x <= 5 && z >= 2 && z <= 3) return L.skinDark; // 귀
      return L.skin;
    },
  };

  const torso = {
    name: 'torso',
    size: [4, 8, 10],
    pivot: [2, 4, 0],
    at: [0, 0, 9],
    color(x, y, z, f) {
      if (f === 'pz') return y <= 1 || y >= 6 ? L.metal : L.tunicDark;
      if (z >= 2 && z <= 3) {
        if (f === 'px' && z === 3 && (y === 3 || y === 4)) return L.buckle;
        if (f === 'px' && z === 2 && (y === 3 || y === 4)) return shade(L.buckle, 0.8);
        return L.belt;
      }
      if (f === 'px') {
        if (z === 9 && y >= 2 && y <= 5) return L.trim; // 옷깃
        if (z >= 4 && (y === 3 || y === 4)) return z % 2 ? L.trim : shade(L.trim, 0.9); // 가운데 장식
        if (z < 2) return L.tunicDark;
        return (y + z) % 3 === 0 ? L.tunicDark : L.tunic; // 누비 무늬
      }
      if (z < 2) return L.tunicDark;
      return z % 3 === 0 ? L.tunicDark : L.tunic;
    },
  };

  const arm = (side) => ({
    name: side > 0 ? 'armL' : 'armR',
    parent: 'torso',
    size: [4, 3, 10],
    pivot: [2, 1.5, 10],
    at: [0, side * 5.5, 10],
    color(x, y, z, f) {
      if (z >= 7) {
        // 어깨 보호대
        if (f === 'pz') return L.metal;
        return z === 7 ? L.metalDark : L.metal;
      }
      if (z <= 2) return z === 2 ? shade(L.boots, 1.1) : L.boots; // 장갑
      return z === 3 ? L.trim : L.tunic;
    },
  });

  const leg = (side) => ({
    name: side > 0 ? 'legL' : 'legR',
    size: [4, 4, 9],
    pivot: [2, 2, 9],
    at: [0, side * 2, 9],
    color(x, y, z, f) {
      if (z <= 1) return L.boots;
      if (z === 2) return L.bootCuff;
      if (f === 'px' && z === 5 && y >= 1 && y <= 2) return shade(L.pants, 1.15); // 무릎
      return L.pants;
    },
  });

  const cape = {
    name: 'cape',
    parent: 'torso',
    size: [1, 8, 11],
    pivot: [1, 4, 11],
    at: [-2, 0, 10],
    edge: false,
    color(x, y, z, f) {
      if (z === 10) return L.trim;
      if (z === 0) return L.capeDark;
      if (f === 'px') return L.capeDark;
      return y % 3 === 0 ? L.capeDark : L.cape;
    },
  };

  // 검: 오른손에 쥠
  const blade = {
    name: 'blade',
    parent: 'armR',
    size: [12, 1, 2],
    pivot: [0, 0.5, 1],
    at: [1.5, 0, -8.5],
    color(x, y, z) {
      if (x >= 11) return L.bladeEdge;
      return z === 1 ? L.bladeEdge : L.blade;
    },
  };
  const guard = {
    name: 'guard',
    parent: 'armR',
    size: [1, 1, 5],
    pivot: [0.5, 0.5, 2.5],
    at: [1.5, 0, -8.5],
    color: () => L.guard,
  };

  return [leg(-1), leg(1), torso, head, arm(-1), arm(1), cape, blade, guard];
}

function poseFor(anim, f) {
  const pose = {};
  let offset = [0, 0, 0];
  let pitchR = I3;
  // 기본: 검을 앞으로 비스듬히 내려 쥔 자세
  const swordTilt = rotY(0.95);
  if (anim === 'idle') {
    const b = Math.sin((f / 4) * Math.PI * 2);
    pose.armR = mul(rotY(-0.25 + b * 0.04), rotX(0.08));
    pose.armL = mul(rotY(0.05 - b * 0.04), rotX(-0.08));
    pose.cape = rotY(-0.08 - b * 0.03);
    pose.head = rotY(b * 0.02);
    pose.blade = swordTilt;
    pose.guard = swordTilt;
    offset = [0, 0, f >= 2 ? -0.5 : 0];
  } else if (anim === 'walk') {
    const ph = (f / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    pose.legR = rotY(s * 0.62);
    pose.legL = rotY(-s * 0.62);
    pose.armR = mul(rotY(-0.3 - s * 0.35), rotX(0.08));
    pose.armL = mul(rotY(s * 0.55), rotX(-0.08));
    pose.cape = rotY(-0.35 - Math.abs(s) * 0.15);
    pose.torso = rotY(-0.06);
    pose.blade = swordTilt;
    pose.guard = swordTilt;
    offset = [0, 0, (1 - Math.abs(Math.cos(ph))) * 1.0 - 0.3];
  } else if (anim === 'roll') {
    // 몸을 웅크리고 앞으로 한 바퀴
    const a = (f / 6) * Math.PI * 2;
    pose.legR = rotY(-1.5);
    pose.legL = rotY(-1.3);
    pose.armR = rotY(-1.2);
    pose.armL = rotY(-1.0);
    pose.head = rotY(-0.4);
    pose.cape = rotY(-0.2);
    pose.blade = rotY(1.2);
    pose.guard = rotY(1.2);
    pitchR = rotY(-a - 0.3);
    offset = [0, 0, 5];
  }
  return { pose, pitchR, offset };
}

function rootFor(yaw, pitchR, offset) {
  // 몸 중심(높이 9) 기준으로 굴러가도록 위치 보정
  const R = mul(Rot.rotZ(yaw), pitchR);
  const c = [0, 0, 9];
  const rc = [R[0] * c[0] + R[1] * c[1] + R[2] * c[2], R[3] * c[0] + R[4] * c[1] + R[5] * c[2], R[6] * c[0] + R[7] * c[1] + R[8] * c[2]];
  const isRoll = pitchR !== I3;
  const off = isRoll ? [c[0] - rc[0] + offset[0], c[1] - rc[1] + offset[1], c[2] - rc[2] + offset[2]] : offset;
  return { yaw, pitchR, offset: off };
}

export function renderHeroFrame(look, anim, f, yawIdx) {
  const parts = buildParts(look);
  const { pose, pitchR, offset } = poseFor(anim, f);
  const yaw = (yawIdx * Math.PI) / 4;
  return renderVoxel(parts, pose, rootFor(yaw, pitchR, offset), HERO_W, HERO_H, HERO_AX, HERO_AY);
}

// 이름: `${prefix}_${anim}_${yawIdx}_${frame}`
export function registerHero(atlas, prefix, look = HERO_LOOK) {
  for (const [anim, n] of Object.entries(HERO_ANIMS))
    for (let k = 0; k < YAWS; k++)
      for (let f = 0; f < n; f++) atlas.add(`${prefix}_${anim}_${k}_${f}`, renderHeroFrame(look, anim, f, k), HERO_AX, HERO_AY);
}
