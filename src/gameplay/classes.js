// 직업 정의와 공격/스킬 로직
import { Sprite } from 'pixi.js';
import { ELEM_COLOR } from './combat.js';

export const CLASSES = {
  warrior: {
    name: '전사',
    desc: '묵직한 탱커. 방패와 검으로 적을 막아서요.',
    hp: 150,
    atk: 12,
    def: 10,
    speed: 4.1,
    weapon: 'wpn_sword',
    skills: [
      { id: 'dash', name: '방패 돌진', cd: 7, icon: 'shield' },
      { id: 'taunt', name: '도발의 함성', cd: 14, icon: 'shout' },
      { id: 'slam', name: '대지 강타', cd: 10, icon: 'slam' },
    ],
    ult: { name: '수호 기사의 성벽', icon: 'fortress' },
    basicIcon: 'slash',
  },
  archer: {
    name: '궁수',
    desc: '저격수. 길게 당길수록 강한 화살이 관통해요.',
    hp: 100,
    atk: 16,
    def: 5,
    speed: 4.4,
    weapon: 'wpn_bow',
    skills: [
      { id: 'leap', name: '후방 도약', cd: 6, icon: 'leap' },
      { id: 'mark', name: '약점 표식', cd: 12, icon: 'mark' },
      { id: 'rain', name: '화살비', cd: 11, icon: 'rain' },
    ],
    ult: { name: '천공 저격', icon: 'snipe' },
    basicIcon: 'arrow',
  },
  mage: {
    name: '마법사',
    desc: '불, 얼음, 번개를 바꿔 쓰고 섞어서 원소 반응을 일으켜요.',
    hp: 90,
    atk: 15,
    def: 4,
    speed: 4.3,
    weapon: 'wpn_staff',
    skills: [
      { id: 'bolt', name: '원소 탄', cd: 5, icon: 'bolt' },
      { id: 'field', name: '원소 장판', cd: 12, icon: 'field' },
      { id: 'blink', name: '순간이동', cd: 8, icon: 'blink' },
    ],
    ult: { name: '원소 폭주', icon: 'overload' },
    basicIcon: 'orb',
  },
};

const ELEMS = ['fire', 'ice', 'lightning'];
export const ELEM_NAME = { fire: '불', ice: '얼음', lightning: '번개' };

export class ClassController {
  constructor(game, player, clsId) {
    this.g = game;
    this.p = player;
    this.id = clsId;
    this.def = CLASSES[clsId];
    this.cds = [0, 0, 0];
    this.combo = 0;
    this.comboT = 0;
    this.atkT = 0; // 공격 동작 남은 시간
    this.atkCd = 0;
    this.charge = 0;
    this.charging = false;
    this.elem = 'fire';
    this.overload = 0;
    this.swing = 0; // 무기 휘두름 진행
    this.aimAngle = Math.PI / 2;
    // 무기 그림
    this.weapon = new Sprite(game.atlas.tex(this.def.weapon));
    const m = game.atlas.anchor(this.def.weapon);
    this.weapon.anchor.set(m.ax / m.w, m.ay / m.h);
    player.view.addChild(this.weapon);
    player.applyClass(this.def);
  }

  destroy() {
    this.weapon.parent?.removeChild(this.weapon);
  }

  get cdMul() {
    return this.overload > 0 ? 0.5 : 1;
  }

  atk(mult) {
    return this.p.atk * mult;
  }

