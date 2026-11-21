// 키보드와 터치 입력을 하나로 모은다.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 새로 눌린 동작
    this.joy = { x: 0, y: 0, active: false };
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.bindings = {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      roll: ['Space'],
      pause: ['Escape'],
    };
    this.codeToAction = new Map();
    for (const [a, codes] of Object.entries(this.bindings)) for (const c of codes) this.codeToAction.set(c, a);

    window.addEventListener('keydown', (e) => {
      const a = this.codeToAction.get(e.code);
      if (!a) return;
      if (!e.repeat) this.pressed.add(a);
      this.keys.add(a);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const a = this.codeToAction.get(e.code);
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => this.keys.clear());
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

  attachButton(el, action) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.press(action);
      el.classList.add('pressed');
      this.keys.add(action);
    });
    const up = () => {
      el.classList.remove('pressed');
      this.keys.delete(action);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }
}
