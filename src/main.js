// 호라이즌 나이츠 - 시작점
import { Application, Container, Sprite } from 'pixi.js';
import { Atlas } from './render/atlas.js';
import { PixelCanvas } from './render/pixel.js';
import { registerTiles } from './art/tiles.js';
import { registerProps } from './art/props.js';
import { registerSky } from './art/sky.js';
import { registerCharacter, CLASS_LOOKS, NPC_LOOKS } from './art/character.js';
import { Sfx } from './audio/sfx.js';
import { Dialog } from './story/dialog.js';
import { Director, Npc } from './story/director.js';
import { runPrologue } from './story/prologue.js';
import { buildTraining, buildDeck } from './world/zones.js';
import { registerFx } from './art/fx-art.js';
import { Combat } from './gameplay/combat.js';
import { ClassController, CLASSES } from './gameplay/classes.js';
import { Hud, buildClassSelect } from './ui/hud.js';
import { buildMeadow } from './world/meadow.js';
import { WorldRenderer } from './render/world-renderer.js';
import { Sky } from './render/sky.js';
import { Particles } from './render/effects.js';
import { Player } from './gameplay/player.js';
import { Input } from './core/input.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { sx as SX, sy as SY, TILE, LEVEL } from './core/view.js';
import { enableProtection } from './security/protect.js';

