'use strict';

/* ================================================================
   Hackathon Judge – App Logic
   ================================================================ */

// ── Scoring categories ──────────────────────────────────────────

const CATEGORIES = [
    {
        id: 'innovation',
        name: 'חדשנות ויצירתיות',
        icon: '💡',
        weight: 22,
        desc: 'מידת המקוריות, חדשנות הרעיון ויצירתיות הפתרון המוצע'
    },
    {
        id: 'technical',
        name: 'ביצוע טכני',
        icon: '⚙️',
        weight: 27,
        desc: 'איכות הקוד, ארכיטקטורה, שימוש נכון בטכנולוגיה ומורכבות הפתרון'
    },
    {
        id: 'impact',
        name: 'השפעה ופוטנציאל',
        icon: '🚀',
        weight: 22,
        desc: 'פוטנציאל ההשפעה, גודל הבעיה הנפתרת, ערך עסקי ורלוונטיות'
    },
    {
        id: 'design',
        name: 'עיצוב וחווית משתמש',
        icon: '🎨',
        weight: 17,
        desc: 'עיצוב ויזואלי, קלות שימוש וחווית המשתמש הכוללת'
    },
    {
        id: 'feasibility',
        name: 'ישימות ומימוש',
        icon: '🔧',
        weight: 12,
        desc: 'מציאותיות הפתרון, יכולת סקייל ומוכנות לשוק'
    }
];

// ── State ───────────────────────────────────────────────────────

const state = {
    projects: [],
    judgeSubmissions: [],
    deleteTargetId: null
};

// ── Persistence ─────────────────────────────────────────────────

function save() {
    try {
        localStorage.setItem('hj-projects', JSON.stringify(state.projects));
        localStorage.setItem('hj-judges',   JSON.stringify(state.judgeSubmissions));
    } catch (_) { /* storage unavailable */ }
}

function load() {
    try {
        const raw = localStorage.getItem('hj-projects');
        if (raw) state.projects = JSON.parse(raw);
    } catch (_) {
        state.projects = [];
    }
    try {
        const raw2 = localStorage.getItem('hj-judges');
        if (raw2) state.judgeSubmissions = JSON.parse(raw2);
    } catch (_) {
        state.judgeSubmissions = [];
    }
}

// Loads projects.json from the server if localStorage is empty (for GitHub Pages deployment)
function loadRemoteProjects(callback) {
    if (state.projects.length > 0) { callback(); return; }
    fetch('data/projects.json')
        .then(r => { if (!r.ok) throw new Error('no file'); return r.json(); })
        .then(data => {
            if (Array.isArray(data) && data.length > 0) {
                // Load projects but clear scores so judges start fresh
                state.projects = data.map(p => ({ ...p, scores: {}, createdAt: p.createdAt || new Date().toISOString() }));
                save();
                toast('✅ פרויקטים נטענו אוטומטית');
            }
            callback();
        })
        .catch(() => callback()); // file doesn't exist locally — fine
}

// ── Score helpers ────────────────────────────────────────────────

/**
 * Weighted total out of 10, or null if no scores set.
 */
function calcTotal(scores) {
    if (!scores) return null;
    let total = 0;
    let any = false;
    for (const cat of CATEGORIES) {
        const v = scores[cat.id];
        if (v !== undefined && v !== null) {
            total += (v * cat.weight) / 100;
            any = true;
        }
    }
    return any ? total : null;
}

function isFullyScored(project) {
    if (!project.scores) return false;
    return CATEGORIES.every(c => project.scores[c.id] !== undefined);
}

