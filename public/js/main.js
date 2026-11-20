/* ===================================================================
   ICMLDE 2026 - Main Interactive Scripts
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initCountdown();
  initContactForm();
  initQuickTracker();
});

// Mobile Navigation Toggle
function initMobileNav() {
  const toggleBtn = document.getElementById('mobileNavToggle');
  const mobileNav = document.getElementById('mobileNav');
  
  if (toggleBtn && mobileNav) {
    toggleBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      const isOpen = mobileNav.classList.contains('open');
      toggleBtn.innerHTML = isOpen ? '✕' : '☰';
    });

    // Close when clicking any nav link
    mobileNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        toggleBtn.innerHTML = '☰';
      });
    });
  }
}

// Countdown Timer to Conference Date: November 27, 2026 09:00:00 IST
function initCountdown() {
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minsEl = document.getElementById('cd-mins');
  const secsEl = document.getElementById('cd-secs');

  if (!daysEl) return;

  const confDate = new Date('2026-11-27T09:00:00+05:30').getTime();

  function updateTimer() {
    const now = new Date().getTime();
    const distance = confDate - now;

    if (distance <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(minutes).padStart(2, '0');
    secsEl.textContent = String(seconds).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// Toast Notification Utility
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Contact Form Handler
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending Message...';

    const formData = {
      name: contactForm.querySelector('[name="name"]').value,
      email: contactForm.querySelector('[name="email"]').value,
      subject: contactForm.querySelector('[name="subject"]').value,
      message: contactForm.querySelector('[name="message"]').value
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        contactForm.reset();
      } else {
        showToast(data.error || 'Failed to submit inquiry.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error contacting server.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

// Quick Paper Tracker on Homepage
function initQuickTracker() {
  const form = document.getElementById('quickTrackForm');
  const resultBox = document.getElementById('quickTrackResult');
  if (!form || !resultBox) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paperId = form.querySelector('[name="paperId"]').value.trim();
    const email = form.querySelector('[name="authorEmail"]').value.trim();

    if (!paperId) {
      showToast('Please enter your Paper ID', 'error');
      return;
    }

    resultBox.innerHTML = '<div style="text-align:center; padding: 1rem;">Searching database...</div>';
    resultBox.style.display = 'block';

    try {
      let url = `/api/submissions/track?paper_id=${encodeURIComponent(paperId)}`;
      if (email) url += `&email=${encodeURIComponent(email)}`;

      const res = await fetch(url);
      const resData = await res.json();

      if (res.ok && resData.success) {
        const item = resData.data;
        let badgeClass = 'status-review';
        if (item.status === 'Accepted') badgeClass = 'status-accepted';
        if (item.status === 'Revision Requested') badgeClass = 'status-revision';
        if (item.status === 'Rejected') badgeClass = 'status-rejected';

        resultBox.innerHTML = `
          <div class="status-result">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
              <strong style="color:#ffffff; font-size:1.05rem;">${item.paper_id}</strong>
              <span class="status-badge ${badgeClass}">${item.status}</span>
            </div>
            <h4 style="color:#e2e8f0; font-size:1rem; margin-bottom: 0.4rem;">${item.title}</h4>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 0.5rem;">
              <strong>Authors:</strong> ${item.authors} (${item.affiliation})
            </p>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 0.5rem;">
              <strong>Track:</strong> ${item.track}
            </p>
            ${item.reviewer_feedback ? `
              <div style="margin-top:0.75rem; padding:0.6rem; background:rgba(0,0,0,0.3); border-radius:6px; font-size:0.85rem; border-left: 3px solid var(--accent);">
                <strong style="color:var(--accent);">Reviewer Note:</strong> ${item.reviewer_feedback}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        resultBox.innerHTML = `
          <div class="status-result" style="border-left-color: var(--danger);">
            <p style="color:#f87171; font-weight:600;">Paper Not Found</p>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
              ${resData.error || 'No matching record found. Please verify your Paper ID.'}
            </p>
          </div>
        `;
      }
    } catch (err) {
      resultBox.innerHTML = `<p style="color:#f87171;">Failed to connect to backend server.</p>`;
    }
  });
}
