// 컷씬 연출 도구: 기다리기, 카메라 이동, 대사, 자막, 페이드, NPC 이동, 빛기둥
import { Sprite, Container, Texture, CanvasSource } from 'pixi.js';
import { sx as SX, sy as SY, facingName } from '../core/view.js';
import { CHAR_W, CHAR_H, CHAR_AX, CHAR_AY } from '../art/character.js';

const $ = (id) => document.getElementById(id);

// ---------------- NPC ----------------
export class Npc {
  constructor(game, id, x, y) {
    this.g = game;
    this.id = id;
    this.x = x;
    this.y = y;
    this.z = game.terrain.groundAt(x, y);
    this.fx = 0;
    this.fy = 1;
    this.t = 0;
    this.moving = false;
    this.target = null;
    this.view = new Container();
    const sh = new Sprite(game.atlas.tex('shadow_m'));
    sh.anchor.set(0.5);
    sh.y = -1;
    this.body = new Sprite(game.atlas.tex(`${id}_idle_D_0`));
    this.body.anchor.set(CHAR_AX / CHAR_W, CHAR_AY / CHAR_H);
    this.view.addChild(sh, this.body);
  }

  face(dx, dy) {
    this.fx = dx;
    this.fy = dy;
  }

  faceTo(o) {
    this.face(o.x - this.x, o.y - this.y);
  }

  walkTo(x, y, speed = 3.2) {
    this.target = { x, y, speed };
    return new Promise((r) => {
      this.onArrive = r;
      if (this.g.skipping) this.arrive();
    });
  }

  arrive() {
    if (!this.target) return;
    this.x = this.target.x;
    this.y = this.target.y;
    this.target = null;
    this.moving = false;
    const r = this.onArrive;
    this.onArrive = null;
    r?.();
  }

  update(dt) {
    this.t += dt;
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.target.speed * dt;
      this.moving = true;
      this.face(dx, dy);
      if (d <= step || this.g.skipping) this.arrive();
      else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
    }
    const g = this.g.terrain.groundAt(this.x, this.y);
    if (g !== -Infinity) this.z = g;
  }

  render(wr) {
    const anim = this.moving ? 'walk' : 'idle';
    const n = anim === 'walk' ? 4 : 2;
    const f = Math.floor(this.t * (anim === 'walk' ? 9 : 2.5)) % n;
    this.body.texture = this.g.atlas.tex(`${this.id}_${anim}_${facingName(this.fx, this.fy)}_${f}`);
    this.view.x = Math.round(SX(this.x));
    this.view.y = Math.round(SY(this.y, this.z));
    wr.placeEntity(this.view, this.x, this.y);
  }

  remove() {
    this.view.parent?.removeChild(this.view);
  }
}

// ---------------- 빛기둥 ----------------
let pillarTex = null;
function pillarTexture() {
  if (pillarTex) return pillarTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, 'rgba(255,240,180,0)');
  g.addColorStop(0.3, 'rgba(255,240,180,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,240,180,0.7)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 256);
  pillarTex = new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'linear' }) });
  return pillarTex;
}

// ---------------- 연출 도구 ----------------
export class Director {
  constructor(game) {
    this.g = game;
  }

  wait(t) {
    if (this.g.skipping || t <= 0) return Promise.resolve();
    return new Promise((r) => this.g.timers.push({ t, fn: r }));
  }

  say(who, text) {
    return this.g.dialog.say(who, text);
  }

  camTo(x, y, dur = 0.8) {
    this.g.camOverride = { x: SX(x), y: SY(y, this.g.terrain.groundAt(x, y) === -Infinity ? 0 : this.g.terrain.groundAt(x, y)), speed: 3 / Math.max(0.2, dur) };
    if (this.g.skipping) {
      this.g.cam.x = this.g.camOverride.x;
      this.g.cam.y = this.g.camOverride.y;
    }
    return this.wait(dur);
  }

  camFollow() {
    this.g.camOverride = null;
  }

  shake(v) {
    this.g.shake(v);
  }

  flash(t = 0.5) {
    this.g.flashScreen(t);
  }

  emote(target, text, color = 0xffffff) {
    this.g.toastWorld(target.x, target.y, target.z, text, color);
  }

  // 화면 가운데 큰 글씨 (검은 바탕 내레이션)
  async narrate(lines, { keepBlack = false } = {}) {
    const box = $('narration');
    box.classList.remove('hidden');
    box.style.opacity = '1';
    const p = box.querySelector('p');
    for (const line of lines) {
      if (this.g.skipping) break;
      p.style.opacity = '0';
      p.textContent = line.replaceAll('{name}', this.g.save.name || '');
      await this.wait(0.15);
      p.style.opacity = '1';
      await this.wait(Math.max(2.2, line.length * 0.075));
      p.style.opacity = '0';
      await this.wait(0.45);
    }
    if (!keepBlack) {
      box.style.opacity = '0';
      await this.wait(0.6);
      box.classList.add('hidden');
    }
  }

  async hideNarration() {
    const box = $('narration');
    box.style.opacity = '0';
    await this.wait(0.6);
    box.classList.add('hidden');
  }

  // 장 제목 카드
  async chapter(title, sub) {
    const c = $('chapter');
    c.querySelector('b').textContent = title;
    c.querySelector('span').textContent = sub || '';
    c.classList.remove('hidden', 'out');
    void c.offsetWidth;
    c.classList.add('in');
    await this.wait(2.4);
    c.classList.add('out');
    await this.wait(0.6);
    c.classList.add('hidden');
    c.classList.remove('in', 'out');
  }

  async fade(toBlack, dur = 0.5, color = '#000') {
    const f = $('fade');
    f.style.background = color;
    f.classList.remove('hidden');
    f.style.transition = 'none';
    f.style.opacity = toBlack ? '0' : '1';
    void f.offsetWidth;
    f.style.transition = `opacity ${this.g.skipping ? 0 : dur}s`;
    f.style.opacity = toBlack ? '1' : '0';
    await this.wait(dur);
    if (!toBlack) f.classList.add('hidden');
  }

  // 멀리서 솟는 빛기둥
  pillar(x, y) {
    const s = new Sprite(pillarTexture());
    s.anchor.set(0.5, 1);
    s.blendMode = 'add';
    s.x = SX(x);
    s.y = SY(y, 0);
    s.scale.set(0.2, 3);
    s.alpha = 0;
    this.g.combat.top.addChild(s);
    let t = 0;
    const tick = (dt) => {
      t += dt;
      s.alpha = Math.min(1, t * 3) * (t > 4 ? Math.max(0, 1 - (t - 4) / 2) : 1);
      s.scale.x = 0.2 + Math.min(1.6, t * 3) * (1 + Math.sin(t * 20) * 0.05);
      if (t > 6) {
        s.parent?.removeChild(s);
        return false;
      }
      return true;
    };
    this.g.tickers.push(tick);
  }
}