// Returns averaged judge scores if judges submitted, else manual scores
function getAggregatedScores(project) {
    const relevant = state.judgeSubmissions.filter(j => j.projectScores[project.id]);
    if (relevant.length === 0) return project.scores;
    const averaged = {};
    for (const cat of CATEGORIES) {
        const vals = relevant
            .map(j => j.projectScores[project.id][cat.id])
            .filter(v => v !== undefined && v !== null && !isNaN(v));
        if (vals.length > 0) averaged[cat.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return averaged;
}

function scoreClass(s) {
    if (s === null || s === undefined) return '';
    if (s >= 8) return 'c-ex';
    if (s >= 6) return 'c-gd';
    if (s >= 4) return 'c-av';
    return 'c-po';
}

function fillClass(s) {
    if (s === null || s === undefined) return 'f-av';
    if (s >= 8) return 'f-ex';
    if (s >= 6) return 'f-gd';
    if (s >= 4) return 'f-av';
    return 'f-po';
}

function scoreColor(s) {
    if (s === null || s === undefined) return '#555570';
    if (s >= 8) return '#10b981';
    if (s >= 6) return '#06b6d4';
    if (s >= 4) return '#f59e0b';
    return '#ef4444';
}

// ── Security helper ──────────────────────────────────────────────

function esc(text) {
    const d = document.createElement('span');
    d.textContent = text || '';
    return d.innerHTML;
}

// ── Toast ────────────────────────────────────────────────────────

function toast(msg, type = 'ok') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' toast-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.transition = 'opacity 0.3s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 310);
    }, 2600);
}

// ── View navigation ──────────────────────────────────────────────

function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('view-' + name).classList.add('active');
    document.querySelector(`.nav-btn[data-view="${name}"]`).classList.add('active');

    if (name === 'leaderboard') renderLeaderboard();
    if (name === 'projects')    renderProjects();
    if (name === 'scoring')     renderScoringView();
    if (name === 'judges')      renderJudgesView();
}

// ── Leaderboard ──────────────────────────────────────────────────

function renderLeaderboard() {
    const statsEl   = document.getElementById('stats-bar');
    const contentEl = document.getElementById('leaderboard-content');

    const total  = state.projects.length;
    const scored = state.projects.filter(isFullyScored).length;

    const hasJudges = state.judgeSubmissions.length > 0;
    const judgeNote = hasJudges
        ? `<div class="stat-chip">📊 ממוצע <span>${state.judgeSubmissions.length}</span> שופטים</div>`
        : '';

    statsEl.innerHTML =
        `<div class="stat-chip">סה"כ פרויקטים: <span>${total}</span></div>` +
        `<div class="stat-chip">עם ניקוד: <span>${scored}</span></div>` +
        `<div class="stat-chip">ממתינים: <span>${total - scored}</span></div>` +
        judgeNote;

    if (total === 0) {
        contentEl.innerHTML =
            `<div class="empty-state">
                <div class="empty-icon">🏆</div>
                <h3>אין פרויקטים עדיין</h3>
                <p>עבור ל"ניהול פרויקטים" כדי להוסיף את הפרויקטים המתחרים</p>
            </div>`;
        return;
    }

    // Sort: scored desc → unscored by insertion order
    const ranked = state.projects
        .map(p => ({ ...p, _tot: calcTotal(getAggregatedScores(p)) }))
        .sort((a, b) => {
            if (a._tot === null && b._tot === null) return 0;
            if (a._tot === null) return 1;
            if (b._tot === null) return -1;
            return b._tot - a._tot;
        });

    let scoredRank = 0, prevScore = null;
    const items = ranked.map(p => {
        const sc = p._tot !== null;
        let rank = null;
        if (sc) {
            if (p._tot !== prevScore) { scoredRank++; prevScore = p._tot; }
            rank = scoredRank;
        }
        const rankCls  = sc ? (rank <= 3 ? 'r' + rank : 'rN') : 'rN';
        const rankLbl  = !sc ? '—' : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;

        const pips = CATEGORIES.map(cat => {
            const effScores = getAggregatedScores(p);
            const v = effScores && effScores[cat.id];
            return `<div class="cat-pip">
                        <div class="pip-dot" style="background:${scoreColor(v)}"></div>
                        <span>${cat.icon} ${v !== undefined ? v : '—'}</span>
                    </div>`;
        }).join('');

        return `<div class="lb-item ${rankCls}">
            <div class="rank-badge">${rankLbl}</div>
            <div class="lb-info">
                <div class="lb-name">${esc(p.name)}</div>
                <div class="lb-team">👥 ${esc(p.team)}${p.members ? ` &nbsp;·&nbsp; 👤 ${p.members} משתתפים` : ''}</div>
                <div class="cat-pips">${pips}</div>
            </div>
            <div class="score-col">
                ${sc
                    ? `<div class="score-big ${scoreClass(p._tot)}">${p._tot.toFixed(1)}</div>
                       <div class="score-sub">מתוך 10</div>
                       <div class="score-track">
                           <div class="score-fill ${fillClass(p._tot)}" style="width:${p._tot * 10}%"></div>
                       </div>`
                    : `<div class="unscored">טרם נוקד</div>`
                }
            </div>
        </div>`;
    });

    contentEl.innerHTML = `<div class="leaderboard-grid">${items.join('')}</div>`;
}

