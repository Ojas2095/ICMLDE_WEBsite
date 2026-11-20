/* ===================================================================
   ICMLDE 2026 - Production Admin Dashboard Logic (JWT + Security)
   =================================================================== */

const ADMIN_TOKEN_KEY = 'icmlde_admin_jwt_token';
let currentSubmissions = [];

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initAdminLogin();
});

function checkAuth() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const loginSection = document.getElementById('adminLoginSection');
  const dashboardSection = document.getElementById('adminDashboardSection');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  if (token) {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    loadDashboardData();
  } else {
    if (loginSection) loginSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

function initAdminLogin() {
  const loginForm = document.getElementById('adminLoginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        showToast(`Welcome back, ${data.username}!`, 'success');
        checkAuth();
      } else {
        showToast(data.error || 'Invalid credentials.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to login server.', 'error');
    }
  });

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      showToast('Logged out of admin console.', 'info');
      checkAuth();
    });
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function loadDashboardData() {
  await Promise.all([
    loadStats(),
    loadSubmissions(),
    loadRegistrations(),
    loadInquiries()
  ]);
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
    if (res.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      checkAuth();
      return;
    }
    const data = await res.json();
    if (res.ok && data.success) {
      const s = data.data;
      document.getElementById('statTotalSubs').textContent = s.submissions.total;
      document.getElementById('statAcceptedSubs').textContent = s.submissions.accepted;
      document.getElementById('statReviewSubs').textContent = s.submissions.underReview;
      document.getElementById('statTotalRegs').textContent = s.registrations.total;
      const regBadge = document.getElementById('statTotalRegsBadge');
      if (regBadge) regBadge.textContent = s.registrations.total;
      const inqBadge = document.getElementById('statTotalInq');
      if (inqBadge) inqBadge.textContent = s.inquiries.total;
    }
  } catch (err) {
    console.error('Failed to load stats', err);
  }
}

async function loadSubmissions() {
  const tbody = document.getElementById('submissionsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/submissions', { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      currentSubmissions = data.data;
      renderSubmissions(currentSubmissions);
    }
  } catch (err) {
    console.error('Error loading submissions', err);
  }
}

function renderSubmissions(items) {
  const tbody = document.getElementById('submissionsTableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color:var(--text-muted);">No manuscript submissions currently recorded. Ready for live submissions.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(sub => {
    let badgeClass = 'status-review';
    if (sub.status === 'Accepted') badgeClass = 'status-accepted';
    if (sub.status === 'Revision Requested') badgeClass = 'status-revision';
    if (sub.status === 'Rejected') badgeClass = 'status-rejected';

    return `
      <tr>
        <td><strong>${sub.paper_id}</strong></td>
        <td>
          <div style="font-weight:600; color:#ffffff;">${sub.title}</div>
          <div style="font-size:0.8rem; color:var(--text-dim);">${sub.authors} &bull; ${sub.affiliation}</div>
          <div style="font-size:0.75rem; color:#818cf8;">📧 ${sub.corresponding_email}</div>
        </td>
        <td><span style="font-size:0.8rem;">${sub.track.split(':')[0]}</span></td>
        <td><span class="status-badge ${badgeClass}">${sub.status}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="downloadPaper(${sub.id}, '${sub.original_filename}')">
            ⬇️ Manuscript
          </button>
          ${sub.camera_ready_file ? `<span style="display:block; font-size:0.75rem; color:var(--success); margin-top:0.25rem;">✔ Camera-Ready</span>` : ''}
        </td>
        <td style="max-width: 220px; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${sub.reviewer_feedback || '<span style="color:var(--text-dim);">No remarks yet</span>'}
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openReviewModal(${sub.id})">
            Review / Update
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.downloadPaper = function(id) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  window.open(`/api/admin/submissions/${id}/download?authorization=${encodeURIComponent(token)}`, '_blank');
};

window.openReviewModal = function(id) {
  const sub = currentSubmissions.find(s => s.id === id);
  if (!sub) return;

  const modal = document.getElementById('reviewModal');
  document.getElementById('reviewSubId').value = sub.id;
  document.getElementById('reviewPaperId').textContent = sub.paper_id;
  document.getElementById('reviewPaperTitle').textContent = sub.title;
  document.getElementById('reviewStatusSelect').value = sub.status;
  document.getElementById('reviewFeedbackText').value = sub.reviewer_feedback || '';

  modal.classList.add('open');
};

window.closeReviewModal = function() {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.classList.remove('open');
};

const reviewForm = document.getElementById('reviewForm');
if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('reviewSubId').value;
    const status = document.getElementById('reviewStatusSelect').value;
    const reviewer_feedback = document.getElementById('reviewFeedbackText').value;
    const notify_author = document.getElementById('notifyAuthorCheckbox')?.checked ?? true;

    try {
      const res = await fetch(`/api/admin/submissions/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, reviewer_feedback, notify_author })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Paper status and review feedback updated!', 'success');
        closeReviewModal();
        loadDashboardData();
      } else {
        showToast(data.error || 'Failed to update paper.', 'error');
      }
    } catch (err) {
      showToast('Error updating paper status.', 'error');
    }
  });
}

