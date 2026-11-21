// 호라이즌 나이츠 - 시작점
import { Application, Container } from 'pixi.js';
import { Atlas } from './render/atlas.js';
import { PixelCanvas } from './render/pixel.js';
import { registerTiles } from './art/tiles.js';
import { registerProps } from './art/props.js';
import { registerSky } from './art/sky.js';
import { registerCharacter } from './art/character.js';
import { buildMeadow } from './world/meadow.js';
import { WorldRenderer } from './render/world-renderer.js';
import { Sky } from './render/sky.js';
import { Particles } from './render/effects.js';
import { Player } from './gameplay/player.js';
import { Input } from './core/input.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { sx as SX, sy as SY } from './core/view.js';
import { enableProtection } from './security/protect.js';

const $ = (id) => document.getElementById(id);
const VIEW_H = 192; // 화면에 보이는 게임 픽셀 높이 (기준)
const STEP = 1 / 60;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

class Game {
  constructor() {
    this.settings = loadSettings();
    this.input = new Input();
    this.state = 'loading';
    this.acc = 0;
    this.cam = { x: 0, y: 0, shake: 0 };
    this.fpsSamples = [];
    this.fpsTimer = 0;
    this.autoQuality = this.settings.quality === 'auto';
    this.quality = this.autoQuality ? (this.input.isTouch ? 'mid' : 'high') : this.settings.quality;
    this.guarded = false;
  }