// ── Projects management ──────────────────────────────────────────

function renderProjects() {
    const el = document.getElementById('projects-list');

    if (state.projects.length === 0) {
        el.innerHTML =
            `<div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>אין פרויקטים</h3>
                <p>לחץ על "+ הוסף פרויקט" כדי להתחיל</p>
            </div>`;
        return;
    }

    const cards = state.projects.map(p => {
        const tot    = calcTotal(getAggregatedScores(p));
        const full   = isFullyScored(p);

        return `<div class="proj-card">
            <div class="proj-card-top">
                <div>
                    <div class="proj-name">${esc(p.name)}</div>
                    <div class="proj-team">👥 ${esc(p.team)}${p.members ? ` &nbsp;·&nbsp; 👤 ${p.members} משתתפים` : ''}</div>
                </div>
                <div class="proj-actions">
                    <button class="btn btn-secondary btn-icon" data-action="edit" data-id="${p.id}" title="ערוך">✏️</button>
                    <button class="btn btn-secondary btn-icon" data-action="delete" data-id="${p.id}" title="מחק">🗑️</button>
                </div>
            </div>
            ${p.description ? `<div class="proj-desc">${esc(p.description)}</div>` : ''}
            <div class="proj-foot">
                <span class="status-badge ${full ? 's-scored' : 's-pending'}">
                    ${full ? '✅ נוקד' : '⏳ ממתין לניקוד'}
                </span>
                ${tot !== null
                    ? `<span class="score-big ${scoreClass(tot)}" style="font-size:1.2rem">${tot.toFixed(1)}</span>`
                    : ''}
            </div>
        </div>`;
    });

    el.innerHTML = `<div class="projects-grid">${cards.join('')}</div>`;

    // Event delegation – edit / delete buttons
    el.addEventListener('click', handleProjectAction);
}

function handleProjectAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit')   openEditProject(id);
    if (action === 'delete') openDeleteConfirm(id);
}

// ── Project modal ────────────────────────────────────────────────

function openAddProject() {
    document.getElementById('modal-title').textContent = 'הוסף פרויקט';
    document.getElementById('project-id').value      = '';
    document.getElementById('project-name').value    = '';
    document.getElementById('project-team').value    = '';
    document.getElementById('project-members').value = '';
    document.getElementById('project-desc').value    = '';
    document.getElementById('project-modal').hidden = false;
    document.getElementById('project-name').focus();
}

function openEditProject(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-title').textContent = 'ערוך פרויקט';
    document.getElementById('project-id').value      = p.id;
    document.getElementById('project-name').value    = p.name;
    document.getElementById('project-team').value    = p.team;
    document.getElementById('project-members').value = p.members || '';
    document.getElementById('project-desc').value    = p.description || '';
    document.getElementById('project-modal').hidden = false;
    document.getElementById('project-name').focus();
}

function closeProjectModal() {
    document.getElementById('project-modal').hidden = true;
}

function saveProject() {
    const id   = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value.trim();
    const team = document.getElementById('project-team').value.trim();
    const desc = document.getElementById('project-desc').value.trim();

    if (!name || !team) {
        toast('⚠️ שם הפרויקט ושם הקבוצה הם שדות חובה', 'err');
        return;
    }

    if (id) {
        const p = state.projects.find(x => x.id === id);
        if (p) { p.name = name; p.team = team; p.description = desc; }
        toast('✅ הפרויקט עודכן');
    } else {
        state.projects.push({
            id: 'p' + Date.now(),
            name, team,
            description: desc,
            scores: {},
            createdAt: new Date().toISOString()
        });
        toast('✅ הפרויקט נוסף');
    }

    save();
    closeProjectModal();
    renderProjects();
}

// ── Delete modal ─────────────────────────────────────────────────

