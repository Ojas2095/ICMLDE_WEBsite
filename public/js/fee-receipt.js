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

  function renderReceipts(list) {
    const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const tools = `
      <div class="receipt-tools no-print">
        <button type="button" class="btn btn-primary" data-print>Print or save as PDF</button>
        <button type="button" class="btn btn-outline" data-again>Find another receipt</button>
      </div>
      ${list.length > 1 ? `<p class="small muted no-print">${list.length} payments are recorded for this paper. Each has its own receipt below.</p>` : ''}`;

    out.innerHTML = tools + list.map(r => receiptHtml(r, generated)).join('');
    out.querySelector('[data-print]').addEventListener('click', () => window.print());
    out.querySelector('[data-again]').addEventListener('click', () => {
      out.innerHTML = helpHtml; form.reset(); form.paper_id.focus();
    });
    document.title = `Fee receipt ${list[0].paper_id ? '– Paper ' + list[0].paper_id : ''} | ICMLDE 2026`;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function receiptHtml(r, generated) {
    const money = parseMoney(r.amount, r.currency);
    const rows = [
      ['Paper ID', r.paper_id],
      ['Paper title', r.paper_title],
      ['Registration category', r.category],
      ['Affiliation', r.affiliation],
      ['Registered email', r.email],
      ['Payment mode', r.mode],
      ['Transaction / UTR no.', r.reference],
      ['Date of payment', r.date],
      ...(r.extra || []).filter(x => !/status/i.test(x.label)).map(x => [x.label, x.value])
    ].filter(([, v]) => v);

    const parts = [];
    parts.push(`Received with thanks from <b>${esc(r.name || 'the author')}</b>`);
    if (money) parts.push(` the sum of <b>${esc(money.display)}</b>`);
    if (r.mode) parts.push(` via ${esc(r.mode)}`);
    if (r.reference) parts.push(`, reference no. <b>${esc(r.reference)}</b>,`);
    parts.push(` towards registration at <b>ICMLDE 2026</b>, School of Computer Science, UPES, Bidholi Campus, Dehradun`);
    if (r.paper_id) parts.push(`, for Paper ID <b>${esc(r.paper_id)}</b>`);
    parts.push('.');

    return `
      <article class="receipt" aria-label="Payment receipt">
        <header class="receipt-head">
          <div class="org">School of Computer Science, UPES, Dehradun</div>
          <div class="conf">5th International Conference on Machine Learning and Data Engineering (ICMLDE 2026)</div>
          <div class="meta">27–28 November 2026, Dehradun, India</div>
        </header>

        <div class="receipt-title">
          <h2>PAYMENT RECEIPT</h2>
          <div class="no">${r.receipt_no ? `Receipt no. <b>${esc(r.receipt_no)}</b>` : ''}${r.receipt_no && r.date ? '<br>' : ''}${r.date ? `Dated <b>${esc(r.date)}</b>` : ''}</div>
        </div>

        <div class="receipt-body"><p>${parts.join('')}</p></div>

        ${money ? `
        <div class="receipt-amount">
          <span class="fig">${esc(money.display)}</span>
          <span class="words">${esc(money.words)}</span>
        </div>` : ''}

        <table class="receipt-table">
          <tbody>
            ${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
          </tbody>
        </table>

        <footer class="receipt-foot">
          <div>Computer-generated from the ICMLDE 2026 payment records on ${esc(generated)}.<br>
          Look it up again at ${esc(location.host || 'icmlde-website.vercel.app')}/fee-receipt.html</div>
          <div class="issuer">ICMLDE 2026 Secretariat<span>School of Computer Science, UPES</span></div>
        </footer>
      </article>`;
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
        display: '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        words: 'Rupees ' + toWordsIndian(num, 'Paise') + ' only'
      };
    }
    if (cur === 'USD') {
      return {
        display: 'US$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        words: 'US Dollars ' + toWordsWestern(num, 'Cents') + ' only'
      };
    }
    return { display: `${cur} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, words: `${cur} ${toWordsWestern(num, '')} only` };
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
