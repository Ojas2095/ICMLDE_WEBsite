/* ===================================================================
   ICMLDE 2026 — registration and payment
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initRegistration();
  loadBankDetails();
});

const PRICING_TABLE = {
  INR: {
    'Regular Author': 11500, 'Students Author': 11000, 'Industry Professional': 12500,
    '2nd Paper, Regular Author': 11000, 'Listener / Non-Author': 5000, 'Workshop (Non-Author)': 4000
  },
  USD: {
    'Regular Author': 350, 'Students Author': 300, 'Industry Professional': 350,
    '2nd Paper, Regular Author': 250, 'Listener / Non-Author': 150, 'Workshop (Non-Author)': 60
  }
};

let currentCurrency = 'INR';
const escR = (v) => window.escapeHtml(v);
const fmtMoney = (cur, n) => cur === 'INR' ? '₹' + n.toLocaleString('en-IN') : '$' + n.toLocaleString('en-US');

async function loadBankDetails() {
  const box = document.getElementById('bankDetailsDisplay');
  if (!box) return;
  try {
    const res = await fetch('/api/conference-info');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error();
    const b = data.data.bankDetails, f = data.data.foreignWireDetails;
    const row = (k, v, copy) => `<div><dt>${k}</dt><dd>${copy ? `<code>${escR(v)}</code><button type="button" class="copy-btn" data-copy="${escR(v)}">Copy</button>` : escR(v)}</dd></div>`;
    box.innerHTML = `
      <h3>Paying from India</h3>
      <p class="note">NEFT, RTGS, IMPS or UPI</p>
      <dl>
        ${row('Beneficiary', b.accountName)}
        ${row('Bank', `${b.bankName}, ${b.branch}`)}
        ${row('Account no.', b.accountNumber, true)}
        ${row('IFSC', b.ifsc, true)}
        ${row('UPI ID', b.upiId, true)}
      </dl>
      <h3 class="mt-2">Paying from outside India</h3>
      <p class="note">SWIFT wire. Purpose: ${escR(f.purpose)}</p>
      <dl>
        ${row('Beneficiary', f.beneficiary)}
        ${row('Bank', f.bankName)}
        ${row('Account no.', f.accountNumber, true)}
        ${row('SWIFT', f.swift, true)}
        ${row('Branch IFSC', f.ifsc)}
        ${row('Branch address', f.address)}
      </dl>`;
  } catch {
    box.innerHTML = '<p class="muted">Payment details couldn’t be loaded. They are also listed under <a href="/#fees">Registration fees</a> on the home page.</p>';
  }
}

function initRegistration() {
  const form = document.getElementById('registrationForm');
  const select = document.getElementById('regCategory');
  const amountEl = document.getElementById('computedAmountDisplay');
  const hidden = document.getElementById('hiddenAmountInput');

  const params = new URLSearchParams(location.search);
  const paperInput = document.getElementById('regPaperId');
  if (params.get('paperId') && paperInput) paperInput.value = params.get('paperId');
  if (params.get('cat') && select) select.value = params.get('cat');

  function update() {
    const price = PRICING_TABLE[currentCurrency][select.value] || PRICING_TABLE[currentCurrency]['Regular Author'];
    amountEl.textContent = fmtMoney(currentCurrency, price);
    hidden.value = `${currentCurrency} ${price.toLocaleString(currentCurrency === 'INR' ? 'en-IN' : 'en-US')}`;
    document.querySelectorAll('.tier .price[data-inr]').forEach(el => {
      el.textContent = fmtMoney(currentCurrency, Number(el.dataset[currentCurrency.toLowerCase()]));
    });
  }

  document.querySelectorAll('input[name="currency"]').forEach(r => r.addEventListener('change', e => { currentCurrency = e.target.value; update(); }));
  document.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    select.value = btn.dataset.pick; update();
    document.getElementById('form').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('r_name')?.focus({ preventScroll: true }), 400);
  }));
  if (select) { select.addEventListener('change', update); update(); }

  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitRegBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Registering…';
    const data = new FormData(form);
    data.set('amount', hidden.value);
    try {
      const res = await fetch('/api/registrations', { method: 'POST', body: data });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        form.reset(); update();
        showRegistrationReceipt(result.data);
      } else {
        showToast(result.error || 'Registration wasn’t completed. Check the form and try again.', 'error');
      }
    } catch {
      showToast('Couldn’t reach the server. Check your connection and try again.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}

function showRegistrationReceipt(reg) {
  const modal = document.getElementById('regSuccessModal');
  const el = document.getElementById('modalRegDetails');
  if (!modal || !el) { alert(`Registered. Your registration ID is ${reg.reg_id}`); return; }
  el.innerHTML = `
    <h2 id="regDoneTitle">You’re registered</h2>
    <p class="lead">Show this pass at the registration desk. Your fee receipt will be available once the finance team confirms your payment.</p>
    <div class="small muted">Registration ID</div>
    <div class="bigid">${escR(reg.reg_id)}</div>
    <dl class="facts mt-1">
      <div><dt>Name</dt><dd>${escR(reg.full_name)}</dd></div>
      <div><dt>Category</dt><dd>${escR(reg.category)}, ${escR(reg.mode)}</dd></div>
      ${reg.paper_id ? `<div><dt>Paper ID</dt><dd>${escR(reg.paper_id)}</dd></div>` : ''}
      <div><dt>Amount</dt><dd>${escR(reg.amount)} by ${escR(reg.payment_method)}</dd></div>
      <div><dt>UTR / reference</dt><dd>${escR(reg.transaction_id)}</dd></div>
    </dl>
    ${reg.qrCode ? `<img class="qr" src="${escR(reg.qrCode)}" alt="QR code for registration ${escR(reg.reg_id)}">` : ''}
    <div class="actions">
      <button type="button" class="btn btn-primary" onclick="window.print()">Print pass</button>
      ${reg.paper_id ? `<a class="btn btn-outline" href="/fee-receipt.html?paper=${encodeURIComponent(reg.paper_id)}">Fee receipt</a>` : ''}
      <button type="button" class="btn btn-outline" onclick="closeRegModal()">Done</button>
    </div>`;
  modal.setAttribute('aria-labelledby', 'regDoneTitle');
  modal.classList.add('open');
}
window.closeRegModal = () => document.getElementById('regSuccessModal')?.classList.remove('open');
