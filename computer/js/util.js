// ============================================================
//  🧰 공용 도구 (SNG) — 다른 파일들이 다 같이 쓰는 아주 작은 도구 모음
//  · 기능을 더하는 파일이 아니라, 같은 코드를 여기저기 베껴 쓰지 않게 모아둔 곳입니다.
//  · index.html 에서 config.js 보다 먼저 불립니다.
// ============================================================
const Util = (() => {

  // ── 로그: 콘솔에서 어디서 난 문제인지 바로 보이게 [sng:이름] 을 붙입니다 ──
  const warn = (scope, ...rest) => { try { console.warn(`[sng:${scope}]`, ...rest); } catch {} };
  const fail = (scope, ...rest) => { try { console.error(`[sng:${scope}]`, ...rest); } catch {} };

  // 실패해도 앱이 죽지 않게 감싸는 실행기. 문제가 나면 fallback 을 돌려줍니다.
  function attempt(scope, fn, fallback) {
    try { return fn(); } catch (err) { warn(scope, err); return fallback; }
  }

  // ── HTML 넣기 전 이스케이프 (innerHTML 로 들어가는 모든 값에) ──
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

  // ── 링크/iframe 주소 검사 — javascript: · data: 같은 위험한 주소를 막습니다 ──
  //   허용: http(s) 절대주소, 프로젝트 안 상대주소(x.html?y, ./x, /x)
  const CTRL = /[\u0000-\u001f\u007f]/;
  function safeUrl(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    if (CTRL.test(s)) return '';                     // 제어문자 섞인 주소 차단
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
      return /^https?:\/\//i.test(s) ? s : '';       // 스킴이 붙었으면 http(s) 만 허용
    }
    if (s.startsWith('//')) return '';               // 프로토콜 상대주소는 안 씁니다
    return s;                                        // 프로젝트 안 상대주소
  }

  // ── localStorage: 사생활 보호 모드·용량 초과에서 예외를 던지는 걸 막아줍니다 ──
  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; }
      catch (err) { warn('store.get', key, err); return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (err) { warn('store.set', key, err); return false; }
    },
    remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } },
    // JSON 으로 저장된 값 읽기 — 없거나 깨져 있으면 fallback
    json(key, fallback) {
      const raw = store.get(key, null);
      if (raw === null) return fallback;
      try {
        const v = JSON.parse(raw);
        return (v === null || v === undefined) ? fallback : v;
      } catch (err) { warn('store.json', key, err); return fallback; }
    },
    setJSON(key, value) {
      try { return store.set(key, JSON.stringify(value)); }
      catch (err) { warn('store.setJSON', key, err); return false; }
    },
  };

  // ── 값 다루기 ──
  //  null · undefined · 빈 문자열은 "값이 없다" 로 봅니다.
  //  (자바스크립트는 +null 을 0 으로 읽어서, 그냥 두면 색이 검정(0)이 되어버립니다)
  const missing = (v) => v === null || v === undefined || typeof v === 'boolean'
    || (typeof v === 'string' && v.trim() === '');
  const clamp = (n, lo, hi) => (!missing(n) && Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : lo);
  const num = (v, fallback) => (!missing(v) && Number.isFinite(+v) ? +v : fallback);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v, max = 0) => {
    const s = typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v));
    return max > 0 ? s.slice(0, max) : s;
  };
  const el = (id) => document.getElementById(id);

  //  0xff8fb3 같은 숫자 색을 CSS 색(#ff8fb3)으로. 값이 없으면 흰색.
  const hex = (n) => '#' + (num(n, 0xffffff) >>> 0 & 0xffffff).toString(16).padStart(6, '0');

  return { warn, fail, attempt, esc, safeUrl, store, clamp, num, arr, str, el, hex };
})();