function openDeleteConfirm(id) {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    state.deleteTargetId = id;
    // Use textContent – no XSS risk
    document.getElementById('delete-project-name').textContent = p.name;
    document.getElementById('delete-modal').hidden = false;
}

function closeDeleteModal() {
    document.getElementById('delete-modal').hidden = true;
    state.deleteTargetId = null;
}

function confirmDelete() {
    state.projects = state.projects.filter(p => p.id !== state.deleteTargetId);
    save();
    closeDeleteModal();
    renderProjects();
    toast('🗑️ הפרויקט נמחק');
}

// ── Scoring view ─────────────────────────────────────────────────

function renderScoringView() {
    const sel = document.getElementById('project-select');
    const prev = sel.value;

    sel.innerHTML = '<option value="">-- בחר פרויקט --</option>';
    state.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value       = p.id;
        opt.textContent = `${p.name}  —  ${p.team}`;
        sel.appendChild(opt);
    });

    // Restore previous selection if still valid
    if (prev && state.projects.find(p => p.id === prev)) {
        sel.value = prev;
        buildScoringForm(prev);
    } else {
        document.getElementById('scoring-form').innerHTML = '';
    }
}

function buildScoringForm(projectId) {
    const el = document.getElementById('scoring-form');

    if (!projectId) { el.innerHTML = ''; return; }

    const p = state.projects.find(x => x.id === projectId);
    if (!p) { el.innerHTML = ''; return; }

    const scores = p.scores || {};
    const tot    = calcTotal(scores);

    const catCards = CATEGORIES.map(cat => {
        const val = scores[cat.id] !== undefined ? scores[cat.id] : 5;
        return `<div class="cat-card">
            <div class="cat-card-top">
                <div class="cat-title">
                    <span class="cat-icon">${cat.icon}</span>
                    <span>${cat.name}</span>
                </div>
                <span class="cat-weight">משקל ${cat.weight}%</span>
            </div>
            <div class="cat-desc">${cat.desc}</div>
            <div class="slider-row">
                <input type="range"
                    class="score-slider"
                    id="slider-${cat.id}"
                    min="1" max="10" step="0.5"
                    value="${val}"
                    aria-label="${cat.name}">
                <input type="number"
                    class="score-num-input"
                    id="num-${cat.id}"
                    min="1" max="10" step="0.5"
                    value="${val}"
                    aria-label="ציון ${cat.name}">
            </div>
            <div class="slider-labels">
                <span>1 – גרוע</span>
                <span>5 – ממוצע</span>
                <span>10 – מצוין</span>
            </div>
            <div class="cat-contribution">
                <span>תרומה לציון הכולל</span>
                <span class="contrib-val" id="contrib-${cat.id}">${((val * cat.weight) / 100).toFixed(2)}</span>
            </div>
        </div>`;
    }).join('');

    el.innerHTML =
        `<div class="scoring-header">
            <div>
                <div class="sc-proj-name">${esc(p.name)}</div>
                <div class="sc-proj-team">👥 ${esc(p.team)}</div>
            </div>
            <div class="total-score-box">
                <div class="total-num ${scoreClass(tot)}" id="total-num">
                    ${tot !== null ? tot.toFixed(1) : '—'}
                </div>
                <div class="total-lbl">ציון כולל</div>
            </div>
        </div>
        <div class="categories-grid">${catCards}</div>
        <div class="save-bar">
            <span class="save-hint">💾 הציונים נשמרים אוטומטית בעת השינוי</span>
            <button class="btn btn-secondary" id="btn-reset-scores">🔄 אפס ציונים</button>
        </div>`;

    // Attach slider/number listeners
    CATEGORIES.forEach(cat => {
        const slider = document.getElementById('slider-' + cat.id);
        const numIn  = document.getElementById('num-'    + cat.id);

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            numIn.value = v;
            applyScore(p.id, cat.id, v);
        });

        numIn.addEventListener('input', () => {
            let v = parseFloat(numIn.value);
            if (isNaN(v)) return;
            v = Math.min(10, Math.max(1, v));
            slider.value = v;
            applyScore(p.id, cat.id, v);
        });

        numIn.addEventListener('blur', () => {
            let v = parseFloat(numIn.value);
            if (isNaN(v) || v < 1) v = 1;
            if (v > 10) v = 10;
            numIn.value = v;
            slider.value = v;
            applyScore(p.id, cat.id, v);
        });
    });

    document.getElementById('btn-reset-scores').addEventListener('click', () => {
        resetScores(p.id);
    });
}