  // aim: { dx, dy, tx, ty }  (방향 + 목표 지점)
  update(dt, input, aim) {
    const p = this.p;
    for (let k = 0; k < 3; k++) this.cds[k] = Math.max(0, this.cds[k] - dt / this.cdMul);
    this.atkT = Math.max(0, this.atkT - dt);
    this.atkCd = Math.max(0, this.atkCd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;
    this.overload = Math.max(0, this.overload - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.aimAngle = Math.atan2(aim.dy, aim.dx);
    if (!p.alive) return;
    const busy = p.rollT > 0 || p.lockT > 0;

    if (this.id === 'mage' && input.consume('swap')) {
      this.elem = ELEMS[(ELEMS.indexOf(this.elem) + 1) % 3];
      this.g.onElemChange?.(this.elem);
    }

    // 기본 공격
    if (this.id === 'archer') {
      if (input.keys.has('attack') && !busy && this.atkCd <= 0) {
        this.charging = true;
        this.charge = Math.min(1, this.charge + dt);
        p.moveMul = 0.45;
        p.faceTo(aim.dx, aim.dy);
      } else if (this.charging) {
        this.charging = false;
        p.moveMul = 1;
        if (!busy) this.fireArrow(aim, this.charge);
        this.charge = 0;
      }
    } else if ((input.keys.has('attack') || input.consume('attack')) && !busy && this.atkCd <= 0) {
      if (this.id === 'warrior') this.swordSwing(aim);
      else this.castOrb(aim);
    }
    input.consume('attack');

    // 스킬
    for (let k = 0; k < 3; k++) {
      if (!input.consume(`skill${k + 1}`)) continue;
      if (this.cds[k] > 0 || busy) {
        if (this.cds[k] > 0) this.g.uiFlash?.(`skill${k + 1}`);
        continue;
      }
      const sk = this.def.skills[k];
      this.cds[k] = sk.cd;
      this[`sk_${sk.id}`](aim);
      this.g.stats.skills++;
    }
    if (input.consume('ult')) {
      if (p.ult >= 100 && !busy) {
        p.ult = 0;
        this[`ult_${this.id}`](aim);
      } else this.g.uiFlash?.('ult');
    }
  }

  // ---------------- 전사 ----------------
  swordSwing(aim) {
    const p = this.p;
    const c = this.g.combat;
    const idx = this.combo;
    const last = idx === 2;
    this.combo = (this.combo + 1) % 3;
    this.comboT = 0.75;
    this.atkCd = last ? 0.5 : 0.3;
    this.atkT = 0.18;
    this.swing = 0.18;
    this.swingFlip = idx % 2 === 1;
    p.faceTo(aim.dx, aim.dy);
    p.lunge(aim.dx, aim.dy, last ? 1.6 : 1.0);
    const hits = c.inArc(p.x, p.y, aim.dx, aim.dy, last ? 1.55 : 1.35, 1.15);
    c.slashFx(p.x, p.y, p.z, this.aimAngle, last, this.swingFlip);
    this.g.sfx.swing();
    for (const e of hits) c.damage(e, this.atk(last ? 1.5 : 1), { kx: aim.dx, ky: aim.dy, knock: last ? 7 : 2.5 });
    if (hits.length) {
      this.g.hitstop(last ? 0.08 : 0.045);
      this.g.shake(last ? 3 : 1.5);
      this.g.vibrate(last ? 25 : 12);
    }
  }

  sk_dash(aim) {
    const p = this.p;
    const c = this.g.combat;
    p.dash(aim.dx, aim.dy, 4, 0.25);
    const hit = new Set();
    const tick = () => {
      for (const e of c.inCircle(p.x, p.y, 0.8)) {
        if (hit.has(e)) continue;
        hit.add(e);
        c.damage(e, this.atk(1.5), { kx: aim.dx, ky: aim.dy, knock: 8, stun: 1 });
        this.g.hitstop(0.06);
        this.g.shake(3);
      }
    };
    for (let k = 0; k < 6; k++) c.after(k * 0.045, tick);
  }

  sk_taunt() {
    const p = this.p;
    const c = this.g.combat;
    p.addBuff('guard', 4, 0.3);
    c.ringFx(p.x, p.y, p.z, 1.4, 0xffe08a, 0.4);
    for (const e of c.inCircle(p.x, p.y, 5)) e.st.stun = Math.max(e.st.stun, 0.3);
    this.g.shake(2);
    this.g.toastWorld(p.x, p.y, p.z, '도발!', 0xffe08a);
  }

  sk_slam() {
    const p = this.p;
    const c = this.g.combat;
    p.lockT = 0.28;
    c.telegraph(p.x, p.y, p.z, 3, 0.22, 0xffd27a);
    c.after(0.22, () => {
      for (const e of c.inCircle(p.x, p.y, 3)) c.damage(e, this.atk(2.2), { kx: e.x - p.x, ky: e.y - p.y, knock: 9 });
      c.ringFx(p.x, p.y, p.z, 2.2, 0xffffff, 0.35);
      this.g.fx.burst(p.x, p.y, p.z, { count: 26, speed: 5, up: 4, color: 0x96603c, size: 2, life: 0.6 });
      this.g.hitstop(0.1);
      this.g.shake(6);
      this.g.vibrate(40);
    });
  }

  ult_warrior() {
    const p = this.p;
    const c = this.g.combat;
    p.addBuff('guard', 6, 0.5);
    c.area({
      x: p.x,
      y: p.y,
      z: p.z,
      r: 2.5,
      time: 6,
      tick: 0.5,
      color: 0xffe08a,
      follow: p,
      onTick: (es) => es.forEach((e) => c.damage(e, this.atk(0.4), { noKnock: true, quiet: true })),
    });
    c.ringFx(p.x, p.y, p.z, 2, 0xffe08a, 0.5);
    this.g.shake(5);
    this.g.toastWorld(p.x, p.y, p.z, '수호 기사의 성벽!', 0xffe08a);
  }

  // ---------------- 궁수 ----------------
  fireArrow(aim, charge) {
    const p = this.p;
    const c = this.g.combat;
    const full = charge >= 0.98;
    this.atkCd = 0.22;
    this.g.sfx.shoot();
    p.faceTo(aim.dx, aim.dy);
    c.shoot({
      x: p.x + aim.dx * 0.4,
      y: p.y + aim.dy * 0.4,
      z: p.z + 0.6,
      dx: aim.dx,
      dy: aim.dy,
      speed: full ? 22 : 15,
      range: full ? 12 : 9,
      tex: full ? 'arrow_big' : 'arrow',
      pierce: full,
      onHit: (e) => {
        c.damage(e, this.atk(1 + charge * 1.5), { kx: aim.dx, ky: aim.dy, knock: full ? 5 : 2, crit: full ? undefined : undefined });
        if (full) this.g.hitstop(0.04);
      },
    });
    if (full) {
      this.g.shake(1.5);
      this.g.fx.burst(p.x + aim.dx * 0.5, p.y + aim.dy * 0.5, p.z + 0.6, { count: 6, speed: 2, color: 0xfff1a8 });
    }
  }

  sk_leap(aim) {
    const p = this.p;
    const c = this.g.combat;
    p.dash(-aim.dx, -aim.dy, 3, 0.28, true);
    c.after(0.05, () => {
      for (const off of [-0.25, 0, 0.25]) {
        const a = Math.atan2(aim.dy, aim.dx) + off;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        c.shoot({ x: p.x, y: p.y, z: p.z + 0.6, dx, dy, speed: 16, range: 8, tex: 'arrow', onHit: (e) => c.damage(e, this.atk(0.9), { kx: dx, ky: dy }) });
      }
    });
  }

  sk_mark(aim) {
    const p = this.p;
    const c = this.g.combat;
    c.shoot({
      x: p.x,
      y: p.y,
      z: p.z + 0.6,
      dx: aim.dx,
      dy: aim.dy,
      speed: 18,
      range: 10,
      tex: 'orb_s',
      tint: 0xe0524b,
      rot: false,
      onHit: (e) => {
        e.st.mark = 8;
        c.damage(e, this.atk(0.6), { kx: aim.dx, ky: aim.dy });
        this.g.toastWorld(e.x, e.y, e.z, '표식', 0xe0524b);
      },
    });
  }

  sk_rain(aim) {
    const c = this.g.combat;
    const { tx, ty } = aim;
    const z = this.g.terrain.groundAt(tx, ty);
    c.area({
      x: tx,
      y: ty,
      z: z === -Infinity ? this.p.z : z,
      r: 2.5,
      time: 2,
      tick: 0.25,
      color: 0xe9e2cf,
      onTick: (es, a) => {
        es.forEach((e) => c.damage(e, this.atk(0.45), { noKnock: true, quiet: false }));
        for (let k = 0; k < 3; k++) {
          const ang = Math.random() * Math.PI * 2;
          const rr = Math.random() * a.r;
          this.g.fx.burst(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr, a.z, { count: 2, speed: 1, up: 1, color: 0xe9e2cf });
        }
      },
    });
  }

  ult_archer(aim) {
    const p = this.p;
    const c = this.g.combat;
    p.lockT = 0.45;
    this.g.flashScreen(0.4);
    c.after(0.4, () => {
      c.shoot({
        x: p.x,
        y: p.y,
        z: p.z + 0.6,
        dx: aim.dx,
        dy: aim.dy,
        speed: 40,
        range: 16,
        tex: 'arrow_big',
        pierce: true,
        radius: 0.6,
        onHit: (e) => {
          c.damage(e, this.atk(6), { kx: aim.dx, ky: aim.dy, knock: 10, crit: true });
          this.g.hitstop(0.08);
        },
      });
      this.g.shake(6);
      this.g.vibrate(50);
    });
  }

  // ---------------- 마법사 ----------------
  elemsNow() {
    return this.overload > 0 ? ELEMS : [this.elem];
  }

  hitElem(e, mult, kx, ky, extra = {}) {
    const c = this.g.combat;
    const els = this.elemsNow();
    c.damage(e, this.atk(mult), { element: els[0], kx, ky, ...extra });
    for (const el of els) {
      if (el === 'lightning' && extra.chain !== false && Math.random() < (extra.chainChance ?? 0.15)) {
        const o = c.enemies.find((x) => x.alive && x !== e && Math.hypot(x.x - e.x, x.y - e.y) < 3);
        if (o) {
          c.damage(o, this.atk(mult * 0.6), { element: 'lightning', noKnock: true });
          c.applyElement(o, 'lightning', this.atk(mult));
        }
      }
      c.applyElement(e, el, this.atk(mult), kx, ky);
    }
  }

  castOrb(aim) {
    const p = this.p;
    const c = this.g.combat;
    this.atkCd = 0.34;
    this.swing = 0.12;
    this.g.sfx.shoot();
    p.faceTo(aim.dx, aim.dy);
    const col = ELEM_COLOR[this.overload > 0 ? 'lightning' : this.elem];
    c.shoot({
      x: p.x + aim.dx * 0.4,
      y: p.y + aim.dy * 0.4,
      z: p.z + 0.6,
      dx: aim.dx,
      dy: aim.dy,
      speed: 11,
      range: 8,
      tex: 'orb_s',
      tint: col,
      rot: false,
      onHit: (e) => this.hitElem(e, 1, aim.dx, aim.dy),
    });
  }

  sk_bolt(aim) {
    const p = this.p;
    const c = this.g.combat;
    const el = this.elem;
    const boom = (x, y, z) => {
      if (el === 'fire' || this.overload > 0) {
        for (const e of c.inCircle(x, y, 1.6)) this.hitElem(e, 2, e.x - x, e.y - y, { knock: 5, chain: false });
        c.ringFx(x, y, z, 1.2, ELEM_COLOR.fire, 0.3);
        this.g.fx.burst(x, y, z + 0.4, { count: 18, speed: 4, color: ELEM_COLOR.fire });
        this.g.shake(3);
      }
    };
    c.shoot({
      x: p.x,
      y: p.y,
      z: p.z + 0.6,
      dx: aim.dx,
      dy: aim.dy,
      speed: 13,
      range: 9,
      tex: 'orb_l',
      tint: ELEM_COLOR[el],
      rot: false,
      onHit: (e, pr) => {
        if (el === 'fire') return boom(pr.x, pr.y, e.z);
        if (el === 'ice') {
          this.hitElem(e, 1.5, aim.dx, aim.dy, { chain: false });
          e.st.frozen = 1.5;
          e.chill = 0;
        } else {
          // 번개: 4명까지 연쇄
          let cur = e;
          const done = new Set([e]);
          this.hitElem(e, 1.4, aim.dx, aim.dy, { chain: false });
          for (let k = 0; k < 3; k++) {
            const nx = c.enemies.find((x) => x.alive && !done.has(x) && Math.hypot(x.x - cur.x, x.y - cur.y) < 3.5);
            if (!nx) break;
            done.add(nx);
            const from = cur;
            c.after(0.08 * (k + 1), () => {
              this.hitElem(nx, 1.4, nx.x - from.x, nx.y - from.y, { chain: false });
              this.g.fx.burst(nx.x, nx.y, nx.z + 0.5, { count: 6, speed: 2, color: ELEM_COLOR.lightning });
            });
            cur = nx;
          }
        }
        if (this.overload > 0) boom(pr.x, pr.y, e.z);
      },
      onEnd: (pr) => {
        if (el === 'fire' && pr.hit.size === 0) boom(pr.x, pr.y, pr.z - 0.6);
      },
    });
  }

  sk_field(aim) {
    const c = this.g.combat;
    const el = this.elem;
    const { tx, ty } = aim;
    const z = this.g.terrain.groundAt(tx, ty);
    c.area({
      x: tx,
      y: ty,
      z: z === -Infinity ? this.p.z : z,
      r: 2,
      time: 5,
      tick: 0.5,
      color: ELEM_COLOR[el],
      onTick: (es) =>
        es.forEach((e) => {
          const mult = el === 'fire' ? 0.5 : el === 'ice' ? 0.25 : 0.35;
          c.damage(e, this.atk(mult), { element: el, noKnock: true, quiet: true });
          c.applyElement(e, el, this.atk(mult));
          if (el === 'lightning' && Math.random() < 0.15) e.st.stun = Math.max(e.st.stun, 0.6);
        }),
    });
  }

  sk_blink(aim) {
    const p = this.p;
    const c = this.g.combat;
    const fromX = p.x;
    const fromY = p.y;
    p.blink(aim.dx, aim.dy, 4);
    this.g.fx.burst(fromX, fromY, p.z + 0.5, { count: 12, speed: 2.5, color: 0xd8c4ff });
    for (const e of c.inCircle(p.x, p.y, 1.6)) this.hitElem(e, 1.6, e.x - p.x, e.y - p.y, { knock: 5 });
    c.ringFx(p.x, p.y, p.z, 1.3, ELEM_COLOR[this.elem], 0.3);
    this.g.shake(2);
  }

  ult_mage() {
    const p = this.p;
    this.overload = 10;
    this.g.combat.ringFx(p.x, p.y, p.z, 2.4, 0xffffff, 0.5);
    this.g.shake(4);
    this.g.toastWorld(p.x, p.y, p.z, '원소 폭주!', 0xffffff);
  }

  // ---------------- 무기 그림 ----------------
  renderWeapon() {
    const w = this.weapon;
    const p = this.p;
    const a = this.aimAngle;
    const up = Math.sin(a) < -0.3;
    // 위를 볼 때는 몸 뒤에
    const idx = p.view.getChildIndex(p.body);
    const want = up ? idx : idx + 1;
    if (p.view.getChildIndex(w) !== Math.min(want, p.view.children.length - 1)) {
      p.view.removeChild(w);
      p.view.addChildAt(w, up ? p.view.getChildIndex(p.body) : p.view.getChildIndex(p.body) + 1);
    }
    w.visible = p.alive && p.rollT <= 0 && !(p.knockedT > 0);
    const hx = Math.cos(a) * 4;
    const hy = -6 + Math.sin(a) * 2;
    w.x = Math.round(hx);
    w.y = Math.round(hy);
    if (this.id === 'warrior') {
      if (this.swing > 0) {
        const t = 1 - this.swing / 0.18;
        const dir = this.swingFlip ? -1 : 1;
        w.rotation = a + dir * (-1.4 + t * 2.8);
      } else w.rotation = a + 0.9;
    } else if (this.id === 'archer') {
      w.rotation = a;
      w.scale.set(1, 1);
      w.tint = this.charging && this.charge >= 0.98 ? 0xfff1a8 : 0xffffff;
    } else {
      w.rotation = this.swing > 0 ? a : a - 0.6;
      w.tint = ELEM_COLOR[this.overload > 0 ? ['fire', 'ice', 'lightning'][Math.floor(performance.now() / 120) % 3] : this.elem];
    }
  }
}
