// 소스 보호: 우클릭, 개발자 도구 단축키, 선택/드래그 차단, 개발자 도구 감지
// 배포 빌드에서만 켜진다. (완벽한 보호는 불가능하며, 분석을 어렵게 만드는 수준)
export function enableProtection({ onDevtools, onDevtoolsClosed }) {
  const block = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };
  document.addEventListener('contextmenu', block, true);
  document.addEventListener('selectstart', block, true);
  document.addEventListener('dragstart', block, true);
  document.addEventListener(
    'keydown',
    (e) => {
      const k = e.key ? e.key.toUpperCase() : '';
      const ctrl = e.ctrlKey || e.metaKey;
      if (
        e.key === 'F12' ||
        (ctrl && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k)) ||
        (ctrl && e.altKey && ['I', 'J', 'C'].includes(k)) ||
        (ctrl && ['U', 'S', 'P'].includes(k))
      )
        return block(e);
    },
    true,
  );

  // 창 크기 차이로 도킹된 개발자 도구 감지 (데스크톱만)
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) return;
  let open = false;
  setInterval(() => {
    const wGap = window.outerWidth - window.innerWidth;
    const hGap = window.outerHeight - window.innerHeight;
    const now = wGap > 200 || hGap > 260;
    if (now && !open) {
      open = true;
      onDevtools?.();
    } else if (!now && open) {
      open = false;
      onDevtoolsClosed?.();
    }
  }, 1000);
}
