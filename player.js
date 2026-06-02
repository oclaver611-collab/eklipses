/* ===== Global state ===== */
let currentScenarioKey = null;
let currentCharacterId = "sofia"; // active character — changes when user picks avatar

// Default character per scenario — overrideable by avatar picker
const SCENARIO_CHARACTER_MAP = {
  beach:        'sofia',
  bar:          'ava',
  museum:       'isabelle',
  gym:          'zoe',
  bookstore:    'nadia',
  street:       'julia',
  wedding:      'claire',
  // Wave 2 — May 2026
  rooftop:      'sanna',
  house_party:  'sarah',
  coffee_shop:  'anna',
  art_gallery:  'leila',
  yoga_studio:  'fatou',
  airport:      'elena',
  supermarket:  'eden',
  office_lobby: 'maya_office',
  train:        'erika',
};
let currentScript = null;
let isPractice = false;
let stepIndex = 0;
let rec = null;
let listenTimer = null;
let session = 0;

const els = {
  select:         document.getElementById('scenarioSelect'),
  enterPractice:  document.getElementById('enterPractice'),
  micBtn:         document.getElementById('micBtn'),
  chooseBtn:      document.getElementById('chooseAvatarBtn'),
  media:          document.getElementById('media'),
  name:           document.getElementById('speakerName'),
  text:           document.getElementById('lineText'),
  shelf:          document.getElementById('shelfList'),
  showMore:       document.getElementById('showMore'),
  listenPill:     document.getElementById('listenPill'),
  pickerBackdrop: document.getElementById('avatarPicker'),
  pickerGrid:     document.getElementById('pickerGrid'),
  likeBtn:        document.getElementById('likeBtn'),
  likeCount:      document.getElementById('likeCount'),
  viewCount:      document.getElementById('viewCount'),
  sceneBg:        document.getElementById('sceneBg'),
  stageFrame:     document.getElementById('stageFrame'),
};

/* ===== Metrics ===== */
const Metrics = (() => {
  const KEY = 'ek-metrics-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {scenarios:{}}; } catch { return {scenarios:{}}; } };
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const ensure = (s,id) => {
    if (!s.scenarios[id]) {
      const sc = (window.SCENARIOS||{})[id] || {};
      s.scenarios[id] = { views: sc.seedViews||0, likes: sc.seedLikes||0, youLiked:false, lastViewAt:0 };
    }
  };
  const get = id => { const s=load(); ensure(s,id); return s.scenarios[id]; };
  const bumpView = id => {
    if (!id) return;
    const s=load(); ensure(s,id);
    const m=s.scenarios[id], now=Date.now();
    if (now-(m.lastViewAt||0)>30000) { m.views++; m.lastViewAt=now; save(s); }
  };
  const toggleLike = id => {
    if (!id) return;
    const s=load(); ensure(s,id);
    const m=s.scenarios[id];
    m.youLiked ? (m.likes=Math.max(0,m.likes-1), m.youLiked=false) : (m.likes++, m.youLiked=true);
    save(s); return m;
  };
  const refreshUI = id => {
    if (!id) return;
    const m=get(id);
    if (els.viewCount) els.viewCount.textContent = m.views;
    if (els.likeCount) els.likeCount.textContent = m.likes;
    if (els.likeBtn) els.likeBtn.classList.toggle('btn-primary', !!m.youLiked);
  };
  const bindLikeButton = () => {
    if (!els.likeBtn) return;
    els.likeBtn.onclick = () => { if (!currentScenarioKey) return; toggleLike(currentScenarioKey); refreshUI(currentScenarioKey); };
  };
  return { bumpView, refreshUI, bindLikeButton, get };
})();

/* ===== Progress ===== */
// Tracks score history, streak, and session count in localStorage.
// Shows a thin stat bar on the main screen and a history row on the feedback card.
const Progress = (() => {
  const KEY = 'ek-progress-v1';

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { sessions: [], lastSessionDate: null }; }
    catch { return { sessions: [], lastSessionDate: null }; }
  };

  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };

  const recordSession = (score, scenarioKey, characterId) => {
    const d = load();
    const today = new Date().toDateString();
    d.sessions.push({ score, scenarioKey, characterId: characterId || 'sofia', date: today, ts: Date.now() });
    if (d.sessions.length > 50) d.sessions = d.sessions.slice(-50); // keep last 50
    d.lastSessionDate = today;
    save(d);
    refreshStatBar();
  };

  const getStreak = () => {
    const d = load();
    if (!d.sessions.length) return 0;
    const days = [...new Set(d.sessions.map(s => s.date))].sort().reverse();
    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (days[0] !== today && days[0] !== yesterday) return 0;
    let check = days[0] === today ? new Date() : new Date(Date.now() - 86400000);
    for (const day of days) {
      if (day === check.toDateString()) { streak++; check = new Date(check - 86400000); }
      else break;
    }
    return streak;
  };

  const getBest = () => {
    const d = load();
    if (!d.sessions.length) return null;
    return Math.max(...d.sessions.map(s => s.score));
  };

  const getTotal = () => load().sessions.length;

  const getLast = (n = 5) => {
    const d = load();
    return d.sessions.slice(-n).map(s => s.score);
  };

  const getImprovement = () => {
    const d = load();
    if (d.sessions.length < 2) return null;
    const first = d.sessions[0].score;
    const last = d.sessions[d.sessions.length - 1].score;
    return last - first;
  };

  const refreshStreakBadge = () => {
    const badge = document.getElementById('ek-streak-badge');
    if (!badge) return;
    const streak = getStreak();
    if (streak < 1) {
      badge.style.display = 'none';
      return;
    }
    // Scale up visual weight for milestone streaks
    const isHot  = streak >= 7;
    const isMid  = streak >= 3;
    badge.style.display      = 'flex';
    badge.style.background   = isHot ? '#2b1a00' : '#1e1a0e';
    badge.style.borderColor  = isHot ? '#ff8c00' : '#7a5500';
    badge.style.color        = isHot ? '#ffd06a' : '#ffb300';
    badge.style.fontSize     = isHot ? '15px' : isMid ? '14px' : '13px';
    badge.innerHTML = '&#128293; ' + streak + (streak === 1 ? '-day streak' : '-day streak');
    badge.onclick = showDashboard;
  };

  const refreshStatBar = () => {
    const bar = document.getElementById('ek-stat-bar');
    refreshStreakBadge();
    if (!bar) return;
    const streak = getStreak();
    const best = getBest();
    const total = getTotal();
    if (!total) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.style.cursor = 'pointer';
    bar.title = 'View progress dashboard';
    bar.innerHTML =
      (streak > 0 ? '<span>&#128293; ' + streak + '-day streak</span><span style="color:#2b2e36">•</span>' : '') +
      (best !== null ? '<span>&#127942; Best: ' + best + '/10</span><span style="color:#2b2e36">•</span>' : '') +
      '<span>&#127919; Sessions: ' + total + '</span>' +
      '<span style="color:#9ec1ff;font-size:11px">&#9660; details</span>';
    bar.onclick = showDashboard;
  };

  const showDashboard = () => {
    const existing = document.getElementById('ek-dashboard-modal');
    if (existing) { existing.remove(); return; }

    const d = load();
    if (!d.sessions.length) return;

    const streak = getStreak();
    const best = getBest();
    const total = getTotal();

    // Last 10 sessions, chronological for chart, reversed for list
    const chartSessions = d.sessions.slice(-10);
    const listSessions  = d.sessions.slice(-10).reverse();

    // Bar chart
    const maxH = 52;
    const bars = chartSessions.map(s => {
      const h = Math.max(6, Math.round((s.score / 10) * maxH));
      const color = s.score >= 7 ? '#40c770' : s.score >= 5 ? '#ffb300' : '#ff6b6b';
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">' +
        '<div style="font-size:10px;color:#9aa4b2;font-weight:700">' + s.score + '</div>' +
        '<div style="width:100%;height:' + h + 'px;background:' + color + ';border-radius:3px 3px 0 0"></div>' +
        '</div>';
    }).join('');

    // Session rows
    const rows = listSessions.map(s => {
      const scoreColor = s.score >= 7 ? '#40c770' : s.score >= 5 ? '#ffb300' : '#ff6b6b';
      const charRaw = s.characterId || 'sofia';
      const charLabel = charRaw.charAt(0).toUpperCase() + charRaw.slice(1).replace(/_/g, ' ');
      const scLabel = (s.scenarioKey || 'session').replace(/_/g, ' ');
      return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #23252e">' +
        '<div style="background:' + scoreColor + ';color:#000;font-weight:800;font-size:14px;border-radius:7px;' +
        'width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + s.score + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;color:#e9ecf1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        charLabel + ' &mdash; ' + scLabel + '</div>' +
        '<div style="font-size:11px;color:#9aa4b2;margin-top:1px">' + (s.date || '') + '</div>' +
        '</div></div>';
    }).join('');

    // Stat chips
    const chips =
      (streak > 0 ? '<div style="flex:1;background:#1d2026;border:1px solid #2b2e36;border-radius:10px;padding:10px 6px;text-align:center">' +
        '<div style="font-size:18px">&#128293;</div><div style="font-size:17px;font-weight:800;color:#ffb300;margin:2px 0">' + streak + '</div>' +
        '<div style="font-size:10px;color:#9aa4b2;text-transform:uppercase">Day streak</div></div>' : '') +
      (best !== null ? '<div style="flex:1;background:#1d2026;border:1px solid #2b2e36;border-radius:10px;padding:10px 6px;text-align:center">' +
        '<div style="font-size:18px">&#127942;</div><div style="font-size:17px;font-weight:800;color:#40c770;margin:2px 0">' + best + '/10</div>' +
        '<div style="font-size:10px;color:#9aa4b2;text-transform:uppercase">Best</div></div>' : '') +
      '<div style="flex:1;background:#1d2026;border:1px solid #2b2e36;border-radius:10px;padding:10px 6px;text-align:center">' +
      '<div style="font-size:18px">&#127919;</div><div style="font-size:17px;font-weight:800;color:#9ec1ff;margin:2px 0">' + total + '</div>' +
      '<div style="font-size:10px;color:#9aa4b2;text-transform:uppercase">Sessions</div></div>';

    const modal = document.createElement('div');
    modal.id = 'ek-dashboard-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML =
      '<div style="background:#1a1c22;border:1px solid #2b2e36;border-radius:16px;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;padding:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
          '<div style="font-size:18px;font-weight:800;color:#e9ecf1">Your Progress</div>' +
          '<button id="ek-dash-close" style="background:none;border:none;color:#9aa4b2;font-size:22px;cursor:pointer;padding:0;line-height:1">&times;</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:20px">' + chips + '</div>' +
        (chartSessions.length >= 2 ?
          '<div style="margin-bottom:20px">' +
            '<div style="font-size:11px;color:#9aa4b2;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">' +
            'Last ' + chartSessions.length + ' sessions</div>' +
            '<div style="display:flex;align-items:flex-end;gap:5px;height:72px;border-bottom:2px solid #2b2e36;padding-bottom:0">' + bars + '</div>' +
          '</div>' : '') +
        '<div>' +
          '<div style="font-size:11px;color:#9aa4b2;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Recent sessions</div>' +
          rows +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('ek-dash-close').addEventListener('click', () => modal.remove());
  };

  const getHistoryHTML = () => {
    const scores = getLast(5);
    if (!scores.length) return '';
    const improvement = getImprovement();
    const bars = scores.map(s => {
      const h = Math.round(4 + (s / 10) * 16);
      const color = s >= 7 ? '#40c770' : s >= 5 ? '#ffb300' : '#ff6b6b';
      return '<div style="width:8px;height:' + h + 'px;background:' + color + ';border-radius:2px;align-self:flex-end"></div>';
    }).join('');
    const scoreList = scores.join(' → ');
    const improvText = improvement !== null && improvement !== 0
      ? '<span style="color:' + (improvement > 0 ? '#40c770' : '#ff6b6b') + ';font-weight:700">' +
        (improvement > 0 ? '+' : '') + improvement + ' since you started</span>'
      : '';
    return '<div style="background:#161820;border:1px solid #2b2e3a;border-radius:10px;padding:12px;margin-bottom:10px">' +
      '<div style="color:#9aa4b2;font-size:11px;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Your progress</div>' +
      '<div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:6px">' + bars + '</div>' +
      '<div style="color:#cfd6e4;font-size:12px">' + scoreList +
      (improvText ? ' &nbsp;' + improvText : '') + '</div>' +
      '</div>';
  };

  return { recordSession, refreshStatBar, refreshStreakBadge, getHistoryHTML, getStreak, getBest, getTotal, showDashboard };
})();

