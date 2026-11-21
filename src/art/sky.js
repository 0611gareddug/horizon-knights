// 하늘 배경: 픽셀 구름
import { PixelCanvas, rng, shade } from '../render/pixel.js';

const CLOUD = 0xffffff;
const CLOUD_SHADE = 0xd6e4f5;
const CLOUD_DEEP = 0xb3c8e6;

export function makeCloud(seed, w, h) {
  const r = rng(seed * 4099 + 17);
  const pc = new PixelCanvas(w, h);
  const blobs = 5 + Math.floor(r() * 5);
  const pts = [];
  for (let b = 0; b < blobs; b++) {
    const bw = w * (0.16 + r() * 0.22);
    const bx = bw + r() * (w - bw * 2);
    const by = h * 0.55 + (r() - 0.5) * h * 0.25;
    const bh = bw * (0.55 + r() * 0.25);
    pts.push([bx, by, bw, bh]);
  }
  // 바닥은 평평하게
  const floor = Math.floor(h * 0.8);
  for (const [bx, by, bw, bh] of pts) {
    for (let y = Math.floor(by - bh); y <= floor; y++)
      for (let x = Math.floor(bx - bw); x <= Math.ceil(bx + bw); x++) {
        const dx = (x + 0.5 - bx) / bw;
        const dy = (y + 0.5 - by) / bh;
        if (dx * dx + dy * dy <= 1 || (y > by && Math.abs(dx) <= 1 && y <= floor)) pc.px(x, y, CLOUD);
      }
  }
  // 아래쪽 음영
  for (let x = 0; x < w; x++) {
    let bottom = -1;
    for (let y = h - 1; y >= 0; y--)
      if (pc.get(x, y) !== -1) {
        bottom = y;
        break;
      }
    if (bottom < 0) continue;
    for (let k = 0; k < 4; k++) {
      const y = bottom - k;
      if (pc.get(x, y) !== -1) pc.px(x, y, k < 2 ? CLOUD_DEEP : CLOUD_SHADE);
    }
  }
  // 왼쪽 위 하이라이트는 흰색 그대로, 오른쪽 면 살짝 그늘
  for (let y = 0; y < h; y++)
    for (let x = w - 1; x >= 0; x--) {
      if (pc.get(x, y) === CLOUD) {
        pc.px(x, y, CLOUD_SHADE);
        break;
      }
      if (pc.get(x, y) !== -1) break;
    }
  return pc;
}

// 아래쪽 구름 바다 (가로로 이어 붙일 수 있는 띠)
export function makeCloudSea(seed, w, h) {
  const r = rng(seed * 733 + 5);
  const pc = new PixelCanvas(w, h);
  const bumps = [];
  for (let x = 0; x < w; x += 6 + Math.floor(r() * 10)) bumps.push([x, 4 + r() * 10, 8 + r() * 12]);
  for (let x = 0; x < w; x++) {
    let top = h;
    for (const [bx, by, br] of bumps) {
      for (const off of [-w, 0, w]) {
        const dx = x - (bx + off);
        if (Math.abs(dx) < br) top = Math.min(top, by + br - Math.sqrt(br * br - dx * dx));
      }
    }
    top = Math.max(0, Math.floor(top));
    for (let y = top; y < h; y++) {
      let c = CLOUD;
      if (y > top + 3) c = CLOUD_SHADE;
      if (y > top + 14) c = CLOUD_DEEP;
      pc.px(x, y, c);
    }
  }
  return pc;
}

export function registerSky(atlas) {
  for (let v = 0; v < 6; v++) atlas.add(`cloud_${v}`, makeCloud(v + 1, 72 + (v % 3) * 24, 30 + (v % 2) * 8));
  atlas.add('cloudsea_0', makeCloudSea(1, 256, 48));
  atlas.add('cloudsea_1', makeCloudSea(2, 256, 40));
}

export { shade };