  async start() {
    document.body.classList.toggle('is-touch', this.input.isTouch);
    this.applyFontScale();

    const app = new Application();
    await app.init({
      background: 0x5d8fd1,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      preference: 'webgl',
      powerPreference: 'high-performance',
      width: 320,
      height: 180,
    });
    this.app = app;
    $('stage').appendChild(app.canvas);

    await this.loadAssets();

    this.terrain = buildMeadow(7);
    this.world = new WorldRenderer(this.atlas, this.terrain);
    this.sky = new Sky(this.atlas);
    this.player = new Player(this.atlas, this.terrain, 'hero');
    this.fx = new Particles(this.atlas, this.world);

    this.worldLayer = new Container();
    this.worldLayer.addChild(this.world.root);
    app.stage.addChild(this.sky.root, this.worldLayer);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));

    this.bindUI();
    this.applyMaxFps();

    // 타이틀: 섬 중앙을 천천히 둘러봄
    const c = this.islandCenter();
    this.cam.x = c.x;
    this.cam.y = c.y;
    this.setState('title');

    app.ticker.add((t) => this.frame(Math.min(0.1, t.deltaMS / 1000)));

    if (import.meta.env.PROD) {
      enableProtection({
        onDevtools: () => {
          this.guarded = true;
          $('guard').classList.remove('hidden');
        },
        onDevtoolsClosed: () => {
          this.guarded = false;
          $('guard').classList.add('hidden');
        },
      });
    }
  }

  async loadAssets() {
    const steps = [
      ['지형 블록을 쌓는 중…', (a) => registerTiles(a)],
      ['나무를 심는 중…', (a) => registerProps(a)],
      ['구름을 띄우는 중…', (a) => registerSky(a)],
      ['기사단원을 깨우는 중…', (a) => registerCharacter(a, 'hero')],
      ['효과 준비 중…', (a) => {
        const p1 = new PixelCanvas(1, 1);
        p1.px(0, 0, 0xffffff);
        const p2 = new PixelCanvas(2, 2);
        p2.rect(0, 0, 2, 2, 0xffffff);
        a.add('px_1', p1);
        a.add('px_2', p2);
      }],
      ['텍스처를 굽는 중…', (a) => a.build()],
    ];
    this.atlas = new Atlas();
    for (let i = 0; i < steps.length; i++) {
      $('loading-text').textContent = steps[i][0];
      $('loading-fill').style.width = `${Math.round((i / steps.length) * 100)}%`;
      await nextFrame();
      steps[i][1](this.atlas);
    }
    $('loading-fill').style.width = '100%';
    await nextFrame();
  }

  islandCenter() {
    const t = this.terrain;
    return { x: SX(t.w / 2), y: SY(t.h / 2, 0) };
  }

  // ---------------- 화면 크기와 품질 ----------------
  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let canvasW;
    let canvasH;
    let scale;
    let k = 1; // 캔버스 픽셀 1개가 차지하는 실제 화면 픽셀 수 (정수로 맞춰 줄무늬 방지)
    if (this.quality === 'high') {
      scale = Math.max(1, Math.round((cssH * dpr) / VIEW_H));
      canvasW = Math.round(cssW * dpr);
      canvasH = Math.round(cssH * dpr);
    } else {
      // 게임 픽셀 1개 = 실제 화면 픽셀 total개 (정수). 보통 품질은 가능하면 2배 버퍼.
      const total = Math.max(1, Math.round((cssH * dpr) / VIEW_H));
      scale = this.quality === 'mid' && total % 2 === 0 ? 2 : 1;
      k = total / scale;
      canvasW = Math.ceil((cssW * dpr) / k);
      canvasH = Math.ceil((cssH * dpr) / k);
    }
    const cv = this.app.canvas;
    cv.style.width = `${(canvasW * k) / dpr}px`;
    cv.style.height = `${(canvasH * k) / dpr}px`;
    this.scale = scale;
    this.viewW = canvasW / scale;
    this.viewH = canvasH / scale;
    this.app.renderer.resize(canvasW, canvasH);
    this.app.stage.scale.set(scale);
    this.fx && (this.fx.density = this.quality === 'low' ? 0.5 : 1);
  }

  setQuality(q, notify = false) {
    if (q === this.quality) return;
    this.quality = q;
    this.resize();
    if (notify) this.toast('그래픽 품질을 자동으로 낮췄어요');
  }

  applyMaxFps() {
    this.app.ticker.maxFPS = this.settings.maxFps;
  }

  applyFontScale() {
    document.documentElement.style.setProperty('--fs', this.settings.fontScale);
  }

  // ---------------- 상태 ----------------
  setState(s) {
    this.state = s;
    $('loading').classList.add('hidden');
    $('title').classList.toggle('hidden', s !== 'title');
    $('hud').classList.toggle('hidden', s !== 'play' && s !== 'pause');
    $('touch').classList.toggle('hidden', !(this.input.isTouch && s === 'play'));
    $('pause').classList.toggle('hidden', s !== 'pause');
    this.player.view.visible = s !== 'title';
    if (s === 'play') this.input.endFrame();
  }

  startGame() {
    const p = this.player;
    p.x = p.px = this.terrain.spawn.x;
    p.y = p.py = this.terrain.spawn.y;
    p.z = p.pz = this.terrain.groundAt(p.x, p.y);
    p.hp = p.maxHp;
    this.setState('play');
    this.toast('초원 · 시험 구역');
    setTimeout(() => $('help').classList.add('hidden'), 9000);
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => this.startGame());
    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-resume').addEventListener('click', () => this.togglePause());
    $('btn-to-title').addEventListener('click', () => {
      this.setState('title');
    });
    $('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
    const openSettings = () => this.openSettings();
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-title-settings').addEventListener('click', openSettings);
    $('btn-settings-close').addEventListener('click', () => $('settings').classList.add('hidden'));

    const s = this.settings;
    const q = $('set-quality');
    const f = $('set-fps');
    const sf = $('set-showfps');
    const sh = $('set-shake');
    const vb = $('set-vibrate');
    const fs = $('set-fontscale');
    q.value = s.quality;
    f.value = String(s.maxFps);
    sf.checked = s.showFps;
    sh.checked = s.shake;
    vb.checked = s.vibrate;
    fs.value = String(s.fontScale);
    q.addEventListener('change', () => {
      s.quality = q.value;
      this.autoQuality = s.quality === 'auto';
      this.setQuality(this.autoQuality ? (this.input.isTouch ? 'mid' : 'high') : s.quality);
      saveSettings(s);
    });
    f.addEventListener('change', () => {
      s.maxFps = Number(f.value);
      this.applyMaxFps();
      saveSettings(s);
    });
    sf.addEventListener('change', () => {
      s.showFps = sf.checked;
      $('fps').classList.toggle('hidden', !s.showFps);
      saveSettings(s);
    });
    sh.addEventListener('change', () => {
      s.shake = sh.checked;
      saveSettings(s);
    });
    vb.addEventListener('change', () => {
      s.vibrate = vb.checked;
      saveSettings(s);
    });
    fs.addEventListener('change', () => {
      s.fontScale = Number(fs.value);
      this.applyFontScale();
      saveSettings(s);
    });
    $('fps').classList.toggle('hidden', !s.showFps);

    if (this.input.isTouch) {
      this.input.attachJoystick($('joy-zone'), $('joy'), $('joy-knob'));
      this.input.attachButton($('tb-roll'), 'roll');
    }
    // 백그라운드로 가면 자동 일시정지
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play') this.togglePause();
    });
  }

  openSettings() {
    $('settings').classList.remove('hidden');
  }

  togglePause() {
    if (this.state === 'play') this.setState('pause');
    else if (this.state === 'pause') this.setState('play');
  }

  async toggleFullscreen() {
    const d = document;
    const el = d.documentElement;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (isFs) {
        await (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else if (el.requestFullscreen || el.webkitRequestFullscreen) {
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
        try {
          await screen.orientation?.lock?.('landscape');
        } catch {
          /* 방향 고정 미지원 */
        }
      } else {
        this.toast('이 기기는 전체화면을 지원하지 않아요. 공유 → 홈 화면에 추가를 이용해 주세요');
      }
    } catch {
      this.toast('전체화면으로 바꾸지 못했어요');
    }
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = text;
    $('toast').appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  vibrate(ms) {
    if (this.settings.vibrate && navigator.vibrate) navigator.vibrate(ms);
  }

  // ---------------- 루프 ----------------
  frame(dt) {
    if (this.guarded) return;
    const playing = this.state === 'play';
    if (this.state === 'play' && this.input.consume('pause')) this.togglePause();
    else if (this.state === 'pause' && this.input.consume('pause')) this.togglePause();

    if (playing) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.player.update(STEP, this.input);
        this.input.endFrame();
        this.handleEvents();
        this.acc -= STEP;
        steps++;
      }
      if (steps === 5) this.acc = 0;
    } else {
      this.input.endFrame();
    }
    if (this.state !== 'pause') this.fx.update(dt);

    const alpha = playing ? this.acc / STEP : 1;
    const ps = this.player.render(alpha, this.world);

    // 카메라
    let tx;
    let ty;
    if (this.state === 'title') {
      const c = this.islandCenter();
      const tt = performance.now() / 1000;
      tx = c.x + Math.sin(tt * 0.12) * 90;
      ty = c.y + Math.cos(tt * 0.09) * 50;
    } else {
      tx = ps.sx + this.player.vx * 3;
      ty = ps.sy - 8 + this.player.vy * 3;
    }
    const k = 1 - Math.exp(-dt * (this.state === 'title' ? 1.5 : 7));
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    let sx = 0;
    let sy = 0;
    if (this.cam.shake > 0) {
      this.cam.shake = Math.max(0, this.cam.shake - dt * 30);
      if (this.settings.shake) {
        sx = (Math.random() - 0.5) * this.cam.shake;
        sy = (Math.random() - 0.5) * this.cam.shake;
      }
    }
    const vx = Math.round(this.cam.x - this.viewW / 2 + sx);
    const vy = Math.round(this.cam.y - this.viewH / 2 + sy);
    this.worldLayer.x = -vx;
    this.worldLayer.y = -vy;
    this.world.cull(vx, vy, this.viewW, this.viewH);
    this.sky.update(dt, this.cam.x, this.cam.y, this.viewW, this.viewH);

    // HUD
    if (playing) $('hp-fill').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
    this.measureFps(dt);
  }

  handleEvents() {
    const p = this.player;
    for (const e of p.events) {
      if (e === 'roll') this.fx.burst(p.x, p.y, p.z, { count: 7, speed: 1.6, up: 1.2, color: 0xe9dcc0 });
      else if (e === 'land') {
        this.fx.burst(p.x, p.y, p.z, { count: 10, speed: 2.4, up: 1.4, color: 0xe9dcc0 });
        this.cam.shake = 3;
      } else if (e === 'fall') {
        this.toast('섬 밖으로 떨어졌어요! 체력 -20%');
        this.cam.shake = 5;
        this.vibrate(80);
      }
    }
    p.events.length = 0;
  }

  measureFps(dt) {
    this.fpsSamples.push(dt);
    this.fpsTimer += dt;
    if (this.fpsTimer < 1) return;
    const avg = this.fpsSamples.length / this.fpsTimer;
    this.fpsSamples.length = 0;
    this.fpsTimer = 0;
    if (this.settings.showFps) $('fps').textContent = `${Math.round(avg)} FPS · ${this.quality}`;
    // 자동 품질: 3초 연속 느리면 한 단계 낮춤
    if (!this.autoQuality || this.state !== 'play') return;
    const target = this.settings.maxFps * 0.8;
    this.slowCount = avg < target ? (this.slowCount || 0) + 1 : 0;
    if (this.slowCount >= 3) {
      this.slowCount = 0;
      if (this.quality === 'high') this.setQuality('mid', true);
      else if (this.quality === 'mid') this.setQuality('low', true);
    }
  }
}

new Game().start().catch((e) => {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = '불러오기에 실패했어요. 새로고침해 주세요.';
  // eslint-disable-next-line no-console
  console.error(e);
});