/* ===== Daily Session Limit ===== */
// Three-layer gate: localStorage + FingerprintJS + server-side IP (in api/character.js + api/tts.js)
// Dev bypass: visit ?dev=YOUR_SECRET once — sets a 1-year cookie, unlimited on that device forever
// Reset dev cookie: visit ?resetdev=true

const DailyLimit = (() => {
  const LIMIT = 3;
  const KEY = 'ek-daily-v1';
  const DEV_COOKIE = 'ek_dev_bypass';
  const DEV_KEY_STORAGE = 'ek-dev-key';
  const STRIPE_CUS_KEY = 'ek-stripe-cus';

  // ── Cookie helpers ──────────────────────────────────────────────────────
  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Strict';
  }
  function getCookie(name) {
    const v = document.cookie.match('(^|;)\s*' + name + '\s*=\s*([^;]+)');
    return v ? v.pop() : null;
  }
  function deleteCookie(name) {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
  }

  // ── Handle ?dev=SECRET, ?resetdev=true, ?stripe_session=xxx in URL ────────
  async function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const devKey = params.get('dev');
    const reset = params.get('resetdev');
    const stripeSession = params.get('stripe_session');

    if (reset === 'true') {
      deleteCookie(DEV_COOKIE);
      localStorage.removeItem(DEV_KEY_STORAGE);
      console.log('[DailyLimit] Dev bypass cleared.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (devKey) {
      setCookie(DEV_COOKIE, devKey, 365);
      localStorage.setItem(DEV_KEY_STORAGE, devKey);
      console.log('[DailyLimit] Dev bypass activated on this device.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (stripeSession && stripeSession.startsWith('cs_')) {
      window.history.replaceState({}, '', window.location.pathname);
      try {
        const r = await fetch(`/api/verify-payment?session_id=${stripeSession}`);
        const data = await r.json();
        if (data.active && data.customerId) {
          setStripeCustomer(data.customerId);
          console.log('[DailyLimit] Pro subscription activated:', data.customerId);
          const banner = document.createElement('div');
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffb300;color:#000;text-align:center;padding:12px;font-weight:700;font-size:15px;z-index:99999;cursor:pointer';
          banner.textContent = 'Welcome to Eklipses Pro! Unlimited sessions activated.';
          banner.onclick = () => banner.remove();
          document.body.prepend(banner);
          setTimeout(() => banner.remove(), 5000);
        }
      } catch (e) {
        console.error('[DailyLimit] Stripe verify error:', e.message);
      }
    }
  }

  // ── Check if dev bypass is active on this device ────────────────────────
  function isDevBypass() {
    return !!(getCookie(DEV_COOKIE) || localStorage.getItem(DEV_KEY_STORAGE));
  }

  // ── Get dev key for API header ───────────────────────────────────────────
  function getDevKey() {
    return getCookie(DEV_COOKIE) || localStorage.getItem(DEV_KEY_STORAGE) || null;
  }

  // ── Stripe customer helpers ──────────────────────────────────────────────
  function getStripeCustomer() {
    return localStorage.getItem(STRIPE_CUS_KEY) || null;
  }
  function setStripeCustomer(customerId) {
    if (customerId) localStorage.setItem(STRIPE_CUS_KEY, customerId);
  }
  function isProSubscriber() {
    return !!getStripeCustomer();
  }

  // ── localStorage session counter ─────────────────────────────────────────
  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getLocalCount() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY)) || {};
      return d.date === getTodayKey() ? (d.count || 0) : 0;
    } catch { return 0; }
  }

  function incrementLocal() {
    try {
      const count = getLocalCount() + 1;
      localStorage.setItem(KEY, JSON.stringify({ date: getTodayKey(), count }));
      return count;
    } catch { return 1; }
  }

  // ── FingerprintJS check (async, best-effort) ─────────────────────────────
  async function getFingerprintCount() {
    try {
      if (typeof FingerprintJS === 'undefined') return 0;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const fpKey = 'ek-fp-' + getTodayKey() + '-' + result.visitorId;
      const count = parseInt(localStorage.getItem(fpKey) || '0', 10);
      localStorage.setItem(fpKey, String(count + 1));
      return count;
    } catch { return 0; }
  }

  // ── Show paywall overlay ──────────────────────────────────────────────────
  function showPaywall() {
    const existing = document.getElementById('ek-paywall');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ek-paywall';
    overlay.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:99999',
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;text-align:center'
    ].join(';');

    overlay.innerHTML = `
      <div style="font-size:44px;margin-bottom:12px">🔐</div>
      <div style="color:#fff;font-size:24px;font-weight:800;margin-bottom:10px;letter-spacing:-0.5px">
        You've used your 3 free sessions
      </div>
      <div style="color:#9aa4b2;font-size:15px;max-width:340px;margin-bottom:8px;line-height:1.6">
        Come back tomorrow for 3 more — or get unlimited practice with Eklipses Pro.
      </div>
      <div style="color:#ffb300;font-size:13px;max-width:300px;margin-bottom:28px;line-height:1.5">
        Unlimited sessions · All scenarios · Ryan coaching after every chat
      </div>
      <button id="ek-paywall-btn"
        style="background:#ffb300;color:#000;font-size:16px;font-weight:800;border:none;
               padding:15px 36px;border-radius:999px;cursor:pointer;margin-bottom:14px;
               min-width:260px;transition:opacity 0.2s">
        Upgrade to Pro — $19.99 CAD/month
      </button>
      <div style="color:#555;font-size:12px;margin-bottom:20px">No contract · Cancel anytime</div>
      <div style="color:#666;font-size:13px;cursor:pointer;text-decoration:underline"
           onclick="document.getElementById('ek-paywall').remove()">
        Come back tomorrow
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#ek-paywall-btn').addEventListener('click', async function() {
      this.textContent = 'Loading...';
      this.style.opacity = '0.7';
      this.disabled = true;
      try {
        const r = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await r.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'No checkout URL returned');
        }
      } catch (e) {
        console.error('[Paywall] Checkout error:', e.message);
        this.textContent = 'Error — try again';
        this.style.opacity = '1';
        this.disabled = false;
      }
    });
  }

  // ── Main check — call before starting a practice session ─────────────────
  async function canPlay() {
    await handleURLParams(); // process ?dev=, ?resetdev=, ?stripe_session=

    if (isDevBypass()) return true;
    if (isProSubscriber()) return true; // paid subscriber — unlimited

    // Layer 1: localStorage
    const localCount = getLocalCount();
    if (localCount >= LIMIT) {
      showPaywall();
      return false;
    }

    // Layer 2: FingerprintJS (async, non-blocking — if it fails we still proceed)
    const fpCount = await getFingerprintCount();
    if (fpCount >= LIMIT) {
      showPaywall();
      return false;
    }

    // Passed — increment and allow
    incrementLocal();
    return true;
  }

  // ── Inject auth headers into all API fetch calls via monkey-patch ─────────
  // Adds x-dev-key (dev bypass) and x-stripe-customer (paid subscriber) headers
  function patchFetch() {
    const _originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      if (typeof url === 'string' && (
        url.includes('/api/character') ||
        url.includes('/api/tts')
      )) {
        const devKey = getDevKey();
        const stripeCus = getStripeCustomer();
        if (devKey || stripeCus) {
          options.headers = options.headers || {};
          const isHeadersObj = options.headers instanceof Headers;
          if (devKey) {
            if (isHeadersObj) options.headers.set('x-dev-key', devKey);
            else options.headers['x-dev-key'] = devKey;
          }
          if (stripeCus) {
            if (isHeadersObj) options.headers.set('x-stripe-customer', stripeCus);
            else options.headers['x-stripe-customer'] = stripeCus;
          }
        }
      }
      return _originalFetch.call(this, url, options);
    };
  }

  return { canPlay, isDevBypass, isProSubscriber, patchFetch, handleURLParams };
})();

// Patch fetch immediately so dev key is always sent
DailyLimit.patchFetch();
// Handle URL params on load
DailyLimit.handleURLParams();

/* ===== Caption Overlay ===== */
// When Sofia speaks: play speaking video + show caption bar over her mouth
// When user speaks: play idle video + hide caption bar
// This creates the illusion of natural conversation without lip sync

const Caption = (() => {
  let overlayEl = null;
  let hideTimer = null;

  function getOrCreateOverlay() {
    if (overlayEl) return overlayEl;
    const frame = document.getElementById('stageFrame');
    if (!frame) return null;

    const el = document.createElement('div');
    el.id = 'ek-caption';
    el.style.cssText = [
      'position:absolute',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:10',
      'width:100%',
      'box-sizing:border-box',
      'background:rgba(0,0,0,0.97)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'border-top:1px solid rgba(255,255,255,0.08)',
      'padding:20px 24px',
      'text-align:center',
      'color:#fff',
      'font-size:16px',
      'font-weight:500',
      'line-height:1.5',
      'letter-spacing:0.01em',
      'min-height:200px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'opacity:0',
      'transition:opacity 0.2s ease',
      'pointer-events:none',
    ].join(';');

    frame.style.position = 'relative';
    frame.appendChild(el);
    overlayEl = el;
    return el;
  }

  function show(text) {
    const el = getOrCreateOverlay();
    if (!el) return;
    clearTimeout(hideTimer);
    el.textContent = text;
    el.style.opacity = '1';
  }

  function hide() {
    if (!overlayEl) return;
    overlayEl.style.opacity = '0';
    hideTimer = setTimeout(() => {
      if (overlayEl) overlayEl.textContent = '';
    }, 250);
  }

  return { show, hide };
})();





/* ===== Avatar sets ===== */
const AVATAR_SETS = [
  { id:'sofia',       label:'Sofia',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sofia_idle.mp4',    vibe:'Direct & self-contained',  scenario:'Beach' },
  { id:'isabelle',    label:'Isabelle', thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_thumb.jpg', maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_speaking.mp4', maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_idle.mp4', danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Isabelle_idle.mp4', vibe:'Intellectual & curious',   scenario:'Museum' },
  { id:'ava',         label:'Ava',      thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_thumb.jpg',      maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_speaking.mp4',      maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_idle.mp4',      danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Ava_idle.mp4',      vibe:'Sharp & direct',           scenario:'Bar' },
  { id:'zoe',         label:'Zoe',      thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_thumb.jpg',      maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_speaking.mp4',      maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_idle.mp4',      danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/zoe_idle.mp4',      vibe:'Direct & no-nonsense',     scenario:'Gym' },
  { id:'nadia',       label:'Nadia',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Nadia.jpg',          maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/nadia_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/nadia_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/nadia_idle.mp4',    vibe:'Warm & bookish',           scenario:'Bookstore' },
  { id:'julia',       label:'Julia',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/julia_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/julia_mary.mp4',        maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/julia_daniel.mp4',  danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/julia_daniel.mp4',  vibe:'Mysterious & confident',   scenario:'Street' },
  // ── Wave 2 — May 2026 — replace _thumb.jpg/_speaking.mp4/_idle.mp4 with real R2 URLs after HeyGen ──
  { id:'sanna',       label:'Sanna',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Sanna_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sanna_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sanna_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sanna_idle.mp4',    vibe:'Sharp & composed',         scenario:'Rooftop' },
  { id:'sarah',       label:'Sarah',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Sarah_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sarah_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sarah_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/sarah_idle.mp4',    vibe:'Warm & guarded',           scenario:'House Party' },
  { id:'anna',        label:'Anna',     thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Anna_thumb.jpg',     maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/anna_speaking.mp4',     maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/anna_idle.mp4',     danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/anna_idle.mp4',     vibe:'Creative & deflects',      scenario:'Coffee Shop' },
  { id:'leila',       label:'Leila',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Leila_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/leila_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/leila_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/leila_idle.mp4',    vibe:'Quiet & present',          scenario:'Art Gallery' },
  { id:'fatou',       label:'Fatou',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Fatou_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/fatou_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/fatou_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/fatou_idle.mp4',    vibe:'Direct & honest',          scenario:'Yoga Studio' },
  { id:'elena',       label:'Elena',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Elena_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/elena_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/elena_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/elena_idle.mp4',    vibe:'Witty & bantery',          scenario:'Airport' },
  { id:'eden',        label:'Eden',     thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Eden_thumb.jpg',     maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/eden_speaking.mp4',     maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/eden_idle.mp4',     danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/eden_idle.mp4',     vibe:'Warm & straight-talking',  scenario:'Supermarket' },
  { id:'maya_office', label:'Maya',     thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Maya_thumb.jpg',     maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/maya_speaking.mp4',     maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/maya_idle.mp4',     danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/maya_idle.mp4',     vibe:'Grounded & sharp',         scenario:'Office Lobby' },
  { id:'erika',       label:'Erika',    thumb:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/Erika_thumb.jpg',    maryVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/erika_speaking.mp4',    maryIdleVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/erika_idle.mp4',    danielVideo:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/erika_idle.mp4',    vibe:'Chaotic & fun',            scenario:'Train' },
];

const AVATARS = {
  Daniel:      { type:'video', src:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/bella9.mp4' },
  Mary:        { type:'video', src:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/bella1.mp4' },
  Ryan:        { type:'orb' },
  User_Prompt: { type:'video', src:'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/bella9.mp4' },
};

function applyAvatarSet(set) {
  if (!set) return;
  // Mary defaults to idle video — speaking video only loads during speech
  if (set.maryIdleVideo) AVATARS.Mary.src = set.maryIdleVideo;
  else if (set.maryVideo) AVATARS.Mary.src = set.maryVideo;
  if (set.danielVideo) { AVATARS.Daniel.src = set.danielVideo; AVATARS.User_Prompt.src = set.danielVideo; }
  // Store speaking video separately for use during speech
  AVATARS._marySpeakingVideo = set.maryVideo || null;
  AVATARS._maryIdleVideo = set.maryIdleVideo || set.danielVideo || null;

  // Preload speaking video in background to eliminate flicker on first speech
  if (set.maryVideo && set.maryVideo !== set.maryIdleVideo) {
    const preload = document.createElement('video');
    preload.src = set.maryVideo;
    preload.preload = 'auto';
    preload.muted = true;
    preload.style.display = 'none';
    preload.load();
    // Remove after preload to avoid memory leak
    preload.oncanplaythrough = () => { try { preload.remove(); } catch {} };
    document.body.appendChild(preload);
  }
}

/* ===== Stop everything ===== */
const __audioContexts = [];
if (typeof AudioContext !== 'undefined') {
  const Orig = AudioContext;
  window.AudioContext = function(...a) { const c=new Orig(...a); __audioContexts.push(c); return c; };
  window.AudioContext.prototype = Orig.prototype;
}

function stopEverything() {
  session++;
  try { document.querySelectorAll('audio').forEach(a=>{ try{a.muted=true;a.pause();a.src='';if(a.parentNode)a.parentNode.removeChild(a);}catch{} }); } catch {}
  try { if (typeof KokoroSpeech!=='undefined') KokoroSpeech.cancel(); } catch {}
  try { __audioContexts.forEach(c=>{ try{if(c.state==='running')c.suspend();}catch{} }); } catch {}
  if (rec) { try{rec.onresult=null;rec.onerror=null;rec.onend=null;rec.stop();}catch{}; rec=null; }
  if (listenTimer) { clearTimeout(listenTimer); listenTimer=null; }
}

/* ===== Ryan orb ===== */
let _ryanOrbEl=null, _ryanOrbAnimFrame=null, _ryanOrbT=0;

function getRyanOrb() {
  if (_ryanOrbEl) return _ryanOrbEl;
  const div = document.createElement('div');
  div.id = 'ryan-orb';
  div.innerHTML = `
    <style>
      #ryan-orb{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:440px;gap:14px}
      #ryan-orb .ro-wrap{position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center}
      #ryan-orb .ro-ring{position:absolute;border-radius:50%;border:1.5px solid #378ADD;opacity:0}
      #ryan-orb .ro-ring1{width:110px;height:110px} #ryan-orb .ro-ring2{width:130px;height:130px} #ryan-orb .ro-ring3{width:152px;height:152px}
      #ryan-orb .ro-orb{width:80px;height:80px;border-radius:50%;background:#378ADD;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
      #ryan-orb .ro-inner{width:54px;height:54px;border-radius:50%;background:#185FA5;display:flex;align-items:center;justify-content:center}
      #ryan-orb .ro-lbl{font-size:15px;font-weight:600;color:#B5D4F4;letter-spacing:.1em}
      #ryan-orb .ro-bars{display:flex;align-items:flex-end;gap:3px;height:32px}
      #ryan-orb .ro-bar{width:4px;background:#378ADD;border-radius:2px;min-height:4px}
    </style>
    <div class="ro-wrap">
      <div class="ro-ring ro-ring1" id="roR1"></div><div class="ro-ring ro-ring2" id="roR2"></div><div class="ro-ring ro-ring3" id="roR3"></div>
      <div class="ro-orb" id="roOrb"><div class="ro-inner"><span class="ro-lbl">R</span></div></div>
    </div>
    <div class="ro-bars" id="roBars"></div>`;
  const bars = div.querySelector('#roBars');
  for (let i=0;i<18;i++) { const b=document.createElement('div'); b.className='ro-bar'; b.style.height='4px'; bars.appendChild(b); }
  return div;
}

function ryanOrbSetState(state) {
  const orb=document.getElementById('ryan-orb'); if(!orb) return;
  cancelAnimationFrame(_ryanOrbAnimFrame); _ryanOrbT=0;
  const orbEl=orb.querySelector('#roOrb'), r1=orb.querySelector('#roR1'), r2=orb.querySelector('#roR2'), r3=orb.querySelector('#roR3'), bars=orb.querySelectorAll('.ro-bar');
  function tick() {
    _ryanOrbT+=0.08; const t=_ryanOrbT;
    if (state==='speaking') {
      const amp=0.5+0.5*Math.sin(t*1.2);
      bars.forEach((b,i)=>{ const w=Math.sin(t*2.5+i*0.5)*0.5+0.5; b.style.height=Math.round(6+w*22*amp)+'px'; b.style.background='#378ADD'; });
      orbEl.style.transform='scale('+(1+0.06*Math.sin(t*2.5)).toFixed(3)+')';
      r1.style.opacity=(0.25+0.25*Math.sin(t*1.8)).toFixed(3); r2.style.opacity=(0.15+0.15*Math.sin(t*1.8)).toFixed(3); r3.style.opacity=(0.08+0.08*Math.sin(t*1.8)).toFixed(3);
    } else if (state==='listening') {
      bars.forEach((b,i)=>{ b.style.height=Math.round(4+((Math.sin(t*1.2+i*0.4)*0.5+0.5))*9)+'px'; b.style.background='#9FE1CB'; });
      orbEl.style.transform='scale(1)'; r1.style.opacity='0.12'; r2.style.opacity='0'; r3.style.opacity='0';
    } else {
      bars.forEach(b=>{ b.style.height='4px'; b.style.background='#378ADD'; });
      orbEl.style.transform='scale(1)'; r1.style.opacity='0'; r2.style.opacity='0'; r3.style.opacity='0';
    }
    _ryanOrbAnimFrame=requestAnimationFrame(tick);
  }
  tick();
}

/* ===== Media ===== */
function setMediaForSpeaker(speaker) {
  const asset = AVATARS[speaker] || AVATARS.Ryan;
  const current = els.media;
  if (!current) return;

  if (asset.type==='orb') {
    if (current.id!=='ryan-orb') {
      if (current.tagName==='VIDEO') { try{current.pause();current.src='';}catch{} }
      const orbEl=getRyanOrb();
      current.replaceWith(orbEl);
      els.media=orbEl; _ryanOrbEl=orbEl;
    }
    ryanOrbSetState('silent');
    return;
  }

  if (_ryanOrbAnimFrame) { cancelAnimationFrame(_ryanOrbAnimFrame); _ryanOrbAnimFrame=null; }

  if (current.tagName!=='VIDEO') {
    const vid=document.createElement('video');
    vid.id='media'; vid.className=current.className||'media';
    vid.autoplay=true; vid.loop=true; vid.muted=true; vid.playsInline=true;
    vid.style.cssText='width:100%;height:440px;object-fit:cover;';
    vid.src=asset.src;
    current.replaceWith(vid); els.media=vid;
    vid.load(); try{vid.play().catch(()=>{});}catch{}
  } else {
    if ((current.getAttribute('src')||'')!==asset.src) { current.src=asset.src; current.load(); }
    try{current.play().catch(()=>{});}catch{}
  }
}

/* Ken Burns keyframes — injected once */
(function injectKenBurnsStyles() {
  if (document.getElementById('ek-kb-styles')) return;
  const style = document.createElement('style');
  style.id = 'ek-kb-styles';
  style.textContent = `
    @keyframes kenBurns1 { 0%{transform:scale(1)    translateX(0%)    translateY(0%)}    100%{transform:scale(1.12) translateX(-2%)   translateY(-1.5%)} }
    @keyframes kenBurns2 { 0%{transform:scale(1.08) translateX(-1.5%) translateY(-1%)}  100%{transform:scale(1)    translateX(1.5%)  translateY(1%)}    }
    @keyframes kenBurns3 { 0%{transform:scale(1)    translateX(1%)    translateY(0%)}    100%{transform:scale(1.1)  translateX(-1%)   translateY(-2%)}   }
    @keyframes kenBurns4 { 0%{transform:scale(1.06) translateX(0%)    translateY(-1.5%)} 100%{transform:scale(1)    translateX(-1.5%) translateY(1%)}    }
    .scene-bg {
      position:absolute;inset:0;width:100%;height:100%;
      object-fit:cover;z-index:0;
      transform-origin:center center;
      will-change:transform;
    }
    .scene-bg.kb-active {
      animation-duration:14s;
      animation-timing-function:ease-in-out;
      animation-iteration-count:infinite;
      animation-direction:alternate;
    }
  `;
  document.head.appendChild(style);
})();

const KB_ANIMS = ['kenBurns1','kenBurns2','kenBurns3','kenBurns4'];
let _kbIndex = 0;

function setSceneBackground(key) {
  const sc=(SCENARIOS[key])||{};
  const frameEl=els.stageFrame;
  if (!frameEl) return;
  const old=frameEl.querySelector('.scene-bg');
  if (old) { try{if(old.tagName==='VIDEO'){old.pause();old.src='';}}catch{} old.remove(); }
  if (!sc.bg) { frameEl.classList.remove('has-bg'); return; }
  const isVideo=/\.mp4$/i.test(sc.bg);
  const bgEl=document.createElement(isVideo?'video':'img');
  bgEl.className='scene-bg';
  if (isVideo) {
    bgEl.autoplay=true; bgEl.loop=true; bgEl.muted=true; bgEl.playsInline=true;
  } else {
    // Apply Ken Burns — pick next animation in rotation so each scenario feels different
    const anim = KB_ANIMS[_kbIndex % KB_ANIMS.length];
    _kbIndex++;
    bgEl.onload = () => {
      bgEl.classList.add('kb-active');
      bgEl.style.animationName = anim;
    };
  }
  bgEl.src=sc.bg;
  frameEl.insertBefore(bgEl, frameEl.firstChild);
  frameEl.classList.add('has-bg');
  els.sceneBg=bgEl;
  if (isVideo) { bgEl.load(); bgEl.play().catch(()=>{}); }
}

function renderLine(line) {
  setMediaForSpeaker(line.speaker);
  if (line.speaker==='User_Prompt') {
    els.name.textContent = 'Your Turn';
  } else if (line.speaker==='Mary') {
    els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
  } else {
    els.name.textContent = line.speaker;
  }
  if (line.speaker==='User_Prompt') {
    els.text.innerHTML = `<div class="practice-prompt"><strong>READ THIS OUT LOUD:</strong><br><br>"${line.text.replace('Say: ','').replace(/'/g,'')}"</div><div class="user-response-area">🎤 Speak when ready…</div>`;
  } else {
    els.text.textContent = line.text;
  }
}

/* ===== TTS ===== */

// ElevenLabs/OpenAI TTS for character voices — streaming playback for low latency
async function speakElevenLabs(text, onStart) {
  async function attempt() {
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 10000);
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'nova', characterId: currentCharacterId }),
      signal: fetchController.signal,
    });
    clearTimeout(fetchTimeout);
    if (!res.ok) throw new Error('TTS failed: ' + res.status);

    // Use MediaSource streaming — audio starts playing as first chunks arrive
    // Falls back to full buffer decode if MediaSource not supported
    if (window.MediaSource && MediaSource.isTypeSupported('audio/mpeg')) {
      return new Promise((resolve, reject) => {
        const mediaSource = new MediaSource();
        const audio = new Audio();
        audio.src = URL.createObjectURL(mediaSource);
        const sourceOpenTimer = setTimeout(() => reject(new Error('sourceopen timeout')), 8000);

        mediaSource.addEventListener('sourceopen', async () => {
          clearTimeout(sourceOpenTimer);
          const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
          sourceBuffer.addEventListener('updateerror', () => reject(new Error('sourceBuffer updateerror')));
          const reader = res.body.getReader();
          let started = false;

          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await Promise.race([
                  reader.read(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('stream stall timeout')), 5000)),
                ]);
                if (done) {
                  const tryEnd = () => {
                    if (!sourceBuffer.updating) mediaSource.endOfStream();
                    else sourceBuffer.addEventListener('updateend', tryEnd, { once: true });
                  };
                  tryEnd();
                  break;
                }
                // Wait if buffer is updating
                if (sourceBuffer.updating) {
                  await new Promise((res, rej) => {
                    const t = setTimeout(() => rej(new Error('updateend timeout')), 5000);
                    sourceBuffer.addEventListener('updateend', () => { clearTimeout(t); res(); }, { once: true });
                  });
                }
                sourceBuffer.appendBuffer(value);
                // Start playing as soon as first chunk lands
                if (!started) {
                  started = true;
                  audio.play().then(() => { onStart(); }).catch(() => {});
                }
              }
            } catch(e) { reject(e); }
          };
          pump();
        });

        audio.onended = () => { URL.revokeObjectURL(audio.src); resolve(); };
        audio.onerror = (e) => reject(new Error('Audio error: ' + e));
      });
    } else {
      // Fallback: full buffer (Safari / older browsers)
      const arrayBuf = await res.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      __audioContexts.push(audioCtx);
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(audioCtx.destination);
      onStart();
      return new Promise((resolve) => {
        source.onended = () => { audioCtx.close(); resolve(); };
        source.start(0);
      });
    }
  }

  try {
    await attempt();
  } catch (e) {
    console.warn('TTS failed, retrying...', e.message);
    await new Promise(r => setTimeout(r, 1000));
    try {
      await attempt();
    } catch (e2) {
      console.warn('TTS retry failed, using browser fallback', e2.message);
      onStart();
      await new Promise(resolve => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.onend = resolve;
        utt.onerror = resolve;
        window.speechSynthesis.speak(utt);
      });
    }
  }
}

async function speak(text, speaker, onAudioReady) {
  const mySession=session;
  try { __audioContexts.forEach(c=>{ try{if(c.state==='suspended')c.resume();}catch{} }); } catch {}
  // For Mary: start with idle video, switch to speaking only when audio actually starts
  if (speaker === 'Mary') {
    setMediaForSpeaker('User_Prompt'); // show idle while audio loads
  } else {
    setMediaForSpeaker(speaker);
  }
  if (speaker==='Ryan') {
    const orbEl=document.getElementById('ryan-orb'); if(orbEl) ryanOrbSetState('speaking');
  }
  if (mySession!==session) return;

  const switchToSpeaking=()=>{
    if(mySession!==session) return;
    if (onAudioReady) onAudioReady();
    if (speaker === 'Mary') {
      if (AVATARS._marySpeakingVideo) {
        const el=els.media;
        if(el&&el.tagName==='VIDEO'&&(el.getAttribute('src')||'')!==AVATARS._marySpeakingVideo){
          el.src=AVATARS._marySpeakingVideo; el.load(); try{el.play().catch(()=>{});}catch{}
        }
      } else { setMediaForSpeaker('Mary'); }
    } else {
      const el=els.media; if(el&&el.tagName==='VIDEO'){try{el.play().catch(()=>{});}catch{}}
    }
  };

  const switchToIdle=()=>{
    const doneEl=els.media;
    if(doneEl&&doneEl.id==='ryan-orb') ryanOrbSetState('silent');
    if (speaker === 'Mary' && doneEl && doneEl.tagName === 'VIDEO') {
      try { doneEl.pause(); } catch {}
      const idleSrc = AVATARS._maryIdleVideo || AVATARS.User_Prompt.src;
      if(idleSrc && (doneEl.getAttribute('src')||'')!==idleSrc){
        doneEl.src=idleSrc; doneEl.load(); try{doneEl.play().catch(()=>{});}catch{}
      }
    }
  };

  try {
    await Promise.race([
      (async()=>{
        if (speaker === 'Mary') {
          // Use ElevenLabs for Sofia — richer, more human voice
          await speakElevenLabs(text, switchToSpeaking);
          switchToIdle();
        } else {
          // Ryan and others stay on Kokoro
          const voice=getKokoroVoice(speaker);
          let started=false;
          const poll=setInterval(()=>{ if(mySession!==session){clearInterval(poll);return;} if(__audioContexts.some(c=>c.state==='running')){clearInterval(poll);if(!started){started=true;switchToSpeaking();}} },30);
          setTimeout(()=>{clearInterval(poll);if(!started){started=true;switchToSpeaking();}},3000);
          await KokoroSpeech.speak(text, voice);
          clearInterval(poll);
          switchToIdle();
        }
      })(),
      new Promise((_,rej)=>{
        const chk=setInterval(()=>{ if(mySession!==session){clearInterval(chk);rej(new Error('session_changed'));} },50);
        setTimeout(()=>clearInterval(chk),120000);
      })
    ]);
  } catch(e) { if(e.message!=='session_changed') console.warn('speak error:',e.message); }
  if (mySession!==session) return;
}


function getKokoroVoice(speaker) {
  if (speaker==='Mary') return 'af_nicole';
  if (speaker==='Ryan') return 'am_adam';
  return 'am_michael';
}

/* ===== Dynamic Mary ===== */
let conversationHistory=[];
let firstUserOpener=null;
function resetConversation() { conversationHistory=[]; }

async function streamCharacterAndSpeak(userSaid, mySession) {
  // Show thinking state immediately
  els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
  els.text.textContent = '...';

  // Switch to idle video while we wait for first audio
  setMediaForSpeaker('User_Prompt');

  let fullText = '';
  const sentenceQueue = [];
  let isPlayingAudio = false;
  let streamDone = false;
  let resolveStream;
  const streamPromise = new Promise(r => { resolveStream = r; });

  // Audio queue processor — plays sentences back-to-back
  async function processQueue() {
    if (isPlayingAudio) return;
    isPlayingAudio = true;

    while (true) {
      if (mySession !== session) break;

      if (sentenceQueue.length === 0) {
        if (streamDone) break;
        await pause(20);
        continue;
      }

      const sentence = sentenceQueue.shift();
      els.text.textContent = sentence;

      try {
        await speakElevenLabs(sentence, () => {
          if (mySession !== session) return;
          if (AVATARS._marySpeakingVideo) {
            const el = els.media;
            if (el && el.tagName === 'VIDEO' && (el.getAttribute('src') || '') !== AVATARS._marySpeakingVideo) {
              el.src = AVATARS._marySpeakingVideo;
              el.load();
              try { el.play().catch(() => {}); } catch {}
            }
          } else {
            setMediaForSpeaker('Mary');
          }
        });
      } catch (e) {
        if (e.message !== 'session_changed') console.warn('TTS error:', e.message);
      }

      if (mySession !== session) break;
    }

    // Switch back to idle after all audio done
    if (mySession === session) {
      const doneEl = els.media;
      if (doneEl && doneEl.tagName === 'VIDEO') {
        const idleSrc = AVATARS._maryIdleVideo || AVATARS.User_Prompt.src;
        if (idleSrc && (doneEl.getAttribute('src') || '') !== idleSrc) {
          doneEl.src = idleSrc;
          doneEl.load();
          try { doneEl.play().catch(() => {}); } catch {}
        }
      }
    }

    isPlayingAudio = false;
    resolveStream();
  }

  // SSE stream reader
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('/api/character-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userSaid,
        scenarioKey: currentScenarioKey,
        characterId: currentCharacterId,
        history: conversationHistory,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return await getCharacterResponseFallback(userSaid);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Start queue processor immediately
    processQueue();

    while (true) {
      if (mySession !== session) { reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) { console.warn('Stream error:', payload.error); break; }
          if (payload.sentence) sentenceQueue.push(payload.sentence);
          if (payload.done) { fullText = payload.full || fullText; streamDone = true; }
        } catch {}
      }
    }

    streamDone = true;

  } catch (err) {
    streamDone = true;
    if (err.name !== 'AbortError') console.warn('Stream fetch error:', err.message);
    if (!fullText && sentenceQueue.length === 0) {
      return await getCharacterResponseFallback(userSaid);
    }
  }

  await streamPromise;

  if (fullText && mySession === session) {
    if (!firstUserOpener) firstUserOpener = userSaid;
    conversationHistory.push({ role: 'user', content: userSaid });
    conversationHistory.push({ role: 'assistant', content: fullText });
    if (conversationHistory.length > 12) conversationHistory = conversationHistory.slice(-12);
  }

  return fullText || null;
}

async function getCharacterResponseFallback(userSaid) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('/api/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: userSaid,
        scenarioKey: currentScenarioKey,
        characterId: currentCharacterId,
        history: conversationHistory,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const maryText = data.response;
    if (!firstUserOpener) firstUserOpener = userSaid;
    conversationHistory.push({ role: 'user', content: userSaid });
    conversationHistory.push({ role: 'assistant', content: maryText });
    if (conversationHistory.length > 12) conversationHistory = conversationHistory.slice(-12);
    return maryText;
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

/* ===== Speech recognition ===== */
function createRecognition() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return null;
  const r=new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1;
  return r;
}

function showListening(on=true) {
  if (els.listenPill) els.listenPill.style.display=on?'block':'none';
  const orbEl=document.getElementById('ryan-orb');
  if (orbEl) ryanOrbSetState(on?'listening':'silent');
  // Swap avatar: listening video when mic is open, talking video when Mary speaks
  if (on) {
    // User is speaking — show idle/listening video
    const current=els.media;
    if (current && current.tagName==='VIDEO' && current.id!=='ryan-orb') {
      const idleSrc=AVATARS.User_Prompt?.src;
      if (idleSrc && (current.getAttribute('src')||'')!==idleSrc) {
        current.src=idleSrc; current.load();
        try{current.play().catch(()=>{});}catch{}
      }
    }
  }
}

/* ===== listenForUser — Chrome Web Speech API ===== */
// LATENCY FIX: Dynamic silence detection
//   SILENCE_SHORT = 900ms  — fires when last word ends with . ! ? or common sentence-enders
//   SILENCE_LONG  = 1800ms — fires otherwise (mid-thought, comma pause, etc.)
function listenForUser(mySession, maxTotalMs) {
  return new Promise(resolve=>{
    maxTotalMs=maxTotalMs||30000;
    let accumulated='', interim='', silenceTimer=null, hardTimer=null, currentRec=null;
    let resolved=false, lastSpeech=Date.now(), restarts=0;
    const MAX_RESTARTS=8;
    const SILENCE_SHORT=900;
    const SILENCE_LONG=1800;

    function isCompleteSentence(text) {
      if (!text) return false;
      const t = text.trim().toLowerCase();
      if (/[.!?]$/.test(t)) return true;
      if (/(thanks|please|okay|ok|sure|right|exactly|anyway|anyways|bye|hello|hi|hey|yes|no|maybe|later|now|today|here|there|that|this|you|me|us|them|it|him|her|too|though|well|fine|good|great|nice|cool|true|false|agree|agreed)$/.test(t)) return true;
      if (t.split(/\s+/).length >= 6) return true;
      return false;
    }

    function getSilenceMs() {
      const text = (accumulated + ' ' + interim).trim();
      return isCompleteSentence(text) ? SILENCE_SHORT : SILENCE_LONG;
    }

    function finish(val) {
      if (resolved) return;
      resolved=true;
      clearTimeout(silenceTimer); clearTimeout(hardTimer);
      if (listenTimer) { clearTimeout(listenTimer); listenTimer=null; }
      if (currentRec) { try{currentRec.onresult=null;currentRec.onerror=null;currentRec.onend=null;currentRec.stop();}catch{}; currentRec=null; }
      showListening(false);
      let final=accumulated.trim();
      if (interim.trim() && !final.toLowerCase().includes(interim.trim().toLowerCase())) final=(final+' '+interim).trim();
      resolve(final||null);
    }

    function scheduleSilence() {
      clearTimeout(silenceTimer);
      const ms = getSilenceMs();
      silenceTimer=setTimeout(()=>{ if(Date.now()-lastSpeech>=ms-100) finish('silence'); }, ms);
    }

    function startRec() {
      if (resolved||mySession!==session) return;
      if (restarts>=MAX_RESTARTS) restarts=0;
      restarts++;
      const r=createRecognition(); if(!r){finish('no_sr');return;}
      r.interimResults=true; r.continuous=true;
      currentRec=r; rec=r; interim='';

      r.onresult=e=>{
        if (resolved||mySession!==session){finish('session');return;}
        lastSpeech=Date.now();
        let finals='', lat='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const t=e.results[i][0].transcript;
          e.results[i].isFinal ? finals+=(finals?' ':'')+t.trim() : lat=t.trim();
        }
        if(finals) accumulated=(accumulated+' '+finals).trim();
        interim=lat;
        scheduleSilence();
      };

      r.onerror=e=>{
        if(e.error==='aborted') return;
        if(e.error==='no-speech'){
          restarts=Math.max(0,restarts-1);
          setTimeout(()=>{ if(!resolved&&mySession===session) startRec(); }, 500);
          return;
        }
        finish('err_'+e.error);
      };

      r.onend=()=>{
        if(resolved||mySession!==session) return;
        if(accumulated||interim) { finish(accumulated||interim); return; }
        setTimeout(()=>{ if(!resolved&&mySession===session) startRec(); }, 300);
      };

      try { r.start(); showListening(true); }
      catch { setTimeout(()=>{ if(!resolved) startRec(); }, 500); }
    }

    hardTimer=setTimeout(()=>finish('hard_timeout'), maxTotalMs);
    listenTimer=hardTimer;
    startRec();
  });
}


/* ===== Mary API + TTS warmup — fires silently when a scenario loads ===== */
// Primes Groq cold start AND OpenAI TTS cold start so first real response has no extra latency.
// Fire-and-forget: responses discarded entirely.
function warmupCharacterApi(key) {
  // Warm up character API (Groq)
  fetch('/api/character', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: 'hi',
      scenarioKey: key,
      characterId: currentCharacterId,
      history: [],
    }),
  }).catch(() => {});

  // Warm up character-stream endpoint (Groq via SSE)
  fetch('/api/character-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: 'hi',
      scenarioKey: key,
      characterId: currentCharacterId,
      history: [],
    }),
  }).then(r => r.body?.cancel()).catch(() => {});

  // Warm up OpenAI TTS — fires a silent 1-word request to prime the connection
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Hi', voice: 'nova', characterId: currentCharacterId }),
  }).then(r => r.body?.cancel()).catch(() => {});
}

/* ===== Scenario engine ===== */
async function playScenario(key, practice=false) {
  // ── Daily session gate (practice only — demos always free) ────────────────
  if (practice) {
    const allowed = await DailyLimit.canPlay();
    if (!allowed) return; // paywall shown by canPlay()
  }

  stopEverything();
  resetConversation();
  firstUserOpener=null;
  await pause(800); // increased from 200ms — kills 1s audio bleed on fast clicks

  // Fire warmup ping immediately — runs in background while Ryan speaks the intro
  warmupCharacterApi(key);

  const mySession=session;
  currentScenarioKey=key;
  // Auto-set default character and avatar for this scenario
  if (SCENARIO_CHARACTER_MAP[key]) {
    currentCharacterId = SCENARIO_CHARACTER_MAP[key];
    const defaultSet = AVATAR_SETS.find(s => s.id === currentCharacterId);
    if (defaultSet) applyAvatarSet(defaultSet);
  }
  Metrics.bumpView(key); Metrics.refreshUI(key);
  setSceneBackground(key);
  const sc=SCENARIOS[key]; if(!sc) return;
  // PostHog — scenario started
  if (window.posthog) posthog.capture('scenario_started', { scenario: key, mode: practice ? 'practice' : 'demo' });
  // Cold open scenarios skip demo entirely — throw user straight into practice
  if (sc.coldOpen) practice=true;
  isPractice=practice;
  currentScript=practice?sc.practice:sc.demo;
  stepIndex=0;
  if(els.select.value!==key) els.select.value=key;
  if (window.showFullscreenBtn) window.showFullscreenBtn();
  await playLoop(mySession);
}

async function playLoop(mySession) {
  while (stepIndex < currentScript.length) {
    if (mySession !== session) return;
    const line = currentScript[stepIndex];
    renderLine(line);

    if (line.speaker === 'User_Prompt') {
      const said = await listenForUser(mySession, 60000);
      if (mySession !== session) return;

      if (said && isPractice) {
        if (stepIndex + 1 < currentScript.length && currentScript[stepIndex + 1].speaker === 'Mary') stepIndex++;
        const reply = await streamCharacterAndSpeak(said, mySession);
        if (mySession !== session) return;
        if (!reply) {
          await speak(randomChoice(['Sorry, say that again?', 'Hmm, what was that?', 'Say that again?']), 'Mary');
        }
        setMediaForSpeaker('User_Prompt');
        let look = stepIndex + 1;
        while (look < currentScript.length && currentScript[look].speaker === 'Ryan') look++;
        if (look < currentScript.length && currentScript[look].speaker === 'User_Prompt') stepIndex = look - 1;
      } else if (!said) {
        await speak("No worries, let's keep going.", 'Ryan');
      }
      stepIndex++;
      continue;
    }

    await speak(line.text, line.speaker);
    if (mySession !== session) return;
    await pause(250);
    stepIndex++;
  }

  if (!isPractice) renderAskToPractice(mySession);
  else await freeConversation(mySession);
}

/* ===== Free Conversation ===== */
async function freeConversation(mySession) {
  let freeConvRescueUsed = null;
  let firstExchangeDone = false;
  let silenceCount = 0;
  if (mySession !== session) return;
  const sc = SCENARIOS[currentScenarioKey] || {};
  const FREE_MS = 7 * 60 * 1000, NUDGE_MS = 5 * 60 * 1000;
  const start = Date.now();
  let nudged = false;
  resetConversation();

  if (!sc.coldOpen) {
    await speak("Great work! Now let's have a real conversation -- no script, just talk to her naturally for ten minutes. I'll give you feedback at the end.", 'Ryan');
    if (mySession !== session) return;
    await pause(900);
  }

  const timerEl = document.createElement('div');
  timerEl.id = 'free-timer';
  timerEl.style.cssText = 'position:fixed;top:70px;right:20px;background:#1a1c22;border:1px solid #2b2e36;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;color:#ffb300;z-index:9999';
  document.body.appendChild(timerEl);
  const timerInterval = setInterval(() => {
    if (mySession !== session) { clearInterval(timerInterval); timerEl.remove(); return; }
    const rem = Math.max(0, FREE_MS - (Date.now() - start));
    timerEl.textContent = Math.floor(rem / 60000) + ':' + String(Math.floor((rem % 60000) / 1000)).padStart(2, '0') + ' left';
    if (rem <= 0) clearInterval(timerInterval);
  }, 1000);

  setMediaForSpeaker('Mary');
  els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
  els.text.textContent = '...';
  const warmupMs = currentScenarioKey === 'street' ? 2500 : 1200;
  await pause(warmupMs);

  while (mySession === session) {
    const elapsed = Date.now() - start;
    if (elapsed >= FREE_MS) {
      await speak("That's time. Let me put together your feedback.", 'Ryan');
      break;
    }

    if (!nudged && elapsed >= NUDGE_MS) {
      nudged = true;
      await speak("Two minutes left -- make it count.", 'Ryan');
      if (mySession !== session) break;
      await pause(900);
      setMediaForSpeaker('Mary');
      els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
    }

    const remMs = Math.min(30000, FREE_MS - (Date.now() - start));
    if (remMs < 2000) break;

    const said = await listenForUser(mySession, remMs);
    if (mySession !== session) break;

    if (!said) {
      if (sc.coldOpen && !firstExchangeDone) {
        const rescuesByScenario = {
          beach:        ["You walked all the way over here. Might as well say something.", "I don't bite. Usually.", "The waves aren't that interesting, I promise.", "Most people just walk past. You didn't.", "You can sit if you want. I don't mind.", "The quiet is better when someone breaks it well.", "I saw you walk by earlier.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          street:       ["You stopped for a reason.", "I have somewhere to be, just so you know.", "Clock's ticking.", "Most people just walk past.", "You look like you had something to say.", "Take your time. But not too much.", "Still working up to it?", "This is the part where you say something."],
          bar:          ["You came over for a reason.", "I don't bite. Usually.", "Most people just stand at the bar.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          gym:          ["You came over for a reason.", "I'm between sets, not retired.", "Clock's ticking.", "You look like you had something to say.", "Take your time."],
          museum:       ["You stopped here for a reason.", "Most people just walk past.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          bookstore:    ["You came down this aisle for a reason.", "Most people just browse.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          rooftop:      ["You came all the way over here.", "The view isn't going anywhere.", "Most people just stay on their side.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          house_party:  ["You came over for a reason.", "I don't bite. I'm at a party.", "Most people just stay in their group.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          coffee_shop:  ["You stopped at this table for a reason.", "I'm not that focused on the notebook.", "Most people just walk past.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          art_gallery:  ["You stopped at this piece for a reason.", "Most people walked past it.", "You look like you had something to say.", "Take your time.", "Still working up to it?", "The painting isn't going anywhere."],
          yoga_studio:  ["You came over for a reason.", "I'm stretching, not meditating.", "Clock's ticking — I'll finish and leave.", "You look like you had something to say.", "Take your time."],
          airport:      ["We've got time. Flight's delayed.", "Most people just stay in their seat.", "You look like you had something to say.", "Take your time.", "Still working up to it?", "The board hasn't changed."],
          supermarket:  ["You stopped in this aisle for a reason.", "Most people just keep moving.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          office_lobby: ["You came over for a reason.", "The elevator's taking its time.", "Most people just look at their phones.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
          train:        ["You're still here.", "The train has a few more stops.", "Most people just look out the window.", "You look like you had something to say.", "Take your time.", "Still working up to it?"],
        };
        const rescues = rescuesByScenario[currentScenarioKey] || rescuesByScenario.beach;
        if (!freeConvRescueUsed) freeConvRescueUsed = new Set();
        const available = rescues.filter(r => !freeConvRescueUsed.has(r));
        const pool = available.length > 0 ? available : rescues;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        freeConvRescueUsed.add(chosen);
        if (freeConvRescueUsed.size >= rescues.length) freeConvRescueUsed.clear();
        await speak(chosen, 'Mary');
        if (mySession !== session) break;
        await pause(1800);
      } else {
        silenceCount++;
        if (firstExchangeDone && silenceCount >= 2) {
          silenceCount = 0;
          const impatience = {
            street:       ["Still there?", "I do have somewhere to be.", "You went quiet.", "Was there something else?"],
            beach:        ["Still there?", "You went quiet.", "Was there something else?", "Take your time."],
            bar:          ["Still there?", "You went quiet.", "Was there something else?"],
            gym:          ["Still there?", "You went quiet.", "Was there something else?"],
            museum:       ["Still there?", "You went quiet.", "Was there something else?"],
            bookstore:    ["Still there?", "You went quiet.", "Was there something else?"],
            rooftop:      ["Still there?", "You went quiet.", "Was there something else?"],
            house_party:  ["Still there?", "You went quiet.", "Was there something else?"],
            coffee_shop:  ["Still there?", "You went quiet.", "Was there something else?"],
            art_gallery:  ["Still there?", "You went quiet.", "Was there something else?"],
            yoga_studio:  ["Still there?", "You went quiet.", "Was there something else?"],
            airport:      ["Still there?", "You went quiet.", "Was there something else?", "The board still hasn't changed."],
            supermarket:  ["Still there?", "You went quiet.", "Was there something else?"],
            office_lobby: ["Still there?", "You went quiet.", "Was there something else?"],
            train:        ["Still there?", "You went quiet.", "Was there something else?", "Few more stops."],
          };
          const pool = impatience[currentScenarioKey] || impatience.beach;
          const line = pool[Math.floor(Math.random() * pool.length)];
          await speak(line, 'Mary');
          if (mySession !== session) break;
          await pause(1000);
        } else {
          await pause(500);
        }
      }
      continue;
    }

    const reply = await streamCharacterAndSpeak(said, mySession);
    firstExchangeDone = true;
    silenceCount = 0;
    if (mySession !== session) break;
    if (!reply) {
      await speak(randomChoice(["Hmm?", "Say that again?", "What was that?"]), 'Mary');
    }
    if (mySession !== session) break;
    await pause(300);
    setMediaForSpeaker('Mary');
    els.name.textContent = currentCharacterId.charAt(0).toUpperCase() + currentCharacterId.slice(1);
  }

  clearInterval(timerInterval);
  const te = document.getElementById('free-timer');
  if (te) te.remove();
  if (mySession !== session) return;
  await runCoachFeedback(mySession);
}

/* ===== Coach Feedback ===== */
async function runCoachFeedback(mySession) {
  if(mySession!==session) return;
  els.name.textContent='Ryan'; els.text.textContent='Analyzing your session...';
  setMediaForSpeaker('Ryan');
  ryanOrbSetState('speaking');
  const sc=SCENARIOS[currentScenarioKey]||{};

  // Guard: if no conversation happened, skip coaching
  if (!conversationHistory.length) {
    await speak("Looks like we didn't get enough conversation to work with. Hit Try Again and give me something to coach.", 'Ryan');
    return;
  }

  // FIX 4: Fire API call and thinking line IN PARALLEL — no more dead silence
  // Both start at the same time. Thinking line plays while API is in flight.
  const coachPayload = JSON.stringify({
    conversation: conversationHistory,
    scenarioTitle: sc.title || 'Dating scenario',
    scenarioKey: currentScenarioKey || '',
    opener: firstUserOpener || ''
  });

  // Start API call immediately (don't await yet)
  const coachPromise = (async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const coachController = new AbortController();
      const coachTimeout = setTimeout(() => coachController.abort(), 45000);
      try {
        const res = await fetch('/api/coach', {
          signal: coachController.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: coachPayload,
        });
        clearTimeout(coachTimeout);
        if (!res.ok) throw new Error('Coach API returned ' + res.status);
        return await res.json();
      } catch(fetchErr) {
        clearTimeout(coachTimeout);
        if (attempt === 2) throw fetchErr;
        console.warn('Coach timeout on attempt 1, retrying...');
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  })();

  // Play thinking lines while API is in flight
  const thinkingLines = [
    "Alright. Let me put together your feedback.",
    "Okay. Give me a moment.",
    "Let me go through that.",
    "Alright. One moment.",
    "Give me a moment.",
  ];
  const thinkingLine = thinkingLines[Math.floor(Math.random() * thinkingLines.length)];
  els.text.textContent = thinkingLine;
  await speak(thinkingLine, 'Ryan');
  if(mySession!==session) return;

  // Now wait for API — if it's already done, this resolves instantly
  let f;
  try {
    f = await coachPromise;
  } catch(err) {
    console.error('Coach feedback error:', err.message);
    await speak("Something went wrong pulling your feedback — the session was good though. Hit Try Again and let's go again.", 'Ryan');
    return;
  }

  if(mySession!==session) return;

  // Speaking order: part1 → trans2 → part2 → trans3 → part3 → trans4 → part4 → tryNextTime → score reveal
  const coachParts = [f.part1, f.part2, f.part3, f.part4].filter(Boolean);
  const transitions = [f.transition2, f.transition3, f.transition4];

  if (coachParts.length) {
    for (let i = 0; i < coachParts.length; i++) {
      if (mySession !== session) return;
      await speak(coachParts[i], 'Ryan', () => { els.text.textContent = coachParts[i]; });
      if(mySession!==session) return;

      if (i < coachParts.length - 1) {
        // FIX 1: Pause between parts — feels like Ryan is thinking, not a machine
        await pause(1500);
        if(mySession!==session) return;
        const transition = transitions[i];
        if (transition) {
          await speak(transition, 'Ryan', () => { els.text.textContent = transition; });
          if(mySession!==session) return;
          await pause(800);
        }
      }
    }

    // Speak tryNextTime after part4
    if (f.tryNextTime && mySession === session) {
      await pause(1500);
      const tryLine = `Next time, try this exact line: "${f.tryNextTime}"`;
      await speak(tryLine, 'Ryan', () => { els.text.textContent = tryLine; });
    }

  } else {
    els.text.textContent = f.spokenFeedback || f.spokenSummary;
    await speak(f.spokenFeedback || f.spokenSummary, 'Ryan');
  }

  // Score reveal LAST — dramatic pause, then the number
  if (mySession === session) {
    await pause(1500);
    const scoreReveal = `I give that a... ${f.score} out of 10.`;
    await speak(scoreReveal, 'Ryan', () => { els.text.textContent = scoreReveal; });
  }

  if (mySession === session) {
    await pause(800);
    const encouragement =
      f.score <= 3 ? "That's where most guys start. The ones who improve are the ones who come back. Go again." :
      f.score <= 5 ? "You've got the instincts — they just need sharpening. One more round." :
      f.score <= 7 ? "Solid. You're building something real. Keep the reps going." :
                     "That's how it's done. Now do it again and make it automatic.";
    await speak(encouragement, 'Ryan', () => { els.text.textContent = encouragement; });
  }

  if(mySession!==session) return;
  showFeedbackCard(f);
}

/* ===== EkComments — per-scenario community comments ===== */
const EkComments = (() => {

  function renderList(comments, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!comments || comments.length === 0) {
      el.innerHTML = '<div style="color:#555;font-size:13px;text-align:center;padding:8px 0">No comments yet — be the first.</div>';
      return;
    }
    el.innerHTML = comments.slice().reverse().map(c => {
      const ts = new Date(c.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const scoreTag = c.score ? `<span style="background:#1a2a1a;color:#40c770;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:6px">${c.score}/10</span>` : '';
      return `
        <div style="background:#161820;border:1px solid #2b2e36;border-radius:10px;padding:12px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="font-size:13px;font-weight:700;color:#cfd6e4">${c.name || 'Anonymous'}</span>
            ${scoreTag}
            <span style="margin-left:auto;font-size:11px;color:#555">${ts}</span>
          </div>
          <div style="font-size:13px;color:#9aa4b2;line-height:1.6">${c.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>`;
    }).join('');
  }

  async function load(scenarioKey) {
    try {
      const res = await fetch('/api/comments?scenario=' + scenarioKey);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      renderList(data.comments || [], 'ek-comments-list');
    } catch {
      const el = document.getElementById('ek-comments-list');
      if (el) el.innerHTML = '<div style="color:#555;font-size:13px;text-align:center">Comments unavailable.</div>';
    }
  }

  async function submit(scenarioKey, score) {
    const nameEl = document.getElementById('ek-comment-name');
    const inputEl = document.getElementById('ek-comment-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) { inputEl.style.border = '1px solid #ff6b6b'; setTimeout(() => inputEl.style.border = '1px solid #2b2e36', 1500); return; }
    const name = nameEl ? nameEl.value.trim() : '';
    const listEl = document.getElementById('ek-comments-list');
    const tempEl = document.createElement('div');
    tempEl.style.cssText = 'background:#161820;border:1px solid #2b2e36;border-radius:10px;padding:12px;opacity:0.6';
    tempEl.innerHTML = `<div style="font-size:13px;color:#9aa4b2">${text.replace(/</g,'&lt;')}</div>`;
    if (listEl) listEl.prepend(tempEl);
    inputEl.value = '';
    if (nameEl) nameEl.value = '';
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioKey, text, name, score }),
      });
      await load(scenarioKey);
    } catch {
      if (tempEl) tempEl.style.opacity = '1';
    }
  }

  return { load, submit };
})();
window.EkComments = EkComments;

function showFeedbackCard(f) {
  if (window.hideFullscreenBtn) window.hideFullscreenBtn();
  // Fallback for missing card fields — GPT sometimes omits them on short conversations
  if (!f.openerBreakdown || f.openerBreakdown === '---') f.openerBreakdown = f.part1 ? f.part1.split('.')[0] + '.' : 'Opener not captured.';
  if (!f.bestMoment || f.bestMoment === '---') f.bestMoment = 'Keep building — more reps will show your best moments.';
  if (!f.missedOpportunity || f.missedOpportunity === '---') f.missedOpportunity = 'Focus on asking specific questions about her world.';

  if (!f.wouldSheDateHim || f.wouldSheDateHim === '---') f.wouldSheDateHim = 'Maybe — show more genuine curiosity next time.';
  // Record this session in progress history
  if (f.score >= 1 && f.score <= 10) Progress.recordSession(f.score, currentScenarioKey, currentCharacterId);
  // PostHog — session completed
  if (window.posthog) posthog.capture('session_completed', { scenario: currentScenarioKey, score: f.score });
  // PostHog — coach feedback viewed
  if (window.posthog) posthog.capture('coach_viewed', { scenario: currentScenarioKey, score: f.score });
  const scoreColor=f.score>=7?'#40c770':f.score>=5?'#ffb300':'#ff6b6b';
  const isBeach=currentScenarioKey==='beach';
  const bodyHTML=isBeach?`
    <div style="display:grid;gap:10px;margin-bottom:14px">
      <div style="background:#161820;border:1px solid #2b2e3a;border-radius:10px;padding:12px">
        <div style="color:#9aa4b2;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Your opener</div>
        <div style="color:#cfd6e4;font-size:13px;line-height:1.6">${f.openerBreakdown||'---'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:#162016;border:1px solid #1e3a1e;border-radius:10px;padding:12px">
          <div style="color:#40c770;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Best moment</div>
          <div style="color:#c8e6c9;font-size:13px;line-height:1.6">${f.bestMoment||'---'}</div>
        </div>
        <div style="background:#1e1616;border:1px solid #3a1e1e;border-radius:10px;padding:12px">
          <div style="color:#ff6b6b;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Missed opportunity</div>
          <div style="color:#ffcdd2;font-size:13px;line-height:1.6">${f.missedOpportunity||'---'}</div>
        </div>
      </div>
      <div style="background:#1a1730;border:1px solid #2e2a50;border-radius:10px;padding:12px">
        <div style="color:#a78bfa;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Try this next time</div>
        <div style="color:#e0d9ff;font-size:14px;font-style:italic">"${f.tryNextTime||f.tryThisLine||'---'}"</div>
      </div>
      <div style="background:#1a1620;border:1px solid #2e1e3a;border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">
        <div style="font-size:22px">${(f.wouldSheDateHim||'').startsWith('Yes')?'💜':(f.wouldSheDateHim||'').startsWith('No')?'✖':'🤔'}</div>
        <div>
          <div style="color:#d4a8ff;font-size:11px;font-weight:700;margin-bottom:3px;text-transform:uppercase">Would Sofia date you?</div>
          <div style="color:#e0d9ff;font-size:13px;line-height:1.5">${f.wouldSheDateHim||'---'}</div>
        </div>
      </div>
    </div>` : `
    <div style="display:grid;gap:10px;margin-bottom:14px">
      <div style="background:#161820;border:1px solid #2b2e3a;border-radius:10px;padding:12px">
        <div style="color:#9aa4b2;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Your opener</div>
        <div style="color:#cfd6e4;font-size:13px;line-height:1.6">${f.openerBreakdown||'---'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:#162016;border:1px solid #1e3a1e;border-radius:10px;padding:12px">
          <div style="color:#40c770;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Best moment</div>
          <div style="color:#c8e6c9;font-size:13px;line-height:1.6">${f.bestMoment||'---'}</div>
        </div>
        <div style="background:#1e1616;border:1px solid #3a1e1e;border-radius:10px;padding:12px">
          <div style="color:#ff6b6b;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Missed opportunity</div>
          <div style="color:#ffcdd2;font-size:13px;line-height:1.6">${f.missedOpportunity||'---'}</div>
        </div>
      </div>
      <div style="background:#1a1730;border:1px solid #2e2a50;border-radius:10px;padding:12px">
        <div style="color:#a78bfa;font-size:11px;font-weight:700;margin-bottom:5px;text-transform:uppercase">Try this next time</div>
        <div style="color:#e0d9ff;font-size:14px;font-style:italic">"${f.tryNextTime||f.tryThisLine||'---'}"</div>
      </div>
      <div style="background:#1a1620;border:1px solid #2e1e3a;border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px">
        <div style="font-size:22px">${(f.wouldSheDateHim||'').startsWith('Yes')?'💜':(f.wouldSheDateHim||'').startsWith('No')?'✖':'🤔'}</div>
        <div>
          <div style="color:#d4a8ff;font-size:11px;font-weight:700;margin-bottom:3px;text-transform:uppercase">Would she date you?</div>
          <div style="color:#e0d9ff;font-size:13px;line-height:1.5">${f.wouldSheDateHim||'---'}</div>
        </div>
      </div>
    </div>`;

  els.text.innerHTML=`
    <div style="background:#1a1c22;border:1px solid #2b2e36;border-radius:16px;padding:20px;margin:10px 0;text-align:left;max-width:860px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="font-size:42px;font-weight:900;color:${scoreColor}"><span id="ek-score-display">0</span><span style="font-size:20px;color:#666">/10</span></div>
        <div style="font-size:16px;color:#cfd6e4;line-height:1.5">${f.spokenSummary}</div>
      </div>
      ${bodyHTML}
      ${Progress.getHistoryHTML()}
      <div style="text-align:center;margin-top:14px">
        <button onclick="if(window.posthog) posthog.capture('try_again_clicked', {scenario:'${currentScenarioKey}'}); playScenario('${currentScenarioKey}',true)" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:800;cursor:pointer;margin-right:8px">
          Try Again
        </button>
        <button onclick="playScenario(Object.keys(SCENARIOS).find(k=>k!=='${currentScenarioKey}'),false)" style="background:#2a2e36;color:#fff;border:1px solid #3a3f4b;border-radius:999px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">
          Next Scenario
        </button>
      </div>
      <div id="ek-comments-section" style="margin-top:20px;border-top:1px solid #2b2e36;padding-top:16px">
        <div style="font-size:13px;font-weight:700;color:#9aa4b2;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">💬 Community — ${SCENARIOS[currentScenarioKey]?.title || 'This scenario'}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <input id="ek-comment-name" type="text" maxlength="30" placeholder="Your name (optional)" style="background:#161820;border:1px solid #2b2e36;border-radius:8px;padding:8px 12px;color:#e9ecf1;font-size:13px;outline:none" />
          <textarea id="ek-comment-input" maxlength="500" rows="3" placeholder="Share your experience — what worked, what didn't, what surprised you..." style="background:#161820;border:1px solid #2b2e36;border-radius:8px;padding:10px 12px;color:#e9ecf1;font-size:13px;resize:none;outline:none;font-family:inherit"></textarea>
          <button id="ek-post-btn" data-scenario="${currentScenarioKey}" data-score="${f.score}" onclick="window.EkComments.submit(this.dataset.scenario, parseInt(this.dataset.score)||0)" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:9px 24px;font-size:13px;font-weight:800;cursor:pointer;align-self:flex-end">Post comment</button>
        </div>
        <div id="ek-comments-list" style="display:flex;flex-direction:column;gap:10px"><div style="color:#666;font-size:13px;text-align:center">Loading comments…</div></div>
      </div>
    </div>`;
  // Animate score counter 0 → final over 1.5s
  const _scoreEl = document.getElementById('ek-score-display');
  if (_scoreEl) {
    const _target = f.score, _dur = 1500, _t0 = performance.now();
    (function _tick(now) {
      const p = Math.min((now - _t0) / _dur, 1);
      _scoreEl.textContent = Math.round(p * _target);
      if (p < 1) requestAnimationFrame(_tick);
    })(performance.now());
  }
  setTimeout(() => window.EkComments.load('${currentScenarioKey}'), 100);
}

/* ===== After demo ===== */
function renderAskToPractice(mySession) {
  if(mySession!==session) return;
  els.name.textContent='Ryan';
  els.text.textContent='Want to practice this one? Say yes or pick another scenario.';
  speak("Want to practice this one? Say yes, or pick another scenario.",'Ryan').then(()=>startListeningYesNo(mySession));
}

function startListeningYesNo(mySession) {
  if(mySession!==session) return;
  const r=createRecognition(); if(!r) return;
  rec=r; showListening(true);
  listenTimer=setTimeout(()=>{try{r.stop();}catch{}},6000);
  r.onresult=e=>{
    clearTimeout(listenTimer); showListening(false);
    if(e.results[0][0].transcript.toLowerCase().includes('yes')) playScenario(currentScenarioKey,true);
    else speak("Okay -- choose any scenario from the list.",'Ryan');
  };
  r.onerror=()=>showListening(false);
  r.onend=()=>showListening(false);
  try{r.start();}catch{}
}

/* ===== UI ===== */
function renderShelf() {
  const keys=Object.keys(SCENARIOS);
  els.select.innerHTML=keys.map(k=>`<option value="${k}">${SCENARIOS[k].title}</option>`).join('');
  els.select.onchange=()=>playScenario(els.select.value,false);
  els.shelf.innerHTML='';
  const limit=3;
  keys.slice(0,limit).forEach(k=>els.shelf.appendChild(makeCard(k)));
  if(keys.length>limit){
    els.showMore.style.display='block';
    els.showMore.textContent='+ '+(keys.length-limit)+' more -- show all';
    let exp=false;
    els.showMore.onclick=()=>{
      exp=!exp; els.shelf.innerHTML='';
      (exp?keys:keys.slice(0,limit)).forEach(k=>els.shelf.appendChild(makeCard(k)));
      els.showMore.textContent=exp?'Show fewer':'+ '+(keys.length-limit)+' more -- show all';
    };
  } else els.showMore.style.display='none';
}

function makeCard(key) {
  const sc=SCENARIOS[key];
  const card=document.createElement('div'); card.className='sc-card';
  const img=document.createElement('img'); img.className='sc-thumb'; img.src=sc.thumb||'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/ryan.jpg'; img.onerror=()=>img.style.display='none';
  const title=document.createElement('div'); title.innerHTML='<div class="sc-title">'+sc.title+'</div><div class="sc-sub">Click to load</div>';
  card.appendChild(img); card.appendChild(title);
  card.onclick=()=>playScenario(key,false);
  return card;
}

function renderAvatarPicker() {
  if(!els.pickerBackdrop) return;
  els.pickerGrid.innerHTML=AVATAR_SETS.map(s=>`
    <div class="pick-card" data-id="${s.id}">
      <img class="pick-img" src="${s.thumb||'https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/ryan.jpg'}" alt="${s.label}" style="height:160px;object-fit:cover;">
      <div class="pick-meta">
        <b style="font-size:15px">${s.label}</b>
        <div style="color:#9aa4b2;font-size:12px;margin-top:3px">${s.vibe||''}</div>
        <div style="color:#ffb300;font-size:11px;font-weight:700;margin-top:4px;text-transform:uppercase;letter-spacing:.05em">${s.scenario||''}</div>
      </div>
    </div>`).join('');
  els.pickerGrid.querySelectorAll('.pick-card').forEach(card=>{
    card.onclick=()=>{
      const set=AVATAR_SETS.find(x=>x.id===card.getAttribute('data-id'));
      applyAvatarSet(set);
      els.pickerBackdrop.style.display='none';
      renderShelf(); Metrics.refreshUI(currentScenarioKey||Object.keys(SCENARIOS)[0]);
      // Do NOT auto-launch scenario — user picks it manually from the shelf
    };
  });
  els.pickerBackdrop.style.display='flex';
  // Close picker when clicking outside the grid
  els.pickerBackdrop.onclick=(e)=>{
    if(e.target===els.pickerBackdrop) els.pickerBackdrop.style.display='none';
  };
}

els.enterPractice.onclick=()=>playScenario(currentScenarioKey||Object.keys(SCENARIOS)[0],true);
els.micBtn.onclick=()=>{};
els.chooseBtn.onclick=renderAvatarPicker;

/* ===== Helpers ===== */
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const randomChoice=arr=>arr[Math.floor(Math.random()*arr.length)];
function similarity(actual,promptText){
  const exp=promptText.replace('Say: ','').replace(/'/g,'').toLowerCase();
  const words=exp.split(/\s+/).filter(w=>w.length>2);
  const said=(actual||'').toLowerCase();
  return words.filter(w=>said.includes(w)).length/Math.max(1,words.length);
}

/* ===== Onboarding ===== */
const ONBOARDING_KEY = 'ek-onboarding-v1';
function hasSeenOnboarding() { try { return !!localStorage.getItem(ONBOARDING_KEY); } catch { return false; } }
function markOnboardingDone() { try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {} }

function showOnboarding(onComplete) {
  const ov = document.createElement('div');
  ov.id = 'ek-onboarding';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(13,14,18,0.98);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box';

  const S1 = '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;max-width:340px;text-align:center">'
    + '<div style="font-size:52px">&#127917;</div>'
    + '<div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.2">Eklipses</div>'
    + '<div style="font-size:17px;color:#e0e0e0;line-height:1.9;margin-top:4px">'
    + '&ldquo;You already know what to say.<br>You just need to stop being afraid to say it.<br>'
    + '<span style="color:#ffb300;font-weight:700">This is where that changes.</span>&rdquo;</div>'
    + '<button id="ob-btn" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:14px 44px;font-size:16px;font-weight:800;cursor:pointer;margin-top:12px;width:100%;max-width:260px">How does it work? &rarr;</button>'
    + '</div>';

  const S2 = '<div style="display:flex;flex-direction:column;align-items:center;gap:18px;max-width:340px;text-align:center">'
    + '<div style="font-size:22px;font-weight:800;color:#fff">Here&#39;s how it works</div>'
    + '<div style="display:flex;flex-direction:column;gap:14px;width:100%;text-align:left">'
    + '<div style="display:flex;align-items:flex-start;gap:14px"><div style="background:#ffb300;color:#000;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0">1</div><div style="color:#cfd6e4;font-size:15px;line-height:1.5"><strong style="color:#fff">Pick a scenario</strong><br>Beach, bar, gym &mdash; real situations where it counts.</div></div>'
    + '<div style="display:flex;align-items:flex-start;gap:14px"><div style="background:#ffb300;color:#000;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0">2</div><div style="color:#cfd6e4;font-size:15px;line-height:1.5"><strong style="color:#fff">Talk out loud</strong><br>A real AI woman responds to exactly what you say. No scripts.</div></div>'
    + '<div style="display:flex;align-items:flex-start;gap:14px"><div style="background:#ffb300;color:#000;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0">3</div><div style="color:#cfd6e4;font-size:15px;line-height:1.5"><strong style="color:#fff">Get coached</strong><br>Ryan breaks down exactly what worked and what cost you.</div></div>'
    + '</div>'
    + '<button id="ob-btn" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:14px 44px;font-size:16px;font-weight:800;cursor:pointer;margin-top:8px;width:100%;max-width:260px">I&#39;m ready &rarr;</button>'
    + '</div>';

  const S3 = '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;max-width:340px;text-align:center">'
    + '<div style="font-size:44px">&#127908;</div>'
    + '<div style="font-size:22px;font-weight:800;color:#fff">Your first session</div>'
    + '<div style="font-size:15px;color:#9aa4b2;line-height:1.7">Starting with <strong style="color:#ffb300">Beach &mdash; Cold Open</strong>.<br>No warm-up. No script. Just you and Sofia.<br>Talk out loud. Ryan coaches you after.</div>'
    + '<div style="background:#1a1c22;border:1px solid #2b2e36;border-radius:12px;padding:14px 20px;font-size:13px;color:#9aa4b2;line-height:1.6">&#128161; <strong style="color:#cfd6e4">Tip:</strong> Use Chrome or Edge. Allow mic access when asked.</div>'
    + '<button id="ob-btn" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:14px 44px;font-size:16px;font-weight:800;cursor:pointer;width:100%;max-width:260px">Start my first session</button>'
    + '</div>';

  const screens = [S1, S2, S3];

    let screen = 0;

  function renderScreen(i) {
    const dots = screens.map((_,idx) =>
      '<div style="width:8px;height:8px;border-radius:50%;background:' + (idx===i?'#ffb300':'#2b2e36') + '"></div>'
    ).join('');
    ov.innerHTML = '<div style="position:absolute;top:20px;right:20px;display:flex;gap:6px">' + dots + '</div>' + screens[i];
    document.getElementById('ob-btn').onclick = () => {
      if (i < screens.length - 1) {
        renderScreen(i + 1);
      } else {
        markOnboardingDone();
        ov.remove();
        onComplete();
      }
    };
  }

  document.body.appendChild(ov);
  renderScreen(0);
}

/* ===== Fullscreen ===== */
function initFullscreen() {
  // Create fullscreen button that sits over the video frame
  const btn = document.createElement('button');
  btn.id = 'ek-fullscreen-btn';
  btn.title = 'Toggle fullscreen';
  btn.innerHTML = '⛶';
  btn.style.cssText = [
    'position:absolute',
    'bottom:12px',
    'right:12px',
    'z-index:999',
    'background:rgba(0,0,0,0.55)',
    'color:#fff',
    'border:none',
    'border-radius:8px',
    'width:36px',
    'height:36px',
    'font-size:18px',
    'cursor:pointer',
    'display:none', // hidden until session starts
    'align-items:center',
    'justify-content:center',
    'transition:background 0.2s',
  ].join(';');

  btn.onmouseenter = () => btn.style.background = 'rgba(255,179,0,0.85)';
  btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.55)';

  btn.onclick = () => {
    const frame = document.getElementById('stageFrame');
    if (!frame) return;
    if (!document.fullscreenElement) {
      frame.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  document.addEventListener('fullscreenchange', () => {
    btn.innerHTML = document.fullscreenElement ? '✕' : '⛶';
  });

  // Add button inside stageFrame so it sits over the video
  const frame = document.getElementById('stageFrame');
  if (frame) {
    frame.style.position = 'relative';
    frame.appendChild(btn);
  }

  // Show button when session is active, hide on home screen
  window.showFullscreenBtn = () => { btn.style.display = 'flex'; };
  window.hideFullscreenBtn = () => { btn.style.display = 'none'; btn.innerHTML = '⛶'; };
}

/* ===== Boot ===== */
function bootDefault() {
  const set=AVATAR_SETS.find(s=>s.id==='sofia');
  applyAvatarSet(set);
  Metrics.bindLikeButton();
  initFullscreen();
  if (!hasSeenOnboarding()) {
    showOnboarding(() => launchApp());
  } else {
    launchApp();
  }
}

function launchApp() {
  const overlay=document.createElement('div');
  overlay.id='ek-start-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden';

  // Cinematic slideshow background
  const slides=['https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/slide5.jpg','https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/slide6.jpg','https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/slide3.jpg','https://pub-8dcb197cb8474bcfb3ef344b733745ca.r2.dev/slide7.jpg'];
  const bgWrap=document.createElement('div');
  bgWrap.style.cssText='position:absolute;inset:0;z-index:0';
  const bg1=document.createElement('div'), bg2=document.createElement('div');
  [bg1,bg2].forEach(b=>{ b.style.cssText='position:absolute;inset:0;background-size:cover;background-position:center;transition:opacity 1.5s ease'; });
  bg1.style.backgroundImage=`url(${slides[0]})`; bg1.style.opacity='1'; bg2.style.opacity='0';
  bgWrap.appendChild(bg1); bgWrap.appendChild(bg2);
  const darkOv=document.createElement('div');
  darkOv.style.cssText='position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.5) 0%,rgba(0,0,0,0.78) 100%);z-index:1';
  bgWrap.appendChild(darkOv);
  overlay.appendChild(bgWrap);
  let slide=0,tog=false;
  const ssTimer=setInterval(()=>{ slide=(slide+1)%slides.length; tog=!tog; const a=tog?bg2:bg1,i=tog?bg1:bg2; a.style.backgroundImage=`url(${slides[slide]})`; a.style.opacity='1'; i.style.opacity='0'; },4000);

  const inner=document.createElement('div');
  inner.style.cssText='position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:18px;padding:32px 24px;text-align:center;max-width:480px';
  inner.innerHTML=`
    <div style="font-size:12px;font-weight:700;letter-spacing:4px;color:#ffb300;text-transform:uppercase;opacity:0.9">AI Conversation Training</div>
    <div style="font-size:54px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1;text-shadow:0 4px 24px rgba(0,0,0,0.5)">Eklipses</div>
    <div style="font-size:16px;color:rgba(255,255,255,0.8);line-height:1.7;font-style:italic;max-width:340px">"You already know what to say.<br>You just need to stop being afraid to say it."</div>
    <button id="ek-start-btn" style="background:#ffb300;color:#000;border:none;border-radius:999px;padding:16px 56px;font-size:18px;font-weight:900;cursor:pointer;margin-top:8px;box-shadow:0 8px 32px rgba(255,179,0,0.4);letter-spacing:0.3px;transition:transform .1s ease,box-shadow .1s ease" onmouseover="this.style.transform='scale(1.05)';this.style.boxShadow='0 12px 40px rgba(255,179,0,0.6)'" onmouseout="this.style.transform='';this.style.boxShadow='0 8px 32px rgba(255,179,0,0.4)'">Let's go →</button>
    <div id="ek-prog-wrap" style="display:none;width:280px;text-align:center">
      <div style="background:rgba(255,255,255,0.15);border-radius:6px;height:6px;overflow:hidden;margin-bottom:8px">
        <div id="ek-prog-fill" style="background:#ffb300;height:100%;width:0%;border-radius:6px;transition:width 0.25s ease"></div>
      </div>
      <div id="ek-prog-label" style="font-size:12px;color:rgba(255,255,255,0.6)">Loading AI model...</div>
    </div>`;
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  let _bootStarted = false;
  document.getElementById('ek-start-btn').onclick=async()=>{
    if (_bootStarted) return;
    _bootStarted = true;
    document.getElementById('ek-start-btn').style.display='none';
    document.getElementById('ek-prog-wrap').style.display='block';
    try {
      await KokoroSpeech.preload(info=>{
        const fill=document.getElementById('ek-prog-fill'), label=document.getElementById('ek-prog-label');
        if(fill&&info.progress!=null) fill.style.width=Math.round(info.progress)+'%';
        if(label&&info.file) label.textContent='Loading '+info.file.split('/').pop()+'...';
      });
    } catch(err) {
      const lbl=document.getElementById('ek-prog-label');
      if(lbl) lbl.innerHTML='<span style="color:#ff6b6b">Failed: '+err.message+'</span>';
      return;
    }
    clearInterval(ssTimer);
    overlay.remove();
    const firstKey=Object.keys(SCENARIOS)[0];
    currentScenarioKey=firstKey;
    setMediaForSpeaker('Ryan');
    els.name.textContent='Ryan';
    els.text.textContent='Choose a scenario to begin.';
    Metrics.refreshUI(firstKey);
    if (!document.getElementById('ek-stat-bar')) {
      const bar = document.createElement('div');
      bar.id = 'ek-stat-bar';
      bar.style.cssText = 'display:none;justify-content:center;align-items:center;gap:12px;font-size:12px;color:#9aa4b2;padding:6px 0;flex-wrap:wrap';
      const nameEl = document.getElementById('speakerName');
      if (nameEl && nameEl.parentNode) nameEl.parentNode.insertBefore(bar, nameEl.nextSibling);
    }
    Progress.refreshStatBar();
    Progress.refreshStreakBadge();
    // Render shelf immediately — playScenario calls stopEverything() which increments session
    renderShelf();
    const launchSession = session;
    await speak("You already know what to say. You just need to stop being afraid to say it.", 'Ryan');
    if (session !== launchSession) return; // user clicked a scenario — stop here
    await pause(400);
    if (session !== launchSession) return;
    await speak("Pick a scenario. Let's find out where you're at.", 'Ryan');
    if (session !== launchSession) return;
    ryanOrbSetState('silent');
    // Inject stat bar below Ryan name
    const existingBar = document.getElementById('ek-stat-bar');
    if (!existingBar) {
      const bar = document.createElement('div');
      bar.id = 'ek-stat-bar';
      bar.style.cssText = 'display:none;justify-content:center;align-items:center;gap:12px;font-size:12px;color:#9aa4b2;padding:6px 0;flex-wrap:wrap';
      const nameEl = document.getElementById('speakerName');
      if (nameEl && nameEl.parentNode) nameEl.parentNode.insertBefore(bar, nameEl.nextSibling);
    }
    Progress.refreshStatBar();
    Progress.refreshStreakBadge();
  };
}

bootDefault();