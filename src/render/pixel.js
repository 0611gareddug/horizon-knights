// 코드로 픽셀 아트를 그리기 위한 도구.
// 색은 0xRRGGBB 정수. 투명은 -1.

export function rgb(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function mix(a, b, t) {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

// 밝기 조절 (f < 1 어둡게, f > 1 밝게). 어두워질 때 살짝 푸른빛을 섞어 픽셀 아트 느낌을 살린다.
export function shade(c, f) {
  let [r, g, b] = rgb(c);
  if (f < 1) {
    const k = 1 - f;
    r = r * f - 6 * k;
    g = g * f - 2 * k;
    b = b * f + 14 * k;
  } else {
    r = r + (255 - r) * (f - 1);
    g = g + (255 - g) * (f - 1);
    b = b + (255 - b) * (f - 1) * 0.85;
  }
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}

// 시드 고정 난수 (같은 시드면 같은 그림)
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Int32Array(w * h).fill(-1);
    this.alpha = new Uint8Array(w * h).fill(255);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  px(x, y, c, a = 255) {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.data[i] = c;
    this.alpha[i] = a;
  }

  get(x, y) {
    if (!this.inside(x, y)) return -1;
    return this.data[y * this.w + x];
  }

  rect(x, y, w, h, c, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a);
  }

  hline(x0, x1, y, c) {
    for (let x = x0; x <= x1; x++) this.px(x, y, c);
  }

  vline(x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) this.px(x, y, c);
  }

  // 채워진 타원
  ellipse(cx, cy, rx, ry, c, a = 255) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c, a);
      }
    }
  }

  // 불투명 픽셀 주변에 외곽선을 친다. darkenFn이 있으면 이웃 색을 어둡게 한 색을 쓴다.
  outline(color, { diagonal = false, darken = 0 } = {}) {
    const src = this.data.slice();
    const w = this.w;
    const h = this.h;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== -1) continue;
        let n = -1;
        if (solid(x - 1, y)) n = src[y * w + x - 1];
        else if (solid(x + 1, y)) n = src[y * w + x + 1];
        else if (solid(x, y - 1)) n = src[(y - 1) * w + x];
        else if (solid(x, y + 1)) n = src[(y + 1) * w + x];
        else if (diagonal) {
          if (solid(x - 1, y - 1)) n = src[(y - 1) * w + x - 1];
          else if (solid(x + 1, y - 1)) n = src[(y - 1) * w + x + 1];
          else if (solid(x - 1, y + 1)) n = src[(y + 1) * w + x - 1];
          else if (solid(x + 1, y + 1)) n = src[(y + 1) * w + x + 1];
        }
        if (n !== -1) this.px(x, y, darken ? mix(shade(n, darken), color, 0.55) : color);
      }
    }
  }

  flipX() {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const j = y * this.w + (this.w - 1 - x);
        out.data[j] = this.data[i];
        out.alpha[j] = this.alpha[i];
      }
    return out;
  }

  // 다른 PixelCanvas를 겹쳐 그림
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + x];
        if (c !== -1) this.px(ox + x, oy + y, c, src.alpha[y * src.w + x]);
      }
  }

  toImageData(ctx) {
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (c === -1) continue;
      d[i * 4] = (c >> 16) & 255;
      d[i * 4 + 1] = (c >> 8) & 255;
      d[i * 4 + 2] = c & 255;
      d[i * 4 + 3] = this.alpha[i];
    }
    return img;
  }
}