const $ = (id) => document.getElementById(id);
const VIEW_H = 192; // 화면에 보이는 게임 픽셀 높이 (기준)
const STEP = 1 / 60;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const SAVE_KEY = 'hk_save_v1';
const BAD_WORDS = ['시발', '씨발', '병신', '개새', '좆', '존나', '썅', 'fuck', 'shit', 'bitch'];

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}

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
    this.hitstopT = 0;
    this.ctrl = null;
    this.clsId = null;
    this.viewX = 0;
    this.viewY = 0;
    this.save = loadSave();
    this.timers = [];
    this.tickers = [];
    this.npcs = [];
    this.stats = { rolls: 0, skills: 0 };
    this.skipping = false;
    this.camOverride = null;
    this.obj = null;
    this.escape = null;
    this.sfx = new Sfx();
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* 저장 불가 환경 */
    }
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
    this.player = new Player(this.atlas, this.terrain, 'warrior');
    this.fx = new Particles(this.atlas, this.world);
    this.combat = new Combat(this);
    this.hud = new Hud(this);
    this.dialog = new Dialog(this);
    this.director = new Director(this);
    this.zone = 'meadow';

    this.worldLayer = new Container();
    this.worldLayer.addChild(this.world.root, this.combat.ground, this.combat.top);
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
      ['기사단원을 깨우는 중…', (a) => {
        for (const id of Object.keys(CLASS_LOOKS)) registerCharacter(a, id, CLASS_LOOKS[id]);
        for (const id of Object.keys(NPC_LOOKS)) registerCharacter(a, id, NPC_LOOKS[id]);
      }],
      ['무기를 벼리는 중…', (a) => registerFx(a)],
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
    $('class-select').classList.toggle('hidden', s !== 'select');
    $('name-input').classList.toggle('hidden', s !== 'name');
    $('hud').classList.toggle('hidden', !['play', 'pause', 'cutscene'].includes(s));
    document.body.classList.toggle('in-cutscene', s === 'cutscene');
    if (s === 'title') $('btn-continue').classList.toggle('hidden', !this.save.prologueDone);
    if (s === 'title' || s === 'select' || s === 'name') this.player.view.visible = false;
    if (s === 'play') this.input.endFrame();
  }

  openClassSelect(from) {
    this.selectFrom = from;
    this.setState('select');
  }

  setupClass(clsId) {
    const p = this.player;
    if (this.ctrl) this.ctrl.destroy();
    this.clsId = clsId;
    p.prefix = clsId;
    this.ctrl = new ClassController(this, p, clsId);
    this.hud.build(clsId);
    if (clsId === 'mage') this.hud.setElem(this.ctrl.elem);
    p.alive = true;
    p.hp = p.maxHp;
    p.ult = 0;
    p.potions = 3;
    this.save.cls = clsId;
  }

  onClassPicked(clsId) {
    if (this.selectFrom === 'pause') {
      this.setupClass(clsId);
      this.saveGame();
      this.setState('play');
      this.toast(`${CLASSES[clsId].name}(으)로 바꿨어요`);
      return;
    }
    this.setupClass(clsId);
    this.saveGame();
    this.player.view.visible = true;
    runPrologue(this);
  }

  continueGame() {
    this.setupClass(this.save.cls || 'warrior');
    this.enterChapter1();
  }

  async enterChapter1() {
    this.loadZone('meadow');
    this.player.view.visible = true;
    this.player.hp = this.player.maxHp;
    this.player.potions = 3;
    this.combat.respawn = true;
    this.combat.spawnInitial();
    this.setState('play');
    $('help').classList.remove('hidden');
    clearTimeout(this.helpTimer);
    this.helpTimer = setTimeout(() => $('help').classList.add('hidden'), 10000);
    const f = $('fade');
    f.style.transition = 'opacity 0.8s';
    f.style.opacity = '0';
    setTimeout(() => f.classList.add('hidden'), 800);
    await this.director.chapter('제1장 · 초원', '첫 번째 천공석 파편을 찾아라');
  }

  // ---------------- 맵 전환 ----------------
  loadZone(name) {
    const t = name === 'training' ? buildTraining() : name === 'deck' ? buildDeck() : buildMeadow(7);
    this.zone = name;
    $('zone-name').textContent = { training: '훈련 섬 · 수습 기사 시험', deck: '비행선 갑판', meadow: '제1장 · 초원' }[name];
    // 옛 맵에 붙어 있던 캐릭터들을 먼저 떼어냄
    this.player.view.parent?.removeChild(this.player.view);
    for (const n of this.npcs) n.remove();
    this.npcs = [];
    this.combat.clear();
    for (const pt of this.fx.live) pt.s.parent?.removeChild(pt.s);
    const old = this.world;
    this.terrain = t;
    this.world = new WorldRenderer(this.atlas, t);
    this.worldLayer.addChildAt(this.world.root, 0);
    old.destroy();
    this.player.t = t;
    this.combat.t = t;
    this.fx.wr = this.world;
    const p = this.player;
    p.x = p.px = t.spawn.x;
    p.y = p.py = t.spawn.y;
    p.z = p.pz = t.groundAt(p.x, p.y);
    p.vx = p.vy = p.vz = 0;
    p.safe = { x: p.x, y: p.y, z: p.z };
    const c = this.camTargetFor(p);
    this.cam.x = c.x;
    this.cam.y = c.y;
  }

  camTargetFor(p) {
    return { x: SX(p.x), y: SY(p.y, p.z) - 8 };
  }

  addNpc(id, x, y) {
    const n = new Npc(this, id, x, y);
    this.npcs.push(n);
    return n;
  }

  removeNpc(n) {
    n.remove();
    this.npcs = this.npcs.filter((x) => x !== n);
  }

  // ---------------- 컷씬과 목표 ----------------
  async cut(fn) {
    this.setState('cutscene');
    $('letterbox').classList.remove('hidden');
    $('btn-skip').classList.remove('hidden');
    $('objective').classList.add('hidden');
    this.skipping = false;
    try {
      await fn(this.director);
    } finally {
      this.skipping = false;
      $('letterbox').classList.add('hidden');
      $('btn-skip').classList.add('hidden');
      $('dialog').classList.add('hidden');
      this.camOverride = null;
      this.setState('play');
    }
  }

  skipCutscene() {
    if (this.state !== 'cutscene') return;
    this.skipping = true;
    this.dialog.skipNow();
    for (const n of this.npcs) n.arrive();
    const ts = this.timers;
    this.timers = [];
    for (const tm of ts) tm.fn();
  }

  objective(text, check, count) {
    const box = $('objective');
    box.querySelector('.obj-text').textContent = text;
    box.querySelector('.obj-count').textContent = count ? count() : '';
    box.classList.remove('hidden', 'done');
    $('help').classList.add('hidden');
    return new Promise((resolve) => {
      this.obj = { check, count, resolve, box };
    });
  }

  updateObjective() {
    const o = this.obj;
    if (!o || this.state !== 'play') return;
    if (o.count) o.box.querySelector('.obj-count').textContent = o.count();
    if (o.check()) {
      this.obj = null;
      o.box.classList.add('done');
      this.sfx.ok();
      setTimeout(() => {
        o.box.classList.add('hidden');
        o.resolve();
      }, 650);
    }
  }

  // ---------------- 섬 붕괴 (프롤로그 탈출) ----------------
  crumbleCell(i, j) {
    const info = this.world.crumble(i, j);
    this.world.force = true;
    if (!info) return;
    const s = new Sprite(info.tex);
    s.x = info.x + 8;
    s.y = info.y + 8;
    s.anchor.set(0.5);
    s.tint = 0x9a9a9a;
    this.combat.top.addChild(s);
    let vy = -20 - Math.random() * 30;
    let t = 0;
    const rot = (Math.random() - 0.5) * 3;
    this.tickers.push((dt) => {
      t += dt;
      vy += 380 * dt;
      s.y += vy * dt;
      s.rotation += rot * dt;
      s.scale.set(Math.max(0.2, 1 - t * 0.7));
      s.alpha = Math.max(0, 1 - t / 0.9);
      if (t > 0.9) {
        s.parent?.removeChild(s);
        return false;
      }
      return true;
    });
  }

  crumbleRows(from, to) {
    for (let j = from; j <= to; j++)
      for (let i = 0; i < this.terrain.w; i++) {
        if (this.terrain.isVoid(i, j)) continue;
        this.timers.push({ t: Math.random() * 0.35, fn: () => this.crumbleCell(i, j) });
      }
  }

  startEscape() {
    this.escape = { front: 1, delay: 1.3, done: 1, rumble: 0 };
  }

  stopEscape() {
    this.escape = null;
  }

  updateEscape(dt) {
    const e = this.escape;
    if (!e || this.state !== 'play') return;
    const edge = this.terrain.marks.edgeY;
    if (e.delay > 0) e.delay -= dt;
    else e.front = Math.min(edge + 2, e.front + 2.5 * dt);
    while (e.done < Math.floor(e.front)) {
      e.done++;
      this.crumbleRows(e.done, e.done);
    }
    e.rumble -= dt;
    if (e.rumble <= 0) {
      e.rumble = 0.5;
      this.shake(2);
      this.sfx.noise(0.3, 0.06);
    }
    // 떨어지면 무너지는 선보다 앞쪽 길 위로 복귀
    const row = Math.min(edge - 3, Math.floor(e.front) + 6);
    const x = 12 + Math.sin(row * 0.45) * 2.2;
    this.player.safe = { x, y: row + 0.5, z: 0 };
  }

  // ---------------- 전투 연출 ----------------
  // ---------------- 전투 연출 ----------------
  hitstop(t) {
    this.hitstopT = Math.max(this.hitstopT, t);
  }

  shake(v) {
    this.cam.shake = Math.max(this.cam.shake, v);
  }

  uiFlash(key) {
    this.hud.flash(key);
  }

  onElemChange(elem) {
    this.hud.setElem(elem);
    this.toastWorld(this.player.x, this.player.y, this.player.z, { fire: '불', ice: '얼음', lightning: '번개' }[elem], { fire: 0xff8a3d, ice: 0x7ad0ff, lightning: 0xd59cff }[elem]);
  }

  worldToCss(x, y, z) {
    const r = this.app.canvas.getBoundingClientRect();
    return [(SX(x) - this.viewX) * (r.width / this.viewW) + r.left, (SY(y, z) - this.viewY) * (r.height / this.viewH) + r.top];
  }

  toastWorld(x, y, z, text, color = 0xffffff) {
    const [cx, cy] = this.worldToCss(x, y, z + 2.2);
    const d = document.createElement('div');
    d.className = 'float-text';
    d.textContent = text;
    d.style.left = `${cx}px`;
    d.style.top = `${cy}px`;
    d.style.color = `#${color.toString(16).padStart(6, '0')}`;
    $('float').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  flashScreen(t = 0.3) {
    const f = $('flash');
    f.style.transition = 'none';
    f.style.opacity = '0.55';
    requestAnimationFrame(() => {
      f.style.transition = `opacity ${t}s ease-out`;
      f.style.opacity = '0';
    });
  }

  hurtFx() {
    const f = $('hurtfx');
    f.style.transition = 'none';
    f.style.opacity = '1';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.45s ease-out';
      f.style.opacity = '0';
    });
  }

  // 조준 방향과 목표 지점
  computeAim() {
    const p = this.player;
    const inp = this.input;
    let dx = p.fx;
    let dy = p.fy;
    let dist = 3;
    if (!inp.isTouch || inp.mouse.used) {
      const r = this.app.canvas.getBoundingClientRect();
      const gx = (inp.mouse.x - r.left) * (this.viewW / r.width) + this.viewX;
      const gy = (inp.mouse.y - r.top) * (this.viewH / r.height) + this.viewY;
      const wx = gx / TILE;
      const wy = (gy + p.z * LEVEL) / TILE + 0.3;
      dx = wx - p.x;
      dy = wy - p.y;
      dist = Math.hypot(dx, dy);
    } else if (inp.aimOverride) {
      dx = inp.aimOverride.dx;
      dy = inp.aimOverride.dy;
      dist = Math.max(1.5, Math.min(6, inp.aimOverride.len / 20));
    } else {
      const e = this.combat.nearest(p.x, p.y, 7);
      if (e) {
        dx = e.x - p.x;
        dy = e.y - p.y;
        dist = Math.hypot(dx, dy);
      }
    }
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    dist = Math.max(0.5, Math.min(7, dist));
    return { dx, dy, tx: p.x + dx * dist, ty: p.y + dy * dist };
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => {
      $('name-field').value = this.save.name || '';
      $('name-err').textContent = '';
      this.setState('name');
      setTimeout(() => $('name-field').focus(), 50);
    });
    $('btn-continue').addEventListener('click', () => this.continueGame());
    const okName = () => {
      const v = $('name-field').value.trim();
      let err = '';
      if (v.length < 2 || v.length > 8) err = '이름은 2~8글자로 지어주세요';
      else if (!/^[가-힣a-zA-Z0-9]+$/.test(v)) err = '한글, 영문, 숫자만 쓸 수 있어요';
      else if (BAD_WORDS.some((w) => v.toLowerCase().includes(w))) err = '다른 이름을 지어주세요';
      $('name-err').textContent = err;
      if (err) return;
      this.save = { name: v };
      this.saveGame();
      this.openClassSelect('new');
    };
    $('btn-name-ok').addEventListener('click', okName);
    $('name-field').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') okName();
    });
    $('btn-name-back').addEventListener('click', () => this.setState('title'));
    $('btn-skip').addEventListener('click', () => this.skipCutscene());
    $('btn-change-class').addEventListener('click', () => this.openClassSelect('pause'));
    $('btn-class-back').addEventListener('click', () => this.setState(this.selectFrom === 'pause' ? 'pause' : this.selectFrom === 'new' ? 'name' : 'title'));
    buildClassSelect((id) => this.onClassPicked(id));
    this.input.attachMouse(this.app.canvas);
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

    // 타이머, 연출
    if (this.state !== 'pause') {
      for (let k = this.timers.length - 1; k >= 0; k--) {
        const tm = this.timers[k];
        tm.t -= dt;
        if (tm.t <= 0) {
          this.timers.splice(k, 1);
          tm.fn();
        }
      }
      this.tickers = this.tickers.filter((fn) => fn(dt));
      for (const n of this.npcs) n.update(dt);
      this.dialog.update(dt);
      if (this.player.knockedT > 0) this.player.knockedT -= dt;
    }
    if (playing) {
      this.updateObjective();
      this.updateEscape(dt);
    }

    if (playing && this.hitstopT > 0) {
      // 히트스톱: 잠깐 시간을 멈춰 타격감을 줌
      this.hitstopT -= dt;
    } else if (playing) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5 && this.hitstopT <= 0) {
        const aim = this.computeAim();
        this.ctrl.update(STEP, this.input, aim);
        this.input.aimOverride = null;
        this.player.update(STEP, this.input);
        this.combat.update(STEP);
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
    if (this.ctrl) this.ctrl.renderWeapon();
    this.combat.render(this.world);
    for (const n of this.npcs) n.render(this.world);

    // 카메라
    let tx;
    let ty;
    if (this.state === 'title') {
      const c = this.islandCenter();
      const tt = performance.now() / 1000;
      tx = c.x + Math.sin(tt * 0.12) * 90;
      ty = c.y + Math.cos(tt * 0.09) * 50;
    } else if (this.camOverride) {
      tx = this.camOverride.x;
      ty = this.camOverride.y;
    } else {
      tx = ps.sx + this.player.vx * 3;
      ty = ps.sy - 8 + this.player.vy * 3;
    }
    const k = 1 - Math.exp(-dt * (this.state === 'title' ? 1.5 : this.camOverride ? this.camOverride.speed : 7));
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
    this.viewX = vx;
    this.viewY = vy;
    this.worldLayer.x = -vx;
    this.worldLayer.y = -vy;
    this.world.cull(vx, vy, this.viewW, this.viewH);
    this.sky.update(dt, this.cam.x, this.cam.y, this.viewW, this.viewH);

    // HUD
    if (playing) {
      $('hp-fill').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
      this.hud.update(this.ctrl, this.player);
    }
    this.measureFps(dt);
  }

  handleEvents() {
    const p = this.player;
    for (const e of p.events) {
      if (e === 'roll') this.stats.rolls++;
      if (e === 'roll') this.fx.burst(p.x, p.y, p.z, { count: 7, speed: 1.6, up: 1.2, color: 0xe9dcc0 });
      else if (e === 'land') {
        this.fx.burst(p.x, p.y, p.z, { count: 10, speed: 2.4, up: 1.4, color: 0xe9dcc0 });
        this.cam.shake = 3;
      } else if (e === 'fall') {
        this.toast('섬 밖으로 떨어졌어요! 체력 -20%');
        this.cam.shake = 5;
        this.vibrate(80);
      } else if (e === 'potion') {
        this.fx.burst(p.x, p.y, p.z + 0.6, { count: 12, speed: 1.5, up: 3, color: 0x7dff8a, gravity: 2 });
        this.toastWorld(p.x, p.y, p.z, '회복', 0x7dff8a);
      } else if (e === 'potionFail') {
        this.hud.flash('potion');
      } else if (e === 'dead') {
        this.toast('쓰러졌어요… 시작 지점에서 다시 일어나요');
        this.shake(6);
        this.vibrate(120);
        this.fx.burst(p.x, p.y, p.z + 0.4, { count: 20, speed: 3, up: 3, color: 0xe0524b, size: 2 });
      } else if (e === 'respawn') {
        this.cam.x = SX(p.x);
        this.cam.y = SY(p.y, p.z);
      } else if (e && e.type === 'hurt') {
        this.combat.number(p.x, p.y, p.z, e.dmg, false, 'hurt');
        this.shake(4);
        this.hurtFx();
        this.vibrate(50);
        this.hitstop(0.05);
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

const game = new Game();
if (import.meta.env.DEV) window.__game = game;
game.start().catch((e) => {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = '불러오기에 실패했어요. 새로고침해 주세요.';
  // eslint-disable-next-line no-console
  console.error(e);
});