// Registrations Tab
async function loadRegistrations() {
  const tbody = document.getElementById('registrationsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/registrations', { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      const regs = data.data;
      if (regs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">No delegates registered yet. Ready for live conference registrations.</td></tr>`;
        return;
      }

      tbody.innerHTML = regs.map(r => `
        <tr>
          <td><strong>${r.reg_id}</strong></td>
          <td>
            <div style="font-weight:600; color:#ffffff;">${r.full_name}</div>
            <div style="font-size:0.8rem; color:var(--text-dim);">${r.email} | ${r.phone || 'N/A'}</div>
          </td>
          <td>${r.affiliation} (${r.country})</td>
          <td>${r.category}</td>
          <td><span class="status-badge status-review">${r.mode}</span></td>
          <td>${r.paper_id ? `<strong>${r.paper_id}</strong>` : '—'}</td>
          <td>
            <div style="font-weight:bold; color:var(--success);">${r.amount}</div>
            <div style="font-size:0.75rem; color:var(--text-dim);">${r.payment_method}</div>
            <div style="font-size:0.75rem; color:var(--accent);">UTR: ${r.transaction_id || 'N/A'}</div>
          </td>
          <td><span class="status-badge status-accepted">${r.payment_status}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load registrations', err);
  }
}

// Inquiries Tab
async function loadInquiries() {
  const container = document.getElementById('inquiriesContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/inquiries', { headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok && data.success) {
      const inqs = data.data;
      if (inqs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No inquiries currently in inbox.</div>`;
        return;
      }

      container.innerHTML = inqs.map(item => `
        <div class="card" style="margin-bottom: 1rem; border-left: 4px solid ${item.status === 'Resolved' ? 'var(--success)' : 'var(--accent)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong style="color:#ffffff; font-size:1.05rem;">${item.subject}</strong>
              <div style="font-size:0.85rem; color:var(--text-dim);">From: ${item.name} &lt;${item.email}&gt; &bull; ${new Date(item.created_at).toLocaleString()}</div>
            </div>
            <div>
              ${item.status === 'Resolved' ? `
                <span class="status-badge status-accepted">Resolved</span>
              ` : `
                <button class="btn btn-outline btn-sm" onclick="markInquiryResolved(${item.id})">Mark Resolved</button>
              `}
            </div>
          </div>
          <p style="color:var(--text-muted); font-size:0.92rem; background:var(--bg-elevated); padding:0.85rem; border-radius:6px; margin-top:0.5rem;">
            ${item.message}
          </p>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load inquiries', err);
  }
}

window.markInquiryResolved = async function(id) {
  try {
    const res = await fetch(`/api/admin/inquiries/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: 'Resolved' })
    });
    if (res.ok) {
      showToast('Inquiry marked as resolved.', 'success');
      loadInquiries();
      loadStats();
    }
  } catch (err) {
    showToast('Failed to update inquiry status.', 'error');
  }
};

// Purge Demo Records for Live Production Launch
window.confirmClearDemoData = async function() {
  const confirmMsg = "Are you sure you want to clear all records? This prepares a 100% clean database for real live submissions and delegates.";
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/admin/clear-demo-data', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, 'success');
      loadDashboardData();
    } else {
      showToast(data.error || 'Failed to clear database.', 'error');
    }
  } catch (e) {
    showToast('Error resetting database.', 'error');
  }
};
