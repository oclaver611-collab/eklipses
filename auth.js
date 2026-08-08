// auth.js — Eklipses Auth + Progress Sync
// Exposes window.EkAuth  (sign-in / sign-up / sign-out / getUser)
// Exposes window.EkProgress (hooks called by lesson-player.js on completion)
//
// Architecture: local-first.
//   localStorage is always the synchronous read source.
//   On sign-in, DB → localStorage (merge). On lesson complete, localStorage → DB.
//   Logged-out users work exactly as before; signing in adds device-portability.

(function () {
  'use strict';

  // ── Keys that sync to DB ─────────────────────────────────────────────────
  const PROGRESS_KEYS = {
    lesson1_complete: 'eklipses_lesson1_complete',
    lesson2_complete: 'eklipses_lesson2_complete',
    lesson3_complete: 'eklipses_lesson3_complete',
    lesson1_progress: 'eklipses_lesson1_progress',
    lesson2_progress: 'eklipses_lesson2_progress',
    lesson3_progress: 'eklipses_lesson3_progress',
    lesson1_cert:     'eklipses_lesson1_certification',
  };

  // ── State ────────────────────────────────────────────────────────────────
  let sb = null;           // Supabase browser client
  let currentUser = null;  // supabase User object

  // ── Helpers: DB ↔ localStorage ──────────────────────────────────────────

  function readLocalProgress(userId) {
    const certRaw = localStorage.getItem(PROGRESS_KEYS.lesson1_cert);
    let cert = null;
    try { cert = certRaw ? JSON.parse(certRaw) : null; } catch {}
    return {
      user_id:          userId,
      lesson1_complete: localStorage.getItem(PROGRESS_KEYS.lesson1_complete) === 'true',
      lesson2_complete: localStorage.getItem(PROGRESS_KEYS.lesson2_complete) === 'true',
      lesson3_complete: localStorage.getItem(PROGRESS_KEYS.lesson3_complete) === 'true',
      lesson1_progress: localStorage.getItem(PROGRESS_KEYS.lesson1_progress) || null,
      lesson2_progress: localStorage.getItem(PROGRESS_KEYS.lesson2_progress) || null,
      lesson3_progress: localStorage.getItem(PROGRESS_KEYS.lesson3_progress) || null,
      lesson1_cert:     cert,
    };
  }

  function applyRowToLocalStorage(row) {
    if (!row) return;
    // Lesson completions: DB true always wins (can't un-complete a lesson).
    if (row.lesson1_complete) localStorage.setItem(PROGRESS_KEYS.lesson1_complete, 'true');
    if (row.lesson2_complete) localStorage.setItem(PROGRESS_KEYS.lesson2_complete, 'true');
    if (row.lesson3_complete) localStorage.setItem(PROGRESS_KEYS.lesson3_complete, 'true');
    // Progress (resume point): DB wins only if localStorage is empty.
    if (row.lesson1_progress && !localStorage.getItem(PROGRESS_KEYS.lesson1_progress))
      localStorage.setItem(PROGRESS_KEYS.lesson1_progress, row.lesson1_progress);
    if (row.lesson2_progress && !localStorage.getItem(PROGRESS_KEYS.lesson2_progress))
      localStorage.setItem(PROGRESS_KEYS.lesson2_progress, row.lesson2_progress);
    if (row.lesson3_progress && !localStorage.getItem(PROGRESS_KEYS.lesson3_progress))
      localStorage.setItem(PROGRESS_KEYS.lesson3_progress, row.lesson3_progress);
    // Cert: DB wins if localStorage has nothing.
    if (row.lesson1_cert && !localStorage.getItem(PROGRESS_KEYS.lesson1_cert))
      localStorage.setItem(PROGRESS_KEYS.lesson1_cert, JSON.stringify(row.lesson1_cert));
  }

  async function fetchAndMergeProgress(userId) {
    if (!sb) return;
    try {
      const { data } = await sb.from('user_progress').select('*').eq('user_id', userId).maybeSingle();
      if (data) {
        applyRowToLocalStorage(data);
        // Re-render lesson cards so lock/unlock state reflects merged progress.
        if (window.LessonPlayer && typeof window.LessonPlayer.refreshLearnTabStatus === 'function') {
          window.LessonPlayer.refreshLearnTabStatus();
        }
      }
    } catch (e) {
      console.warn('[EkAuth] fetchAndMergeProgress failed:', e.message);
    }
  }

  async function pushProgressToDb(userId) {
    if (!sb || !userId) return;
    try {
      const row = readLocalProgress(userId);
      await sb.from('user_progress').upsert(row, { onConflict: 'user_id' });
    } catch (e) {
      console.warn('[EkAuth] pushProgressToDb failed:', e.message);
    }
  }

  // ── Auth UI ──────────────────────────────────────────────────────────────

  function renderAuthState(user) {
    const btn       = document.getElementById('ek-auth-btn');
    const indicator = document.getElementById('ek-auth-indicator');
    const emailEl   = document.getElementById('ek-auth-email');
    if (!btn || !indicator) return;
    if (user) {
      btn.style.display       = 'none';
      indicator.style.display = 'flex';
      if (emailEl) emailEl.textContent = user.email;
      // Hide "Already have an account?" prompts on splash / onboarding overlays.
      // These overlays are created synchronously by player.js before auth resolves,
      // so renderAuthState is the only place that can update them once auth is known.
      document.getElementById('ek-splash-signin')?.parentElement?.remove();
      document.getElementById('ob-signin')?.parentElement?.remove();
    } else {
      btn.style.display       = 'inline-flex';
      indicator.style.display = 'none';
    }
    // Show cancel subscription link only for known Stripe subscribers
    const cancelWrap = document.getElementById('ek-cancel-wrap');
    if (cancelWrap && localStorage.getItem('ek-stripe-cus')) cancelWrap.style.display = 'inline';
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  function showAuthModal(defaultTab) {
    let modal = document.getElementById('ek-auth-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    switchTab(defaultTab || 'signin');
    setTimeout(() => modal.querySelector('#ek-auth-email-input')?.focus(), 50);
  }

  function hideAuthModal() {
    const modal = document.getElementById('ek-auth-modal');
    if (modal) modal.style.display = 'none';
    clearModalError();
  }

  function setModalError(msg) {
    const el = document.getElementById('ek-auth-error');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  function clearModalError() { setModalError(''); }

  function setModalLoading(loading) {
    const btn = document.getElementById('ek-auth-submit');
    if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Please wait…' : btn.dataset.label; }
  }

  function switchTab(tab) {
    const isSignin = tab === 'signin';
    const signinTab = document.getElementById('ek-tab-signin');
    const signupTab = document.getElementById('ek-tab-signup');
    const submitBtn = document.getElementById('ek-auth-submit');
    const switchMsg = document.getElementById('ek-auth-switch');
    if (signinTab) signinTab.classList.toggle('active', isSignin);
    if (signupTab) signupTab.classList.toggle('active', !isSignin);
    if (submitBtn) {
      submitBtn.dataset.tab   = tab;
      submitBtn.dataset.label = isSignin ? 'Sign in' : 'Create account';
      submitBtn.textContent   = submitBtn.dataset.label;
    }
    if (switchMsg) {
      switchMsg.innerHTML = isSignin
        ? 'No account? <a href="#" id="ek-switch-link">Create one</a>'
        : 'Already have an account? <a href="#" id="ek-switch-link">Sign in</a>';
      document.getElementById('ek-switch-link')?.addEventListener('click', e => {
        e.preventDefault(); clearModalError(); switchTab(isSignin ? 'signup' : 'signin');
      });
    }
    clearModalError();
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'ek-auth-modal';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99997;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    overlay.addEventListener('click', e => { if (e.target === overlay) hideAuthModal(); });

    const hasGoogle = !!sb; // only show Google button if Supabase is configured

    overlay.innerHTML = `
      <div style="background:#1a1d26;border:1px solid #2b2e3b;border-radius:14px;padding:28px 24px;max-width:360px;width:90%;position:relative">
        <button id="ek-auth-close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#666;font-size:20px;cursor:pointer;line-height:1">×</button>
        <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#e9ecf1">Your Eklipses account</h2>

        <div style="display:flex;gap:6px;margin-bottom:20px">
          <button id="ek-tab-signin" class="active" style="flex:1;padding:8px;border-radius:8px;border:1px solid #2b2e3b;background:#2a2e38;color:#e9ecf1;font-size:14px;font-weight:600;cursor:pointer">Sign in</button>
          <button id="ek-tab-signup" style="flex:1;padding:8px;border-radius:8px;border:1px solid #2b2e3b;background:transparent;color:#9aa4b2;font-size:14px;font-weight:600;cursor:pointer">Create account</button>
        </div>

        ${hasGoogle ? `
        <button id="ek-auth-google" style="width:100%;padding:10px;border:1px solid #2b2e3b;border-radius:8px;background:#1e2028;color:#e9ecf1;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div style="flex:1;height:1px;background:#2b2e3b"></div>
          <span style="font-size:12px;color:#555e6e">or</span>
          <div style="flex:1;height:1px;background:#2b2e3b"></div>
        </div>
        ` : ''}

        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12px;color:#9aa4b2;margin-bottom:4px">Email</label>
          <input id="ek-auth-email-input" type="email" autocomplete="email" placeholder="you@example.com"
            style="width:100%;box-sizing:border-box;padding:10px;background:#12141a;border:1px solid #2b2e3b;border-radius:8px;color:#e9ecf1;font-size:14px;outline:none"/>
        </div>
        <div style="margin-bottom:20px">
          <label style="display:block;font-size:12px;color:#9aa4b2;margin-bottom:4px">Password</label>
          <input id="ek-auth-password-input" type="password" autocomplete="current-password" placeholder="••••••••"
            style="width:100%;box-sizing:border-box;padding:10px;background:#12141a;border:1px solid #2b2e3b;border-radius:8px;color:#e9ecf1;font-size:14px;outline:none"/>
        </div>

        <div id="ek-auth-error" style="display:none;padding:10px;background:rgba(224,82,82,.12);border:1px solid rgba(224,82,82,.3);border-radius:8px;color:#e05252;font-size:13px;margin-bottom:14px"></div>

        <button id="ek-auth-submit" data-tab="signin" data-label="Sign in"
          style="width:100%;padding:11px;background:#ffb300;color:#000;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">
          Sign in
        </button>

        <p id="ek-auth-switch" style="text-align:center;font-size:13px;color:#666;margin:14px 0 0">
          No account? <a href="#" id="ek-switch-link" style="color:#9ec1ff">Create one</a>
        </p>
      </div>`;

    // Tab clicks
    overlay.querySelector('#ek-tab-signin').addEventListener('click', () => switchTab('signin'));
    overlay.querySelector('#ek-tab-signup').addEventListener('click', () => switchTab('signup'));
    overlay.querySelector('#ek-auth-close').addEventListener('click', hideAuthModal);

    // Google button
    if (hasGoogle) {
      overlay.querySelector('#ek-auth-google')?.addEventListener('click', async () => {
        clearModalError();
        setModalLoading(true);
        try {
          const { error } = await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          });
          if (error) { setModalError(error.message); setModalLoading(false); }
        } catch (e) { setModalError(e.message); setModalLoading(false); }
      });
    }

    // Submit button
    overlay.querySelector('#ek-auth-submit').addEventListener('click', async () => {
      const tab      = document.getElementById('ek-auth-submit').dataset.tab;
      const email    = document.getElementById('ek-auth-email-input').value.trim();
      const password = document.getElementById('ek-auth-password-input').value;
      clearModalError();
      if (!email || !password) return setModalError('Email and password are required.');
      setModalLoading(true);
      try {
        const fn = tab === 'signup'
          ? sb.auth.signUp({ email, password })
          : sb.auth.signInWithPassword({ email, password });
        const { error } = await fn;
        if (error) { setModalError(error.message); setModalLoading(false); return; }
        if (tab === 'signup') {
          setModalError(''); // show a success note
          const errEl = document.getElementById('ek-auth-error');
          if (errEl) {
            errEl.style.cssText = errEl.style.cssText.replace('rgba(224,82,82', 'rgba(64,199,112').replace('#e05252', '#40c770');
            errEl.textContent = 'Check your email to confirm your account.';
            errEl.style.display = 'block';
          }
        }
        setModalLoading(false);
      } catch (e) { setModalError(e.message); setModalLoading(false); }
    });

    // Enter key submits
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('#ek-auth-submit').click();
    });

    // Initial switch-link wiring
    overlay.querySelector('#ek-switch-link')?.addEventListener('click', e => {
      e.preventDefault(); clearModalError(); switchTab('signup');
    });

    return overlay;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    // 1. Fetch Supabase public config.
    try {
      const res = await fetch('/api/auth-config');
      if (res.ok) {
        const { url, anonKey } = await res.json();
        if (url && anonKey && window.supabase) {
          sb = window.supabase.createClient(url, anonKey);
        }
      }
    } catch {}

    // 2. If Supabase unavailable, fall back silently — app works fully without it.
    if (!sb) {
      renderAuthState(null);
      wireStaticButtons();
      return;
    }

    // 3. Register listener BEFORE getSession() — if onAuthStateChange comes after,
    //    the SIGNED_IN event fired when processing an OAuth redirect token is already
    //    gone and the callback page load shows as logged-out.
    sb.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;
      renderAuthState(currentUser);
      if (event === 'SIGNED_IN' && currentUser) {
        // Fresh sign-in (email/password or OAuth redirect): push local progress
        // first so nothing is lost, then pull DB on top.
        await pushProgressToDb(currentUser.id);
        await fetchAndMergeProgress(currentUser.id);
        hideAuthModal();
      } else if (event === 'INITIAL_SESSION' && currentUser) {
        // Returning signed-in user on page load: only pull from DB (don't overwrite
        // DB with potentially stale local state).
        await fetchAndMergeProgress(currentUser.id);
      }
    });

    // 4. Resolve current session — also processes OAuth redirect tokens/codes and
    //    fires SIGNED_IN (or INITIAL_SESSION) to the listener above.
    try {
      await sb.auth.getSession();
    } catch {}

    // 5. Render auth state (currentUser already set by listener above).
    renderAuthState(currentUser);
    wireStaticButtons();
  }

  function wireStaticButtons() {
    document.getElementById('ek-auth-btn')
      ?.addEventListener('click', () => showAuthModal('signin'));
    document.getElementById('ek-auth-logout')
      ?.addEventListener('click', async () => {
        if (sb) await sb.auth.signOut();
        else renderAuthState(null);
      });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.EkAuth = {
    signUp:         (email, pw) => sb?.auth.signUp({ email, password: pw }),
    signIn:         (email, pw) => sb?.auth.signInWithPassword({ email, password: pw }),
    signInWithGoogle: ()        => sb?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }),
    signOut:        ()          => sb?.auth.signOut(),
    getUser:        ()          => currentUser,
    getToken:       async ()    => { const { data } = await (sb?.auth.getSession() ?? Promise.resolve({ data: {} })); return data?.session?.access_token || null; },
    showModal:      (tab)       => showAuthModal(tab),
  };

  window.EkProgress = {
    // Called by lesson-player.js after writing lesson completion to localStorage.
    onLessonComplete: () => { if (currentUser) pushProgressToDb(currentUser.id); },
    // Called by lesson-player.js after saving cert to localStorage.
    onCertSaved: ()       => { if (currentUser) pushProgressToDb(currentUser.id); },
    // Generic sync — call when any progress key changes.
    sync: ()              => { if (currentUser) pushProgressToDb(currentUser.id); },
  };

  init();
})();
