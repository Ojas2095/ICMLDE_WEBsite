/* ===================================================================
   ICMLDE 2026 — paper submission form and review-status tracker
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initSubmissionForm();
  initTracker();
});

const esc = (v) => window.escapeHtml(v);

/* ---------- Submission form (submission-form.html) ---------- */
function initSubmissionForm() {
  const form = document.getElementById('standaloneSubmissionForm');
  if (!form) return;

  const dropzone = document.getElementById('dropzoneStandalone');
  const fileInput = document.getElementById('paperFileStandalone');
  const fileDisplay = document.getElementById('fileDisplayStandalone');
  const abstract = document.getElementById('abstractInput');
  const count = document.getElementById('abstractCount');

  if (abstract && count) {
    abstract.addEventListener('input', () => {
      const words = abstract.value.trim().split(/\s+/).filter(Boolean).length;
      count.textContent = `${words} words${words && (words < 200 || words > 350) ? ' (aim for 200–350)' : ''}`;
      count.style.color = words >= 200 && words <= 350 ? 'var(--ok)' : '';
    });
  }

  const showFile = (file) => {
    const mb = (file.size / 1048576).toFixed(2);
    fileDisplay.innerHTML = `<div class="file-chosen"><span>${esc(file.name)} (${mb} MB)</span><span class="ok">Ready to upload</span></div>`;
  };

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => { if (e.target !== fileInput) fileInput.click(); });
    dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
    dropzone.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; showFile(e.dataTransfer.files[0]); }
    });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) showFile(fileInput.files[0]); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files || !fileInput.files.length) {
      showToast('Attach your manuscript (PDF or DOCX) before submitting.', 'error');
      dropzone.focus();
      return;
    }
    const btn = document.getElementById('submitStandaloneBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Uploading your paper…';

    const data = new FormData(form);
    const co = (data.get('coauthors') || '').trim();
    if (co) data.set('authors', `${data.get('authors')}, ${co}`);

    try {
      const res = await fetch('/api/submissions', { method: 'POST', body: data });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        form.reset();
        fileDisplay.innerHTML = '';
        if (count) count.textContent = '0 words';
        showSubmissionModal(result.data);
      } else {
        showToast(result.error || 'Your paper wasn’t submitted. Check the form and try again.', 'error');
      }
    } catch {
      showToast('The upload didn’t reach the server. Check your connection and try again.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}

function showSubmissionModal(item) {
  const modal = document.getElementById('standaloneSuccessModal');
  const content = document.getElementById('modalStandaloneContent');
  if (!modal || !content) { alert(`Submitted. Your Paper ID is ${item.paper_id}`); return; }
  content.innerHTML = `
    <h2 id="submittedTitle">Paper submitted</h2>
    <p class="lead">Your paper is now in double-blind review. Save your Paper ID; you’ll need it to check the decision, register and get your fee receipt.</p>
    <div class="small muted">Paper ID</div>
    <div class="bigid">${esc(item.paper_id)}</div>
    <dl class="facts mt-1">
      <div><dt>Title</dt><dd>${esc(item.title)}</dd></div>
      <div><dt>Authors</dt><dd>${esc(item.authors)}</dd></div>
      <div><dt>Track</dt><dd>${esc(item.track)}</dd></div>
      <div><dt>Status</dt><dd>${esc(item.status)}</dd></div>
    </dl>
    <div class="actions">
      <a href="/papers.html?paperId=${encodeURIComponent(item.paper_id)}#tracker" class="btn btn-primary">Check review status</a>
      <button type="button" class="btn btn-outline" onclick="window.print()">Print</button>
      <button type="button" class="btn btn-outline" data-close>Done</button>
    </div>`;
  modal.setAttribute('aria-labelledby', 'submittedTitle');
  modal.classList.add('open');
  content.querySelector('[data-close]').addEventListener('click', () => modal.classList.remove('open'));
  content.querySelector('.btn-primary').focus();
}
window.closeStandaloneModal = () => document.getElementById('standaloneSuccessModal')?.classList.remove('open');

/* ---------- Review-status tracker (papers.html) ---------- */
function initTracker() {
  const form = document.getElementById('trackForm');
  const idInput = document.getElementById('trackPaperId');
  const emailInput = document.getElementById('trackAuthorEmail');
  const out = document.getElementById('trackerDetailedResult');
  if (!form || !idInput || !out) return;

  const pre = new URLSearchParams(location.search).get('paperId');
  if (pre) idInput.value = pre;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paperId = idInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    if (!paperId) { showToast('Enter your Paper ID, e.g. ICMLDE-2026-1042.', 'error'); idInput.focus(); return; }

    out.innerHTML = '<p class="loading">Looking up your paper…</p>';
    try {
      let url = `/api/submissions/track?paper_id=${encodeURIComponent(paperId)}`;
      if (email) url += `&email=${encodeURIComponent(email)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const p = data.data;
        const badge = { 'Accepted': 'status-accepted', 'Revision Requested': 'status-revision', 'Rejected': 'status-rejected' }[p.status] || 'status-review';
        out.innerHTML = `
          <div class="result-card">
            <div class="top"><span class="id">${esc(p.paper_id)}</span><span class="status-badge ${badge}">${esc(p.status)}</span></div>
            <h4>${esc(p.title)}</h4>
            <p>${esc(p.authors)}${p.affiliation ? `, ${esc(p.affiliation)}` : ''}</p>
            <p>${esc(p.track)}${p.submitted_at ? `. Submitted ${esc(new Date(p.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}</p>
            <div class="feedback"><b>Reviewer comments</b>${p.reviewer_feedback ? esc(p.reviewer_feedback) : 'Your paper is with the reviewers. Comments will appear here once the review is complete.'}</div>
            ${p.status === 'Accepted' ? `
              <div class="actions">
                <a href="/register.html?paperId=${encodeURIComponent(p.paper_id)}" class="btn btn-primary btn-sm">Register for this paper</a>
                <a href="/fee-receipt.html?paper=${encodeURIComponent(p.paper_id)}" class="btn btn-outline btn-sm">Get fee receipt</a>
              </div>` : ''}
          </div>`;
      } else {
        out.innerHTML = `
          <div class="result-card error">
            <p class="err-title">No paper found</p>
            <p>${esc(data.error || 'Check the Paper ID, and that the email is the corresponding author’s.')}</p>
          </div>`;
      }
    } catch {
      out.innerHTML = '<div class="result-card error"><p class="err-title">Connection problem</p><p>The server couldn’t be reached. Try again in a moment.</p></div>';
    }
  });
}
