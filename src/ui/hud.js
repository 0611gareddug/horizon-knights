// 전투 HUD: 스킬바(PC), 전투 버튼(모바일), 궁극기 게이지, 물약, 원소 표시, 직업 선택
import { iconDataURL } from '../art/fx-art.js';
import { CLASSES, ELEM_NAME } from '../gameplay/classes.js';
import { CLASS_LOOKS, drawCharFrame, CHAR_W, CHAR_H } from '../art/character.js';

const $ = (id) => document.getElementById(id);
const ELEM_BG = { fire: 0x7a3218, ice: 0x1e4f73, lightning: 0x4a2a78 };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  constructor(game) {
    this.g = game;
    this.slots = {};
    this.last = {};
  }

  build(clsId) {
    const def = CLASSES[clsId];
    this.clsId = clsId;
    const isMage = clsId === 'mage';
    const items = [
      { key: 'attack', label: this.g.input.isTouch ? '' : '좌클릭', icon: def.basicIcon, name: '기본 공격' },
      ...def.skills.map((s, k) => ({ key: `skill${k + 1}`, label: 'QER'[k], icon: s.icon, name: s.name })),
      { key: 'ult', label: 'F', icon: def.ult.icon, name: def.ult.name, ult: true },
      { key: 'potion', label: '1', icon: 'potion', name: '회복 물약', count: true },
    ];
    if (isMage) items.push({ key: 'swap', label: 'Shift', icon: 'swap', name: '원소 바꾸기', elem: true });

    // ---- PC 스킬바 ----
    const bar = $('skillbar');
    bar.innerHTML = '';
    this.slots = {};
    for (const it of items) {
      const s = el('div', `slot${it.ult ? ' slot-ult' : ''}`);
      s.title = it.name;
      s.innerHTML = `<img src="${iconDataURL(it.icon, it.elem ? ELEM_BG.fire : 0x3b2a20)}" alt=""><div class="cd"></div><div class="cdt"></div>${
        it.ult ? '<div class="ultfill"></div>' : ''
      }<span class="key">${it.label}</span>${it.count ? '<span class="cnt"></span>' : ''}`;
      bar.appendChild(s);
      this.slots[it.key] = { pc: s, def: it };
    }

    // ---- 모바일 버튼 ----
    const tb = $('touch-buttons');
    tb.innerHTML = '';
    const layout = {
      attack: [0, 0, 92],
      skill1: [104, 4, 62],
      skill2: [92, 74, 62],
      skill3: [30, 110, 62],
      ult: [168, 76, 62],
      roll: [176, 4, 58],
      potion: [112, 146, 50],
      swap: [-2, 182, 50],
    };
    const touchItems = [...items, { key: 'roll', icon: 'leap', name: '구르기' }];
    for (const it of touchItems) {
      const L = layout[it.key];
      if (!L) continue;
      const b = el('button', `tbtn${it.key === 'attack' ? ' tbtn-big' : ''}${it.ult ? ' slot-ult' : ''}`);
      b.style.right = `${L[0]}px`;
      b.style.bottom = `${L[1]}px`;
      b.style.width = b.style.height = `${L[2]}px`;
      b.innerHTML = `<img src="${iconDataURL(it.icon, null)}" alt=""><div class="cd"></div><div class="cdt"></div>${
        it.ult ? '<div class="ultfill"></div>' : ''
      }${it.count ? '<span class="cnt"></span>' : ''}`;
      tb.appendChild(b);
      const drag = it.key.startsWith('skill') || it.key === 'ult';
      this.g.input.attachButton(b, it.key, { dragAim: drag, hold: it.key === 'attack' });
      if (this.slots[it.key]) this.slots[it.key].mb = b;
      else this.slots[it.key] = { mb: b, def: it };
    }
    $('elem').classList.toggle('hidden', !isMage);
    this.last = {};
  }

  setElem(elem) {
    const e = $('elem');
    e.textContent = `원소: ${ELEM_NAME[elem]}`;
    e.dataset.elem = elem;
    const url = iconDataURL('swap', ELEM_BG[elem]);
    const s = this.slots.swap;
    if (s) {
      s.pc?.querySelector('img') && (s.pc.querySelector('img').src = url);
      if (s.mb) s.mb.style.background = `#${ELEM_BG[elem].toString(16).padStart(6, '0')}`;
    }
  }

  flash(key) {
    const s = this.slots[key];
    for (const n of [s?.pc, s?.mb]) {
      if (!n) continue;
      n.classList.remove('denied');
      void n.offsetWidth;
      n.classList.add('denied');
    }
  }

  // 매 프레임: 바뀐 값만 DOM에 반영
  update(ctrl, player) {
    const set = (key, cdLeft, cdMax, extra) => {
      const s = this.slots[key];
      if (!s) return;
      const k = cdMax > 0 ? Math.round((cdLeft / cdMax) * 40) : 0;
      const txt = cdLeft > 0.05 ? (cdLeft >= 1 ? Math.ceil(cdLeft) : cdLeft.toFixed(1)) : '';
      const sig = `${k}|${txt}|${extra ?? ''}`;
      if (this.last[key] === sig) return;
      this.last[key] = sig;
      for (const n of [s.pc, s.mb]) {
        if (!n) continue;
        n.querySelector('.cd').style.background = k > 0 ? `conic-gradient(rgba(10,8,16,.72) ${(k / 40) * 360}deg, transparent 0)` : 'none';
        n.querySelector('.cdt').textContent = txt;
        if (extra !== undefined) {
          const f = n.querySelector('.ultfill');
          if (f) {
            f.style.height = `${extra}%`;
            n.classList.toggle('ready', extra >= 100);
          }
          const c = n.querySelector('.cnt');
          if (c) c.textContent = extra;
        }
      }
    };
    const def = CLASSES[this.clsId];
    def.skills.forEach((sk, k) => set(`skill${k + 1}`, ctrl.cds[k], sk.cd));
    set('ult', 0, 0, Math.floor(player.ult));
    set('potion', player.potionCd, 15, player.potions);
    set('attack', 0, 0, ctrl.id === 'archer' ? Math.round(ctrl.charge * 10) : undefined);
    const a = this.slots.attack;
    const ch = ctrl.charging ? ctrl.charge : 0;
    for (const n of [a?.pc, a?.mb]) if (n) n.style.setProperty('--charge', ch);
  }
}

// 직업 미리보기 그림 (CSS로 확대)
export function classPreviewURL(clsId) {
  const pc = drawCharFrame(CLASS_LOOKS[clsId], 'D', 'idle', 0);
  const c = document.createElement('canvas');
  c.width = CHAR_W;
  c.height = CHAR_H;
  const ctx = c.getContext('2d');
  ctx.putImageData(pc.toImageData(ctx), 0, 0);
  return c.toDataURL();
}

export function buildClassSelect(onPick) {
  const box = $('class-list');
  box.innerHTML = '';
  for (const [id, d] of Object.entries(CLASSES)) {
    const card = el('button', 'class-card');
    const bars = [
      ['체력', d.hp / 150],
      ['공격', d.atk / 16],
      ['방어', d.def / 10],
    ]
      .map(([n, v]) => `<div class="stat"><span>${n}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`)
      .join('');
    card.innerHTML = `<img class="class-img" src="${classPreviewURL(id)}" alt=""><b>${d.name}</b><p>${d.desc}</p>${bars}`;
    card.addEventListener('click', () => onPick(id));
    box.appendChild(card);
  }
}
