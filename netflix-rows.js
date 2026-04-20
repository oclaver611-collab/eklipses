// ============================================================
// Eklipses — Netflix-style row renderer
// Reads window.SCENARIOS, groups by category, builds rows.
// Loads AFTER scenarios.js, scenarios_extended.js, and player.js
// ============================================================

(function () {
  'use strict';

  // Category metadata: display name, emoji, sort order, fallback gradient
  const CATEGORIES = {
    dating: {
      label: 'Dating & Social',
      emoji: '💬',
      order: 1,
      gradient: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)'
    },
    interview: {
      label: 'Job Interview',
      emoji: '💼',
      order: 2,
      gradient: 'linear-gradient(135deg, #5b8def 0%, #2d5ab8 100%)'
    },
    dark_psychology: {
      label: 'Dark Psychology & Manipulation Defense',
      emoji: '🧠',
      order: 3,
      gradient: 'linear-gradient(135deg, #e74c3c 0%, #8e3022 100%)'
    }
  };

  // Default category when a scenario has no category field (legacy scenarios)
  const DEFAULT_CATEGORY = 'dating';

  // Scenarios flagged as NEW (the 10 we just added)
  const NEW_SCENARIO_KEYS = new Set([
    'interview_behavioral',
    'interview_salary',
    'interview_stress',
    'interview_weakness',
    'interview_counter',
    'darkpsych_gaslight',
    'darkpsych_darvo',
    'darkpsych_narc_boss',
    'darkpsych_lovebomb',
    'darkpsych_guilt'
  ]);

  function difficultyStars(level) {
    const n = Math.max(1, Math.min(5, level || 2));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function groupScenariosByCategory() {
    const scenarios = window.SCENARIOS || {};
    const grouped = {};

    Object.keys(scenarios).forEach((key) => {
      const sc = scenarios[key];
      const cat = sc.category || DEFAULT_CATEGORY;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ key, data: sc });
    });

    return grouped;
  }

  function buildCard(key, sc) {
    const card = document.createElement('div');
    card.className = 'nf-card';
    card.setAttribute('data-key', key);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    // Thumbnail — try the image, fallback to gradient if it fails
    const cat = sc.category || DEFAULT_CATEGORY;
    const gradient = (CATEGORIES[cat] || CATEGORIES[DEFAULT_CATEGORY]).gradient;
    const emoji = (CATEGORIES[cat] || CATEGORIES[DEFAULT_CATEGORY]).emoji;

    const thumbUrl = sc.thumb || '';
    const thumbHTML = thumbUrl
      ? `<img class="nf-card-thumb" src="${thumbUrl}" alt="" onerror="this.outerHTML='<div class=\\'nf-card-thumb-fallback\\' style=\\'background:${gradient}\\'>${emoji}</div>'">`
      : `<div class="nf-card-thumb-fallback" style="background:${gradient}">${emoji}</div>`;

    const difficulty = sc.difficulty || 2;
    const duration = sc.duration_min || 10;
    const isNew = NEW_SCENARIO_KEYS.has(key);

    card.innerHTML = `
      ${thumbHTML}
      <div class="nf-card-body">
        <div class="nf-card-title">${sc.title || key}</div>
        <div class="nf-card-meta">
          ${isNew ? '<span class="nf-badge nf-badge-new">NEW</span>' : ''}
          <span class="nf-badge nf-badge-difficulty" title="Difficulty ${difficulty}/5">${difficultyStars(difficulty)}</span>
          <span class="nf-badge nf-badge-duration">⏱ ${duration} min</span>
        </div>
      </div>
    `;

    // Click handler: select the scenario via the existing select dropdown
    // This reuses all the existing player.js wiring without modification.
    const selectScenario = () => {
      const select = document.getElementById('scenarioSelect');
      if (!select) return;
      select.value = key;
      // Fire change event so player.js picks it up
      select.dispatchEvent(new Event('change', { bubbles: true }));
      // Scroll up to the stage so user sees the player
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    card.addEventListener('click', selectScenario);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectScenario();
      }
    });

    return card;
  }

  function buildRow(categoryKey, scenarios) {
    const meta = CATEGORIES[categoryKey] || {
      label: categoryKey,
      emoji: '📂',
      order: 99
    };

    const row = document.createElement('section');
    row.className = 'nf-row';
    row.setAttribute('data-category', categoryKey);

    const header = document.createElement('div');
    header.className = 'nf-row-header';
    header.innerHTML = `
      <h2 class="nf-row-title"><span class="nf-emoji">${meta.emoji}</span>${meta.label}</h2>
      <span class="nf-row-count">${scenarios.length} ${scenarios.length === 1 ? 'scenario' : 'scenarios'}</span>
    `;

    const strip = document.createElement('div');
    strip.className = 'nf-strip';

    // Sort scenarios: NEW ones first, then by difficulty ascending
    scenarios.sort((a, b) => {
      const aNew = NEW_SCENARIO_KEYS.has(a.key) ? 0 : 1;
      const bNew = NEW_SCENARIO_KEYS.has(b.key) ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew;
      return (a.data.difficulty || 2) - (b.data.difficulty || 2);
    });

    scenarios.forEach(({ key, data }) => {
      strip.appendChild(buildCard(key, data));
    });

    row.appendChild(header);
    row.appendChild(strip);

    return row;
  }

  function renderNetflixLayout() {
    const wrap = document.querySelector('.wrap');
    if (!wrap) {
      console.warn('[Netflix] .wrap container not found');
      return;
    }

    // Enable netflix mode on the wrap
    wrap.classList.add('netflix-mode');

    // Remove any existing netflix container (in case of re-render)
    const existing = document.querySelector('.nf-container');
    if (existing) existing.remove();

    // Build the container
    const container = document.createElement('div');
    container.className = 'nf-container';

    const intro = document.createElement('p');
    intro.className = 'nf-intro';
    intro.textContent = 'Choose a conversation to practice. Click any card to start.';
    container.appendChild(intro);

    // Group and render
    const grouped = groupScenariosByCategory();
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const aOrder = (CATEGORIES[a] || { order: 99 }).order;
      const bOrder = (CATEGORIES[b] || { order: 99 }).order;
      return aOrder - bOrder;
    });

    sortedCategories.forEach((catKey) => {
      container.appendChild(buildRow(catKey, grouped[catKey]));
    });

    // Insert after .stage (which is inside .wrap)
    wrap.appendChild(container);
  }

  // Wait for DOM + scenarios to be ready
  function init() {
    if (!window.SCENARIOS || Object.keys(window.SCENARIOS).length === 0) {
      // Scenarios not loaded yet, retry shortly
      setTimeout(init, 100);
      return;
    }
    renderNetflixLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
