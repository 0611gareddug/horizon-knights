// 키보드와 터치 입력을 하나로 모은다.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 새로 눌린 동작
    this.joy = { x: 0, y: 0, active: false };
    this.mouse = { x: 0, y: 0, inside: false, used: false };
    this.aimOverride = null; // 터치 스킬 버튼을 끌어서 조준한 방향
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.bindings = {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      roll: ['Space'],
      pause: ['Escape'],
      attack: ['KeyJ'],
      skill1: ['KeyQ'],
      skill2: ['KeyE'],
      skill3: ['KeyR'],
      ult: ['KeyF'],
      potion: ['Digit1'],
      swap: ['ShiftLeft', 'ShiftRight', 'Tab'],
      interact: ['KeyG'],
    };
    this.codeToAction = new Map();
    for (const [a, codes] of Object.entries(this.bindings)) for (const c of codes) this.codeToAction.set(c, a);

    window.addEventListener('keydown', (e) => {
      const a = this.codeToAction.get(e.code);
      if (!a) return;
      if (!e.repeat) this.pressed.add(a);
      this.keys.add(a);
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const a = this.codeToAction.get(e.code);
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  attachMouse(el) {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.inside = true;
      this.mouse.used = true;
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      this.mouse.used = true;
      this.press('attack');
      this.keys.add('attack');
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.keys.delete('attack');
    });
  }

  // 화면 기준 이동 방향 (-1..1), 크기 0..1
  moveVector() {
    if (this.joy.active) return [this.joy.x, this.joy.y];
    let x = 0;
    let y = 0;
    if (this.keys.has('left')) x -= 1;
    if (this.keys.has('right')) x += 1;
    if (this.keys.has('up')) y -= 1;
    if (this.keys.has('down')) y += 1;
    const l = Math.hypot(x, y);
    return l > 0 ? [x / l, y / l] : [0, 0];
  }

  press(action) {
    this.pressed.add(action);
  }

  consume(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  // 왼쪽 화면 가상 조이스틱
  attachJoystick(zone, base, knob) {
    const R = 52;
    let id = null;
    let ox = 0;
    let oy = 0;
    const set = (cx, cy) => {
      let dx = cx - ox;
      let dy = cy - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, d / R);
      const dead = 0.18;
      const k = m < dead ? 0 : (m - dead) / (1 - dead);
      const l = Math.hypot(dx, dy) || 1;
      this.joy.x = (dx / l) * k;
      this.joy.y = (dy / l) * k;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      ox = e.clientX;
      oy = e.clientY;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      base.classList.remove('hidden');
      this.joy.active = true;
      set(ox, oy);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) set(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy.active = false;
      this.joy.x = 0;
      this.joy.y = 0;
      knob.style.transform = '';
      base.classList.add('hidden');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  // dragAim: 누른 채 끌면 그 방향으로 조준하고, 손을 뗄 때 발동
  attachButton(el, action, { dragAim = false, hold = false } = {}) {
    let id = null;
    let sx = 0;
    let sy = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      el.setPointerCapture(id);
      sx = e.clientX;
      sy = e.clientY;
      el.classList.add('pressed');
      if (!dragAim) {
        this.press(action);
        this.keys.add(action);
      }
      if (hold) this.keys.add(action);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !dragAim) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      el.classList.toggle('aiming', Math.hypot(dx, dy) > 18);
    });
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      el.classList.remove('pressed', 'aiming');
      if (dragAim) {
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        const len = Math.hypot(dx, dy);
        this.aimOverride = len > 18 ? { dx: dx / len, dy: dy / len, len } : null;
        this.press(action);
      }
      this.keys.delete(action);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
}
