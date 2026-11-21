// 대화창: 초상화 + 이름 + 한 글자씩 나오는 대사 + 웅얼거림
import { CLASS_LOOKS, NPC_LOOKS, drawCharFrame, CHAR_W } from '../art/character.js';

const $ = (id) => document.getElementById(id);

export const SPEAKERS = {
  kaira: { name: '카이라', look: NPC_LOOKS.kaira, pitch: 1.35, color: '#2f8f7a' },
  bartol: { name: '바르톨 선장', look: NPC_LOOKS.bartol, pitch: 0.7, color: '#2f4f8f' },
  elian: { name: '엘리안', look: NPC_LOOKS.elian, pitch: 1.15, color: '#3c7a8f' },
  narrator: { name: '', look: null, pitch: 0.9 },
};

const portraitCache = new Map();
function portrait(look) {
  if (!look) return '';
  if (portraitCache.has(look)) return portraitCache.get(look);
  // 머리 부분만 잘라서 (모자 포함)
  const pc = drawCharFrame(look, 'D', 'idle', 0);
  const c = document.createElement('canvas');
  c.width = CHAR_W;
  c.height = 14;
  const full = document.createElement('canvas');
  full.width = pc.w;
  full.height = pc.h;
  const fctx = full.getContext('2d');
  fctx.putImageData(pc.toImageData(fctx), 0, 0);
  c.getContext('2d').drawImage(full, 0, 0, CHAR_W, 14, 0, 0, CHAR_W, 14);
  const url = c.toDataURL();
  portraitCache.set(look, url);
  return url;
}

export class Dialog {
  constructor(game) {
    this.g = game;
    this.box = $('dialog');
    this.resolve = null;
    this.typing = false;
    this.full = '';
    this.shown = 0;
    this.timer = 0;
    const adv = (e) => {
      if (this.box.classList.contains('hidden')) return;
      e?.preventDefault?.();
      this.advance();
    };
    this.box.addEventListener('pointerdown', adv);
    window.addEventListener('keydown', (e) => {
      if (['Space', 'Enter', 'KeyJ', 'KeyZ'].includes(e.code)) adv(e);
    });
  }

  playerSpeaker() {
    const look = CLASS_LOOKS[this.g.clsId || 'warrior'];
    return { name: this.g.save.name || '나', look, pitch: 1.0 };
  }

  say(who, text) {
    const sp = who === 'player' ? this.playerSpeaker() : SPEAKERS[who];
    const msg = text.replaceAll('{name}', this.g.save.name || '수습 기사');
    if (this.g.skipping) return Promise.resolve();
    this.box.classList.remove('hidden');
    this.box.classList.toggle('narration', who === 'narrator');
    const img = this.box.querySelector('.dlg-portrait');
    img.style.display = sp.look ? '' : 'none';
    if (sp.look) img.src = portrait(sp.look);
    const nm = this.box.querySelector('.dlg-name');
    nm.textContent = sp.name;
    nm.style.display = sp.name ? '' : 'none';
    nm.style.background = sp.color || '#6b4128';
    this.textEl = this.box.querySelector('.dlg-text');
    this.textEl.textContent = '';
    this.full = msg;
    this.shown = 0;
    this.typing = true;
    this.pitch = sp.pitch;
    this.timer = 0;
    this.box.querySelector('.dlg-next').classList.add('hidden');
    return new Promise((r) => {
      this.resolve = r;
    });
  }

  // 매 프레임
  update(dt) {
    if (!this.typing) return;
    this.timer += dt;
    const cps = 38;
    while (this.timer > 1 / cps && this.shown < this.full.length) {
      this.timer -= 1 / cps;
      this.shown++;
      const ch = this.full[this.shown - 1];
      if (ch !== ' ' && this.shown % 2 === 1) this.g.sfx.blip(this.pitch);
    }
    this.textEl.textContent = this.full.slice(0, this.shown);
    if (this.shown >= this.full.length) {
      this.typing = false;
      this.box.querySelector('.dlg-next').classList.remove('hidden');
    }
  }

  advance() {
    if (this.typing) {
      this.shown = this.full.length;
      this.textEl.textContent = this.full;
      this.typing = false;
      this.box.querySelector('.dlg-next').classList.remove('hidden');
      return;
    }
    const r = this.resolve;
    this.resolve = null;
    this.box.classList.add('hidden');
    r?.();
  }

  skipNow() {
    this.typing = false;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      this.box.classList.add('hidden');
      r();
    }
  }
}
