/* ===================================================================
   ICMLDE 2026 - Production Registration Logic (Aligned with Official ICMLDE)
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initRegistrationLogic();
  loadBankDetails();
});

// Official ICMLDE Fee Structure
const PRICING_TABLE = {
  INR: {
    'Regular Author': 11500,
    'Students Author': 11000,
    'Industry Professional': 12500,
    '2nd Paper, Regular Author': 11000,
    'Listener / Non-Author': 5000,
    'Workshop (Non-Author)': 4000
  },
  USD: {
    'Regular Author': 350,
    'Students Author': 300,
    'Industry Professional': 350,
    '2nd Paper, Regular Author': 250,
    'Listener / Non-Author': 150,
    'Workshop (Non-Author)': 60
  }
};

let currentCurrency = 'INR';

async function loadBankDetails() {
  try {
    const res = await fetch('/api/conference-info');
    const data = await res.json();
    if (res.ok && data.success) {
      const b = data.data.bankDetails;
      const f = data.data.foreignWireDetails;
      const bankBox = document.getElementById('bankDetailsDisplay');
      if (bankBox) {
        bankBox.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; font-size: 0.9rem; line-height: 1.6;">
            <!-- Indian Authors NEFT Account -->
            <div style="background: rgba(15, 23, 42, 0.6); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3);">
              <h5 style="color: #38bdf8; margin-bottom: 0.5rem; font-size: 0.95rem;">🇮🇳 For Indian Authors & Delegates (NEFT / RTGS / IMPS):</h5>
              <p><strong>Name of Beneficiary:</strong> ${b.accountName}</p>
              <p><strong>Bank Name:</strong> ${b.bankName} &bull; <strong>Branch:</strong> ${b.branch}</p>
              <p><strong>Account No. of Beneficiary:</strong> <code style="color:var(--accent); font-size:1.1rem; font-weight:bold;">${b.accountNumber}</code></p>
              <p><strong>IFSC Code:</strong> <code>${b.ifsc}</code> &bull; <strong>Account Type:</strong> ${b.accountType}</p>
              <p><strong>Official UPI ID:</strong> <code style="color:#34d399;">${b.upiId}</code></p>
            </div>

            <!-- Foreign Authors Wire Transfer -->
            <div style="background: rgba(15, 23, 42, 0.6); padding: 1.25rem; border-radius: 8px; border: 1px solid rgba(14, 165, 233, 0.3);">
              <h5 style="color: #a5b4fc; margin-bottom: 0.5rem; font-size: 0.95rem;">🌐 For International Authors (Wire Transfer / SWIFT):</h5>
              <p><strong>Name of Beneficiary:</strong> ${f.beneficiary} &bull; <strong>Purpose:</strong> ${f.purpose}</p>
              <p><strong>Bank Name:</strong> ${f.bankName} &bull; <strong>Account No.:</strong> <code style="color:var(--accent);">${f.accountNumber}</code></p>
              <p><strong>Branch IFSC:</strong> <code>${f.ifsc}</code> &bull; <strong>SWIFT Code:</strong> <code>${f.swift}</code></p>
              <p><strong>Branch Address:</strong> ${f.address}</p>
            </div>
          </div>
        `;
      }
    }
  } catch (e) {
    console.error('Failed to load banking info', e);
  }
}

function initRegistrationLogic() {
  const form = document.getElementById('registrationForm');
  const currencyToggles = document.querySelectorAll('input[name="currency"]');
  const categorySelect = document.getElementById('regCategory');
  const amountDisplay = document.getElementById('computedAmountDisplay');
  const hiddenAmountInput = document.getElementById('hiddenAmountInput');

  // Check URL query parameters for prefilled Paper ID
  const urlParams = new URLSearchParams(window.location.search);
  const paperIdParam = urlParams.get('paperId');
  const paperIdInput = document.getElementById('regPaperId');
  if (paperIdParam && paperIdInput) {
    paperIdInput.value = paperIdParam;
  }

  function updatePrice() {
    if (!categorySelect || !amountDisplay) return;
    const category = categorySelect.value;
    const price = PRICING_TABLE[currentCurrency]?.[category] || 11500;
    const symbol = currentCurrency === 'INR' ? '₹' : '$';

    amountDisplay.textContent = `${symbol}${price.toLocaleString()}`;
    if (hiddenAmountInput) {
      hiddenAmountInput.value = `${currentCurrency} ${price.toLocaleString()}`;
    }
  }

  currencyToggles.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentCurrency = e.target.value;
      updatePrice();
    });
  });

  if (categorySelect) categorySelect.addEventListener('change', updatePrice);
  updatePrice();

  // Registration Form Submission (with FormData for payment proof upload)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('submitRegBtn');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>⏳ Processing Real-Time Registration & QR Pass...</span>`;

      const formData = new FormData(form);
      formData.set('amount', hiddenAmountInput.value);

      try {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          body: formData
        });

        const result = await res.json();

        if (res.ok && result.success) {
          form.reset();
          showRegistrationReceipt(result.data);
        } else {
          showToast(result.error || 'Registration failed.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Network error during registration.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

function showRegistrationReceipt(reg) {
  const modal = document.getElementById('regSuccessModal');
  const detailsEl = document.getElementById('modalRegDetails');

  if (!modal || !detailsEl) {
    alert(`Registration Confirmed! Reg ID: ${reg.reg_id}`);
    return;
  }

  detailsEl.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.25rem;">
      <div style="font-size: 2.2rem; margin-bottom: 0.25rem;">✅</div>
      <h3 style="color: #ffffff; margin-bottom: 0.25rem;">Registration Confirmed</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem;">Official Delegate Pass for ICMLDE 2026 (Dehradun)</p>
    </div>

    <div style="background: var(--bg-elevated); border: 2px solid var(--success); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Official Delegate Number</span>
          <h4 style="color: var(--accent); font-size: 1.3rem;">${reg.reg_id}</h4>
        </div>
        <span class="status-badge status-accepted">${reg.payment_status}</span>
      </div>

      <div style="font-size: 0.9rem; line-height: 1.6;">
        <p><strong>Name:</strong> ${reg.full_name}</p>
        <p><strong>Email:</strong> ${reg.email}</p>
        <p><strong>Affiliation:</strong> ${reg.affiliation} (${reg.country})</p>
        <p><strong>Category:</strong> ${reg.category} &bull; <span style="color:var(--secondary); font-weight:600;">${reg.mode}</span></p>
        ${reg.paper_id ? `<p><strong>Linked Paper:</strong> ${reg.paper_id}</p>` : ''}
        <p><strong>Amount:</strong> <strong style="color:#ffffff;">${reg.amount}</strong> (${reg.payment_method})</p>
        <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.35rem;"><strong>Txn / UTR Reference:</strong> ${reg.transaction_id}</p>
      </div>

      ${reg.qrCode ? `
        <div style="text-align: center; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
          <img src="${reg.qrCode}" alt="Pass QR Code" style="width: 140px; height: 140px; margin: 0 auto; border-radius: 8px; background:#fff; padding:6px;">
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">Verified QR Pass &bull; Present at the registration desk in Dehradun</p>
        </div>
      ` : ''}
    </div>

    <div style="display: flex; gap: 0.75rem; justify-content: center;">
      <button class="btn btn-outline" onclick="window.print()">🖨️ Print Delegate Pass</button>
      <button class="btn btn-primary" onclick="closeRegModal()">Done</button>
    </div>
  `;

  modal.classList.add('open');
}

window.closeRegModal = function() {
  const modal = document.getElementById('regSuccessModal');
  if (modal) modal.classList.remove('open');
};
