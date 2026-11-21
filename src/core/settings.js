// 설정 저장 (기기 저장). 저장이 막힌 환경에서도 게임은 정상 동작한다.
const KEY = 'hk_settings_v1';

const DEFAULTS = {
  quality: 'auto', // auto | low | mid | high
  maxFps: 60,
  showFps: false,
  shake: true,
  vibrate: true,
  fontScale: 1,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* 저장소 사용 불가 */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}