function applyScore(projectId, catId, value) {
    const p = state.projects.find(x => x.id === projectId);
    if (!p) return;
    if (!p.scores) p.scores = {};
    p.scores[catId] = value;

    // Update contribution display
    const cat = CATEGORIES.find(c => c.id === catId);
    const cEl = document.getElementById('contrib-' + catId);
    if (cEl && cat) cEl.textContent = ((value * cat.weight) / 100).toFixed(2);

    // Update total
    const tot = calcTotal(p.scores);
    const tEl = document.getElementById('total-num');
    if (tEl) {
        tEl.textContent = tot !== null ? tot.toFixed(1) : '—';
        tEl.className   = 'total-num ' + scoreClass(tot);
    }

    save();
}

function resetScores(projectId) {
    const p = state.projects.find(x => x.id === projectId);
    if (!p) return;
    p.scores = {};
    save();
    buildScoringForm(projectId);
    toast('🔄 הציונים אופסו');
}

// ── Confetti ──────────────────────────────────────────────────────

function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');

    const COLORS = ['#0891b2','#67e8f9','#fde68a','#f59e0b','#a7f3d0','#fca5a5','#c7d2fe','#fcd9b0'];
    const pieces = Array.from({ length: 160 }, () => ({
        x:   Math.random() * canvas.width,
        y:   Math.random() * canvas.height - canvas.height,
        w:   6 + Math.random() * 8,
        h:   10 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        rV:  (Math.random() - 0.5) * 0.14,
        vx:  (Math.random() - 0.5) * 2.5,
        vy:  2.5 + Math.random() * 3.5,
        col: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 1
    }));

    let frame;
    let tick = 0;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tick++;
        pieces.forEach(p => {
            p.x   += p.vx;
            p.y   += p.vy;
            p.rot += p.rV;
            if (tick > 90) p.alpha = Math.max(0, p.alpha - 0.012);
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.col;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        if (tick < 180) {
            frame = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
        }
    }

    if (frame) cancelAnimationFrame(frame);
    draw();
}

// ── Podium modal ─────────────────────────────────────────────────

function buildScoreTable(p) {
    const effScores = getAggregatedScores(p);
    if (!effScores || Object.keys(effScores).length === 0) {
        return `<p class="podium-no-scores">טרם נוקד</p>`;
    }
    const rows = CATEGORIES.map(cat => {
        const v = effScores[cat.id];
        if (v === undefined) return '';
        const bar = `<div class="pt-bar-wrap"><div class="pt-bar ${fillClass(v)}" style="width:${v * 10}%"></div></div>`;
        return `<tr>
            <td class="pt-cat">${cat.icon} ${cat.name}</td>
            <td class="pt-score ${scoreClass(v)}">${v}</td>
            <td class="pt-bar-cell">${bar}</td>
            <td class="pt-weight">${cat.weight}%</td>
        </tr>`;
    }).join('');
    return `<table class="podium-table"><tbody>${rows}</tbody></table>`;
}

