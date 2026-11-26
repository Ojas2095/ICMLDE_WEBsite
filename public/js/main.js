/* ===================================================================
   ICMLDE 2026 — shared site scripts
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initRibbon();
  initCopyButtons();
  initTabs();
  initContactForm();
  initSpecialSessionForm();
});

/** Escape text before putting it into innerHTML. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

/* ---------- Mobile navigation ---------- */
function initMobileNav() {
  const btn = document.getElementById('mobileNavToggle');
  const nav = document.getElementById('mobileNav');
  if (!btn || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Close' : 'Menu';
  };
  btn.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}

/* ---------- Key-dates ribbon (home) ---------- */
function initRibbon() {
  const ribbon = document.getElementById('ribbon');
  if (!ribbon) return;

  const items = [...ribbon.querySelectorAll('li')];
  const ist = (d, end) => new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+05:30`).getTime();
  const dates = items.map(li => ({ start: ist(li.dataset.date), end: ist(li.dataset.end || li.dataset.date, true) }));
  const now = Date.now();
  const confStart = new Date('2026-11-27T09:00:00+05:30').getTime();
  const confEnd = dates[dates.length - 1].end;

  // mark past / next milestones
  let nextIdx = dates.findIndex(d => now < d.start);
  items.forEach((li, i) => {
    if (now > dates[i].end) li.classList.add('done');
    if (i === nextIdx) li.classList.add('next');
  });

  // progress: equal spacing between milestones, interpolated by real time
  let pos; // 0 .. items.length-1
  if (now <= dates[0].start) pos = 0;
  else if (now >= confEnd) pos = items.length - 1;
  else if (nextIdx === -1) pos = items.length - 1;
  else {
    const prev = nextIdx - 1;
    const from = dates[prev].start, to = dates[nextIdx].start;
    pos = prev + Math.min(1, Math.max(0, (now - from) / (to - from)));
  }
  const n = items.length;
  const pct = (pos / (n - 1)) * 100;                 // along the inner line
  const fill = ribbon.querySelector('.ribbon-fill');
  const today = ribbon.querySelector('.ribbon-today');
  // vertical list: fill runs from the first dot to the last
  requestAnimationFrame(() => {
    fill.style.setProperty('--fill', String(pct / 100));
    today.style.left = `calc(10% + (100% - 20%) * ${pct / 100})`;
  });
  if (now >= confEnd || now < dates[0].start) today.style.display = 'none';

  // status sentence
  const statusEl = document.getElementById('ribbonStatus');
  const subEl = document.getElementById('ribbonSub');
  const dayMs = 86400000;
  const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
  const istDay = (t) => Math.floor((t + 5.5 * 3600000) / dayMs);

  if (now < confStart) {
    const days = istDay(confStart) - istDay(now);
    statusEl.textContent = days <= 0 ? 'Opens today' : days === 1 ? 'Opens tomorrow' : `Opens in ${days} days`;
    if (nextIdx > -1 && nextIdx < n - 1) {
      subEl.textContent = `Next: ${items[nextIdx].querySelector('.what').textContent.toLowerCase()} on ${fmt(dates[nextIdx].start)}`;
    } else {
      subEl.textContent = 'Friday 27 November. Registration desk opens at 08:30 IST, inaugural at 09:30.';
    }
  } else if (now <= confEnd) {
    const dayNo = istDay(now) - istDay(confStart) + 1;
    statusEl.textContent = `Day ${dayNo} is under way`;
    subEl.innerHTML = '<a href="/schedule.html" style="color:inherit">Today’s programme</a>';
  } else {
    statusEl.textContent = 'That’s a wrap. Thank you, authors and delegates.';
    subEl.innerHTML = '<a href="/fee-receipt.html" style="color:inherit">Fee receipts</a> and <a href="/certificate.html" style="color:inherit">certificates</a> remain available.';
  }
}

/* ---------- Copy buttons (bank details) ---------- */
function initCopyButtons() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = old; }, 1500);
    } catch {
      showToast('Copy failed. Select the text and copy it manually.', 'error');
    }
  });
}

/* ---------- Tabs (programme, admin) ---------- */
function initTabs() {
  document.querySelectorAll('[role="tablist"]').forEach(list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    };
    // open today's tab automatically (programme days carry data-date)
    const todayIst = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    const todays = tabs.find(t => t.dataset.date === todayIst);
    if (todays) select(todays);
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          next.focus(); select(next);
        }
      });
    });
  });
}

/* ---------- Toasts ---------- */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
window.showToast = showToast;

/* ---------- Simple JSON form helper ---------- */
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { res, data };
}
window.postJson = postJson;

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const { res, data } = await postJson('/api/contact', Object.fromEntries(new FormData(form)));
      if (res.ok && data.success) {
        showToast('Message sent. The secretariat will reply by email.', 'success');
        form.reset();
      } else {
        showToast(data.error || 'Your message wasn’t sent. Check the fields and try again.', 'error');
      }
    } catch {
      showToast('Couldn’t reach the server. Check your connection and try again.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}

function initSpecialSessionForm() {
  const form = document.getElementById('specialSessionForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const { res, data } = await postJson('/api/special-sessions', Object.fromEntries(new FormData(form)));
      if (res.ok && data.success) {
        showToast('Proposal sent. The programme committee will be in touch.', 'success');
        form.reset();
      } else {
        showToast(data.error || 'Your proposal wasn’t sent. Check the fields and try again.', 'error');
      }
    } catch {
      showToast('Couldn’t reach the server. Check your connection and try again.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}
