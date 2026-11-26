/* ===================================================================
   ICMLDE 2026 — fee receipt lookup
   Talks to POST /api/fee-receipt, which reads the secretariat's
   Google Sheet on the server and returns only the matching rows.
   =================================================================== */

(function () {
  const form = document.getElementById('receiptForm');
  const out = document.getElementById('receiptOutput');
  const errEl = document.getElementById('rError');
  const btn = document.getElementById('rSubmit');
  if (!form || !out) return;

  const helpHtml = out.innerHTML;
  const esc = window.escapeHtml;

  // Allow ?paper=913 links from emails
  const params = new URLSearchParams(location.search);
  if (params.get('paper')) form.paper_id.value = params.get('paper');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    const paper_id = form.paper_id.value.trim();
    const email = form.email.value.trim();

    if (!paper_id) { errEl.textContent = 'Enter your Paper ID.'; form.paper_id.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Enter the full email address you registered with.'; form.email.focus(); return; }

    btn.disabled = true;
    btn.textContent = 'Looking up your receipt…';
    out.innerHTML = '<p class="loading">Checking the payment records…</p>';

    try {
      const { res, data } = await window.postJson('/api/fee-receipt', { paper_id, email });
      if (res.ok && data.success && Array.isArray(data.data)) {
        renderReceipts(data.data);
      } else {
        renderMessage(data.error || 'No receipt matches those details.', data.pending ? 'warn' : 'error',
          data.pending ? 'Payment not confirmed yet' : 'No receipt found');
      }
    } catch {
      renderMessage('The receipt service couldn’t be reached. Check your connection and try again.', 'error', 'Connection problem');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Find my receipt';
    }
  });

  function renderMessage(message, kind, title) {
    out.innerHTML = `
      <div class="result-card ${kind}">
        <p class="err-title" ${kind === 'warn' ? 'style="color:var(--warn)"' : ''}>${esc(title)}</p>
        <p>${esc(message)}</p>
        <div class="actions"><button type="button" class="btn btn-outline btn-sm" data-reset>Show help</button></div>
      </div>`;
    out.querySelector('[data-reset]').addEventListener('click', () => { out.innerHTML = helpHtml; });
  }

  // Which ICMLDE edition a payment belongs to, by the year it was paid
  const EDITIONS = {
    2025: { ordinal: '4th', short: 'ICMLDE 2025', datesLong: '6th-8th November 2025' },
    2026: { ordinal: '5th', short: 'ICMLDE 2026', datesLong: '27th-28th November 2026' }
  };
  const DEFAULT_YEAR = 2026;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /** Parse "2025-10-10 00:00:00", "10/13/2025 16:32", "13-10-2025", "10 October 2025" → {y, m, d} */
  function parseDate(raw) {
    const s = String(raw || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return { y: +m[1], m: +m[2], d: +m[3] };
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/))) {
      let a = +m[1], b = +m[2];
      // the payment export writes month/day; fall back to day/month when that is impossible
      let month = a, day = b;
      if (a > 12 && b <= 12) { month = b; day = a; }
      return { y: +m[3], m: month, d: day };
    }
    if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/))) {
      const mi = MONTHS.findIndex(x => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
      if (mi >= 0) return { y: +m[3], m: mi + 1, d: +m[1] };
    }
    return null;
  }
  function formatDate(raw) {
    const p = parseDate(raw);
    if (!p || p.m < 1 || p.m > 12 || p.d < 1 || p.d > 31) return String(raw || '');
    return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  }

  function renderReceipts(list) {
    const tools = `
      <div class="receipt-tools no-print">
        <button type="button" class="btn btn-primary" data-pdf>Download PDF</button>
        <button type="button" class="btn btn-outline" data-print>Print</button>
        <button type="button" class="btn btn-outline" data-again>Find another receipt</button>
      </div>
      ${list.length > 1 ? `<p class="small muted no-print">${list.length} payments are recorded for this paper. Each has its own receipt below; the PDF contains all of them.</p>` : ''}`;

    out.innerHTML = tools + '<p class="loading no-print" data-wait>Preparing your receipt…</p>';
    out.querySelector('[data-again]').addEventListener('click', () => {
      out.innerHTML = helpHtml; form.reset(); form.paper_id.focus();
    });

    drawAll(list).then(canvases => {
      out.querySelector('[data-wait]')?.remove();
      const pages = canvases.map(c => c.toDataURL('image/jpeg', 0.92));
      pages.forEach((src, i) => {
        const fig = document.createElement('figure');
        fig.className = 'receipt-paper';
        fig.innerHTML = `<img src="${src}" alt="Payment receipt for Paper ID ${esc(list[i].paper_id)}, ${esc(list[i].name)}">`;
        out.appendChild(fig);
      });
      out.querySelector('[data-print]').addEventListener('click', () => window.print());
      out.querySelector('[data-pdf]').addEventListener('click', () => savePdf(pages, list[0]));
      document.title = `Fee receipt – Paper ${list[0].paper_id} | ICMLDE`;
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(err => {
      console.error(err);
      renderMessage('The receipt couldn’t be drawn. Reload the page and try again.', 'error', 'Something went wrong');
    });
  }

  /* ----- receipt paper: the original UPES receipt, with the details filled in ----- */
  const PAPER_SRC = '/img/receipt-paper.jpg';   // 1556 × 1442 px, body text blanked out
  const INK = '#111827';
  const MAROON = '#7a0a1a';
  const BODY_FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';
  let paperImg;

  function loadPaper() {
    if (paperImg) return paperImg;
    paperImg = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { paperImg = null; reject(new Error('receipt paper failed to load')); };
      img.src = PAPER_SRC;
    });
    return paperImg;
  }

  async function drawAll(list) {
    const img = await loadPaper();
    try {
      await Promise.all(['400 30px Inter', '600 30px Inter', '700 30px Inter'].map(f => document.fonts.load(f)));
    } catch { /* fall back to system fonts */ }
    return list.map(r => drawReceipt(img, r));
  }

  function drawReceipt(img, r) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.textBaseline = 'alphabetic';

    const paid = parseDate(r.date);
    const year = paid && EDITIONS[paid.y] ? paid.y : DEFAULT_YEAR;
    const ed = EDITIONS[year];

    // The paper is printed for ICMLDE 2025; for other years, replace the header lines
    if (year !== 2025) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(300, 195, 956, 185);
      const centre = (text, y, font, colour) => {
        ctx.font = font; ctx.fillStyle = colour;
        ctx.fillText(text, (c.width - ctx.measureText(text).width) / 2, y);
      };
      centre(`${ed.ordinal} International Conference on Machine Learning and Data Engineering`, 230, `700 26px ${BODY_FONT}`, MAROON);
      centre(ed.short, 286, `700 31px ${BODY_FONT}`, MAROON);
      centre(ed.datesLong, 326, '700 22px "Times New Roman", Times, serif', '#18171c');
      centre('Dehradun, India', 365, `600 24px ${BODY_FONT}`, MAROON);
    }

    const money = parseMoney(r.amount, r.currency);
    const amountText = money ? money.plain : (r.amount || '');
    const currencyWord = money && money.cur === 'USD' ? 'US Dollars' : 'Rupees';
    const name = String(r.name || '').replace(/\.+$/, '');
    const dateText = r.date ? formatDate(r.date) : '';

    const LEFT = 111, RIGHT = 1450, LINE = 73;
    let shift = 0;
    const para = (y, runs) => { shift += flow(ctx, runs, LEFT, RIGHT, y + shift, LINE) * LINE; };
    const R = (t) => ({ t, w: 400 }), B = (t) => ({ t, w: 600 });

    para(590, [R('Received With thanks from '), B(name || '—'), R('.')]);
    para(663, [R(`The sum of ${currencyWord}: `), B(amountText), R(' /- via NEFT/UPI no/ch.no: '), B(r.reference || '—'), R('  against')]);
    para(736, [R(`“${ed.short}” at UPES, Bidholi Campus, Dehradun for Registration of the Paper ID:`)]);
    para(782, [B(r.paper_id || '—'), R('.')]);
    if (dateText) para(883, [R('Dated: '), B(dateText)]);
    return c;
  }

  /** Draw text runs with word wrapping. Returns how many extra lines were used. */
  function flow(ctx, runs, left, right, y, lineHeight) {
    let x = left, extra = 0;
    ctx.fillStyle = INK;
    for (const run of runs) {
      ctx.font = `${run.w} 30px ${BODY_FONT}`;
      for (const part of run.t.split(/(\s+)/)) {
        if (!part) continue;
        const w = ctx.measureText(part).width;
        if (x + w > right && x > left && part.trim()) { x = left; y += lineHeight; extra++; }
        if (x === left && !part.trim()) continue;
        ctx.fillText(part, x, y);
        x += w;
      }
    }
    return extra;
  }

  function savePdf(pages, first) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { showToast('The PDF tool didn’t load. Use Print and choose “Save as PDF”.', 'error'); return; }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    pages.forEach((src, i) => {
      if (i) doc.addPage();
      doc.addImage(src, 'JPEG', 6, 6, 583.28, 540.55);   // same placement as the original receipt PDF
    });
    const id = String(first.paper_id || 'receipt').replace(/[^A-Za-z0-9-]+/g, '_');
    doc.save(`ICMLDE_Payment_Receipt_${id}.pdf`);
  }

  /* ----- amounts ----- */
  function parseMoney(raw, currencyCol) {
    if (!raw) return null;
    const s = String(raw);
    const num = Number(s.replace(/[^0-9.]/g, ''));
    if (!isFinite(num) || num <= 0) return null;
    let cur = String(currencyCol || '').trim().toUpperCase();
    if (!cur) cur = /\$|usd/i.test(s) ? 'USD' : 'INR';
    if (cur === '₹' || cur === 'RS' || cur === 'RS.' || cur === 'RUPEES') cur = 'INR';
    if (cur === '$' || cur === 'DOLLARS') cur = 'USD';

    if (cur === 'INR') {
      return {
        cur, plain: num.toFixed(2),
        display: '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        words: 'Rupees ' + toWordsIndian(num, 'Paise') + ' only'
      };
    }
    if (cur === 'USD') {
      return {
        cur, plain: num.toFixed(2),
        display: 'US$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        words: 'US Dollars ' + toWordsWestern(num, 'Cents') + ' only'
      };
    }
    return { cur, plain: num.toFixed(2), display: `${cur} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, words: `${cur} ${toWordsWestern(num, '')} only` };
  }

  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function below1000(n) {
    const h = Math.floor(n / 100), r = n % 100;
    const parts = [];
    if (h) parts.push(ONES[h] + ' Hundred');
    if (r) parts.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : ''));
    return parts.join(' ');
  }

  function withFraction(whole, fraction, unit, wordsFn) {
    let w = whole ? wordsFn(whole) : 'Zero';
    if (fraction && unit) w += ` and ${below1000(fraction)} ${unit}`;
    return w;
  }

  function toWordsIndian(amount, unit) {
    const whole = Math.floor(amount);
    const fraction = Math.round((amount - whole) * 100);
    return withFraction(whole, fraction, unit, n => {
      const crore = Math.floor(n / 1e7); n %= 1e7;
      const lakh = Math.floor(n / 1e5); n %= 1e5;
      const thousand = Math.floor(n / 1e3); n %= 1e3;
      return [
        crore && below1000(crore) + ' Crore',
        lakh && below1000(lakh) + ' Lakh',
        thousand && below1000(thousand) + ' Thousand',
        n && below1000(n)
      ].filter(Boolean).join(' ');
    });
  }

  function toWordsWestern(amount, unit) {
    const whole = Math.floor(amount);
    const fraction = Math.round((amount - whole) * 100);
    return withFraction(whole, fraction, unit, n => {
      const scales = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
      const parts = [];
      for (const [v, name] of scales) {
        if (n >= v) { parts.push(below1000(Math.floor(n / v)) + ' ' + name); n %= v; }
      }
      if (n) parts.push(below1000(n));
      return parts.join(' ');
    });
  }
})();