function openPodium() {
    const allScored = state.projects
        .map(p => ({ ...p, _tot: calcTotal(getAggregatedScores(p)) }))
        .filter(p => p._tot !== null)
        .sort((a, b) => b._tot - a._tot);

    // Assign dense ranks (ties get the same rank)
    let denseRank = 0, prevTot = null;
    allScored.forEach(p => {
        if (p._tot !== prevTot) { denseRank++; prevTot = p._tot; }
        p._rank = denseRank;
    });
    const scored = allScored.slice(0, 3);

    const medalFor = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '#' + r;
    const pClass = ['p1', 'p2', 'p3'];
    // Display order: 2nd left, 1st center, 3rd right
    const order  = [1, 0, 2];

    // ── Podium visual (SVG blocks) ──
    const heights = { p1: 130, p2: 95, p3: 68 };
    const blockColors = {
        p1: { top: '#fde68a', bot: '#f59e0b', shadow: 'rgba(245,158,11,0.32)' },
        p2: { top: '#e2e8f0', bot: '#94a3b8', shadow: 'rgba(148,163,184,0.28)' },
        p3: { top: '#fcd9b0', bot: '#cd7c2f', shadow: 'rgba(205,124,47,0.26)' }
    };

    const podiumBlocks = order.map(idx => {
        const cls = pClass[idx];
        const h   = heights[cls];
        const c   = blockColors[cls];
        const p   = scored[idx];
        const label = idx + 1;
        return `<div class="podium-col ${cls}">
            <div class="podium-above">
                ${p ? `<div class="podium-medal">${medalFor(p._rank)}</div>
                        <div class="podium-name">${esc(p.name)}</div>
                        <div class="podium-team">${esc(p.team)}</div>
                        <div class="podium-score ${scoreClass(p._tot)}">${p._tot.toFixed(1)}</div>`
                   : `<div class="podium-empty">אין ניקוד</div>`}
            </div>
            <div class="podium-block ${cls}" style="height:${h}px;background:linear-gradient(180deg,${c.top},${c.bot});box-shadow:0 6px 20px ${c.shadow}">
                <span class="podium-rank-lbl">#${label}</span>
            </div>
        </div>`;
    }).join('');

    // ── Score tables (ordered 1,2,3) ──
    const tables = [0, 1, 2].map(idx => {
        const p = scored[idx];
        if (!p) return '';
        return `<div class="podium-detail-card ${pClass[idx]}">
            <div class="pdc-header">
                <span class="pdc-medal">${medalFor(p._rank)}</span>
                <div>
                    <div class="pdc-name">${esc(p.name)}</div>
                    <div class="pdc-team">${esc(p.team)}</div>
                </div>
                <div class="pdc-total ${scoreClass(p._tot)}">${p._tot.toFixed(1)}</div>
            </div>
            ${buildScoreTable(p)}
        </div>`;
    }).join('');

    document.getElementById('podium-body').innerHTML =
        `<div class="podium-stage">${podiumBlocks}</div>
         <div class="podium-details">${tables}</div>`;

    document.getElementById('podium-modal').hidden = false;
    launchConfetti();
}

function closePodium() {
    document.getElementById('podium-modal').hidden = true;
}

function exportProjectsJSON() {
    if (state.projects.length === 0) {
        toast('⚠️ אין פרויקטים לייצוא', 'err');
        return;
    }
    // Export only project metadata — no scores
    const data = state.projects.map(({ id, name, team, members, description, createdAt }) =>
        ({ id, name, team, members, description, createdAt }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'projects.json';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('export-hint').hidden = false;
    toast('📤 projects.json הורד');
}



function parseCSV(text) {
    // Remove BOM
    text = text.replace(/^\uFEFF/, '');
    // Detect separator (Excel Hebrew uses semicolons)
    const firstLine = text.split(/\r?\n/)[0] || '';
    const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
        const cells = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
                else inQ = !inQ;
            } else if (ch === sep && !inQ) {
                cells.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        cells.push(cur.trim());
        return cells;
    });
}

function downloadTemplate() {
    if (state.projects.length === 0) {
        toast('⚠️ אין פרויקטים — הוסף פרויקטים תחילה', 'err');
        return;
    }
    const sep = ',';
    const headers = [
        'שם הפרויקט',
        'שם הקבוצה',
        'שם השופט',
        ...CATEGORIES.map(c => `${c.icon} ${c.name} (${c.weight}%)`)
    ];
    const rows = state.projects.map(p => [
        p.name, p.team, '[הכנס שמך כאן]',
        ...CATEGORIES.map(() => '')
    ]);
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
        .join('\r\n');
    // BOM for Excel Hebrew support
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'hackathon-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 התבנית הורדה');
}

function importJudgeCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const rows = parseCSV(e.target.result);
            if (rows.length < 2) { toast('⚠️ הקובץ ריק', 'err'); return; }

            // Judge name comes from column 2 of first data row
            const judgeName = (rows[1][2] || '').trim();
            if (!judgeName || judgeName === '[הכנס שמך כאן]') {
                toast('⚠️ יש למלא שם שופט בעמודה "שם השופט"', 'err');
                return;
            }
            if (state.judgeSubmissions.find(j => j.judgeName === judgeName)) {
                toast(`⚠️ שופט "${judgeName}" כבר הועלה — מחק אותו תחילה`, 'err');
                return;
            }

            const projectScores = {};
            let matched = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const projName = (row[0] || '').trim();
                if (!projName) continue;
                const project = state.projects.find(p => p.name === projName);
                if (!project) continue;
                const scores = {};
                CATEGORIES.forEach((cat, idx) => {
                    const v = parseFloat(row[3 + idx]);
                    if (!isNaN(v)) scores[cat.id] = Math.min(10, Math.max(1, v));
                });
                if (Object.keys(scores).length > 0) {
                    projectScores[project.id] = scores;
                    matched++;
                }
            }

            if (matched === 0) {
                toast('⚠️ לא נמצאו ציונים תקינים — בדוק שמות פרויקטים', 'err');
                return;
            }

            state.judgeSubmissions.push({
                id: 'j' + Date.now(),
                judgeName,
                uploadedAt: new Date().toISOString(),
                projectScores
            });

            save();
            renderJudgesView();
            renderLeaderboard();
            toast(`✅ ציוני "${judgeName}" יובאו (${matched} פרויקטים)`);
        } catch (_) {
            toast('⚠️ שגיאה בקריאת הקובץ', 'err');
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function removeJudge(id) {
    state.judgeSubmissions = state.judgeSubmissions.filter(j => j.id !== id);
    save();
    renderJudgesView();
    renderLeaderboard();
    toast('🗑️ השופט הוסר');
}

// ── Judges view ───────────────────────────────────────────────────

function renderJudgesView() {
    const el = document.getElementById('judges-content');

    const judgeCount   = state.judgeSubmissions.length;
    const projectCount = state.projects.length;

    if (projectCount === 0) {
        el.innerHTML = `<div class="empty-state">
            <div class="empty-icon">👨‍⚖️</div>
            <h3>אין פרויקטים</h3>
            <p>הוסף פרויקטים תחילה, אחר כך הורד תבנית לשופטים</p>
        </div>`;
        return;
    }

    // ── Instructions panel ──
    const intro = `<div class="judges-intro">
        <div class="ji-step"><span class="ji-num">1</span><div><strong>הורד תבנית CSV</strong><br>לחץ "📥 הורד תבנית CSV" — קובץ עם כל הפרויקטים והקריטריונים</div></div>
        <div class="ji-step"><span class="ji-num">2</span><div><strong>שלח לשופטים</strong><br>כל שופט ממלא את שמו ואת הציונים (1–10) ב-Excel/Google Sheets</div></div>
        <div class="ji-step"><span class="ji-num">3</span><div><strong>העלה ציוני שופט</strong><br>לחץ "📤 העלה ציוני שופט" ובחר את ה-CSV שהשופט החזיר</div></div>
        <div class="ji-step"><span class="ji-num">4</span><div><strong>תוצאות אוטומטיות</strong><br>לוח התוצאות מציג ממוצע של כל השופטים</div></div>
    </div>`;

    // ── Submitted judges ──
    let judgesHtml = '';
    if (judgeCount === 0) {
        judgesHtml = `<div class="judges-empty">עדיין לא הועלו ציוני שופטים</div>`;
    } else {
        const cards = state.judgeSubmissions.map(j => {
            const cnt = Object.keys(j.projectScores).length;
            const date = new Date(j.uploadedAt).toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
            return `<div class="judge-card">
                <div class="judge-card-info">
                    <span class="judge-avatar">👨‍⚖️</span>
                    <div>
                        <div class="judge-name">${esc(j.judgeName)}</div>
                        <div class="judge-meta">${cnt} פרויקטים · ${date}</div>
                    </div>
                </div>
                <button class="btn btn-secondary btn-icon" data-remove-judge="${j.id}" title="הסר שופט">🗑️</button>
            </div>`;
        }).join('');
        judgesHtml = `<div class="judges-list">${cards}</div>`;
    }

    // ── Aggregated results table ──
    let tableHtml = '';
    if (judgeCount > 0 && projectCount > 0) {
        const sortedProjects = state.projects
            .map(p => ({ ...p, _tot: calcTotal(getAggregatedScores(p)) }))
            .filter(p => p._tot !== null)
            .sort((a, b) => b._tot - a._tot);

        const catHeaders = CATEGORIES.map(c => `<th>${c.icon}<br><span>${c.name}</span></th>`).join('');
        const judgeHeaders = state.judgeSubmissions.map(j => `<th class="jth">👨‍⚖️<br><span>${esc(j.judgeName)}</span></th>`).join('');

        const tableRows = sortedProjects.map((p, i) => {
            const eff = getAggregatedScores(p);
            const catCells = CATEGORIES.map(c => {
                const v = eff && eff[c.id] !== undefined ? Number(eff[c.id]).toFixed(1) : '—';
                return `<td class="${scoreClass(parseFloat(v))}">${v}</td>`;
            }).join('');

            // Per-judge cells
            const judgeCells = state.judgeSubmissions.map(j => {
                const ps = j.projectScores[p.id];
                if (!ps) return `<td class="jcell jcell-miss">—</td>`;
                const jTot = calcTotal(ps);
                return `<td class="jcell ${scoreClass(jTot)}">${jTot !== null ? jTot.toFixed(1) : '—'}</td>`;
            }).join('');

            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            return `<tr>
                <td class="agg-rank">${medal}</td>
                <td class="agg-name"><strong>${esc(p.name)}</strong><br><span class="agg-team">${esc(p.team)}</span></td>
                ${catCells}
                ${judgeCells}
                <td class="agg-total ${scoreClass(p._tot)}"><strong>${p._tot.toFixed(1)}</strong></td>
            </tr>`;
        }).join('');

        tableHtml = `
        <div class="agg-section">
            <h3 class="section-title">📊 טבלת תוצאות מצוברת</h3>
            <div class="agg-table-wrap">
                <table class="agg-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>פרויקט</th>
                            ${catHeaders}
                            ${judgeHeaders}
                            <th class="agg-total-h">ממוצע</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>`;
    }

    el.innerHTML = intro + `
        <div class="judges-section">
            <h3 class="section-title">👨‍⚖️ שופטים שהגישו (${judgeCount})</h3>
            ${judgesHtml}
        </div>` + tableHtml;

    // Remove judge buttons
    el.querySelectorAll('[data-remove-judge]').forEach(btn => {
        btn.addEventListener('click', () => removeJudge(btn.dataset.removeJudge));
    });
}

// ── CSV listener ──────────────────────────────────────────────────

// ── Wire-up DOM events ───────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
});

document.getElementById('btn-add-project').addEventListener('click', openAddProject);
document.getElementById('btn-export-projects').addEventListener('click', exportProjectsJSON);
document.getElementById('btn-podium').addEventListener('click', openPodium);
document.getElementById('btn-download-template').addEventListener('click', downloadTemplate);

document.getElementById('csv-upload').addEventListener('change', function() {
    if (this.files && this.files[0]) {
        importJudgeCSV(this.files[0]);
        this.value = ''; // allow re-uploading same file
    }
});
document.getElementById('podium-close-btn').addEventListener('click', closePodium);
document.getElementById('podium-modal').addEventListener('click', function(e) {
    if (e.target === this) closePodium();
});

document.getElementById('modal-close-btn').addEventListener('click', closeProjectModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeProjectModal);
document.getElementById('modal-save-btn').addEventListener('click', saveProject);

document.getElementById('delete-cancel-btn').addEventListener('click', closeDeleteModal);
document.getElementById('delete-confirm-btn').addEventListener('click', confirmDelete);

// Close modals when clicking overlay background
document.getElementById('project-modal').addEventListener('click', function(e) {
    if (e.target === this) closeProjectModal();
});
document.getElementById('delete-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
});

// Keyboard: Enter submits project form, Escape closes modals
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeProjectModal();
        closeDeleteModal();
        closePodium();
    }
    if (e.key === 'Enter' && !document.getElementById('project-modal').hidden) {
        const active = document.activeElement;
        if (active && active.tagName !== 'TEXTAREA') saveProject();
    }
});

document.getElementById('project-select').addEventListener('change', function() {
    buildScoringForm(this.value);
});

// ── Init ─────────────────────────────────────────────────────────

load();
loadRemoteProjects(renderLeaderboard);
