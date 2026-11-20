/* ===================================================================
   ICMLDE 2026 - Paper Submission & Author Tracking
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initSubmissionForm();
  initPaperTrackingPage();
});

function initSubmissionForm() {
  const form = document.getElementById('paperSubmissionForm');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('paperFile');
  const fileSelectedDisplay = document.getElementById('fileSelectedDisplay');

  if (!form) return;

  // Drag and drop handlers
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        fileInput.files = files;
        updateFileDisplay(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        updateFileDisplay(fileInput.files[0]);
      }
    });
  }

  function updateFileDisplay(file) {
    if (!fileSelectedDisplay) return;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    fileSelectedDisplay.innerHTML = `
      <div style="margin-top: 0.75rem; padding: 0.75rem 1rem; background: var(--bg-elevated); border: 1px solid var(--primary-light); border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.9rem; color: #ffffff;">📄 <strong>${file.name}</strong> (${sizeMb} MB)</span>
        <span style="color: var(--success); font-size: 0.85rem; font-weight: 600;">Ready for upload</span>
      </div>
    `;
  }

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!fileInput.files || fileInput.files.length === 0) {
      showToast('Please attach your research paper PDF or DOCX file.', 'error');
      return;
    }

    const submitBtn = document.getElementById('submitPaperBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Uploading Manuscript & Registering...</span>`;

    const formData = new FormData(form);

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (res.ok && result.success) {
        form.reset();
        if (fileSelectedDisplay) fileSelectedDisplay.innerHTML = '';
        showSuccessModal(result.data);
      } else {
        showToast(result.error || 'Failed to submit paper.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error uploading paper. Please check connection.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function showSuccessModal(data) {
  const modal = document.getElementById('submissionSuccessModal');
  const detailsEl = document.getElementById('modalSubmissionDetails');
  if (!modal || !detailsEl) {
    alert(`Success! Your Paper ID is: ${data.paper_id}`);
    return;
  }

  detailsEl.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
      <h3 style="color: #ffffff; margin-bottom: 0.25rem;">Paper Submitted Successfully!</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem;">Your manuscript has entered the double-blind peer review process.</p>
    </div>

    <div style="background: var(--bg-elevated); border: 1px dashed var(--primary-light); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
        <span style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase;">Unique Paper ID:</span>
        <strong style="font-size: 1.3rem; color: var(--accent); letter-spacing: 0.05em;">${data.paper_id}</strong>
      </div>
      <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; font-size: 0.9rem;">
        <p style="margin-bottom: 0.35rem; color: #ffffff;"><strong>Title:</strong> ${data.title}</p>
        <p style="margin-bottom: 0.35rem; color: var(--text-muted);"><strong>Authors:</strong> ${data.authors}</p>
        <p style="margin-bottom: 0.35rem; color: var(--text-muted);"><strong>Track:</strong> ${data.track}</p>
        <p style="color: var(--secondary); font-weight: 600;"><strong>Status:</strong> ${data.status}</p>
      </div>
    </div>

    <div style="display: flex; gap: 0.75rem; justify-content: center;">
      <button class="btn btn-outline" onclick="window.print()">🖨️ Print Receipt</button>
      <button class="btn btn-primary" onclick="closeSubmissionModal()">Done</button>
    </div>
  `;

  modal.classList.add('open');
}

window.closeSubmissionModal = function() {
  const modal = document.getElementById('submissionSuccessModal');
  if (modal) modal.classList.remove('open');
};

// Paper Status Tracking Page
function initPaperTrackingPage() {
  const trackBtn = document.getElementById('trackPaperSearchBtn');
  const paperIdInput = document.getElementById('trackPaperId');
  const authorEmailInput = document.getElementById('trackAuthorEmail');
  const resultContainer = document.getElementById('trackerDetailedResult');

  if (!trackBtn || !paperIdInput || !resultContainer) return;

  trackBtn.addEventListener('click', async () => {
    const paperId = paperIdInput.value.trim();
    const email = authorEmailInput ? authorEmailInput.value.trim() : '';

    if (!paperId) {
      showToast('Please enter your Paper ID (e.g., ICMLDE-2026-1042)', 'error');
      return;
    }

    resultContainer.innerHTML = '<div style="text-align:center; padding: 2rem;">Querying conference database...</div>';

    try {
      let queryUrl = `/api/submissions/track?paper_id=${encodeURIComponent(paperId)}`;
      if (email) queryUrl += `&email=${encodeURIComponent(email)}`;

      const res = await fetch(queryUrl);
      const data = await res.json();

      if (res.ok && data.success) {
        const item = data.data;
        let badgeStyle = 'background: rgba(245, 158, 11, 0.2); color: #fbbf24;';
        if (item.status === 'Accepted') {
          badgeStyle = 'background: rgba(16, 185, 129, 0.2); color: #34d399;';
        } else if (item.status === 'Rejected') {
          badgeStyle = 'background: rgba(239, 68, 68, 0.2); color: #f87171;';
        }

        resultContainer.innerHTML = `
          <div class="card" style="border-left: 5px solid var(--primary); padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;">Paper ID</span>
                <h3 style="color: #ffffff; margin-top: 0.2rem;">${item.paper_id}</h3>
              </div>
              <span style="padding: 0.4rem 1rem; border-radius: 9999px; font-weight: 700; font-size: 0.85rem; ${badgeStyle}">
                ${item.status}
              </span>
            </div>

            <div style="margin-bottom: 1.25rem;">
              <h4 style="color: #e2e8f0; font-size: 1.2rem; margin-bottom: 0.5rem;">${item.title}</h4>
              <p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Authors:</strong> ${item.authors}</p>
              <p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Affiliation:</strong> ${item.affiliation}</p>
              <p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Track:</strong> ${item.track}</p>
              <p style="color: var(--text-dim); font-size: 0.85rem; margin-top: 0.5rem;">Submitted on: ${new Date(item.submitted_at).toLocaleDateString()}</p>
            </div>

            <div style="background: var(--bg-elevated); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-color);">
              <h5 style="color: var(--accent); margin-bottom: 0.5rem; font-size: 0.95rem;">Editorial & Review Feedback</h5>
              <p style="color: #e2e8f0; font-size: 0.9rem; line-height: 1.6;">
                ${item.reviewer_feedback || 'Your paper is currently assigned to Technical Program Committee reviewers. Peer reviews are pending.'}
              </p>
            </div>

            ${item.status === 'Accepted' ? `
              <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; text-align: center;">
                <p style="color: #34d399; font-weight: 600; margin-bottom: 0.5rem;">🎉 Congratulations! Your paper is accepted for Elsevier publication & presentation.</p>
                <a href="/register.html?paperId=${encodeURIComponent(item.paper_id)}" class="btn btn-primary btn-sm">Proceed to Author Registration →</a>
              </div>
            ` : ''}
          </div>
        `;
      } else {
        resultContainer.innerHTML = `
          <div class="card" style="text-align: center; border-color: rgba(239, 68, 68, 0.3); padding: 2.5rem;">
            <p style="color: #f87171; font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">No Record Found</p>
            <p style="color: var(--text-muted); font-size: 0.9rem;">${data.error || 'Please double check your Paper ID and corresponding author email address.'}</p>
          </div>
        `;
      }
    } catch (err) {
      resultContainer.innerHTML = '<p style="color: #f87171; text-align:center;">Failed to connect to conference server.</p>';
    }
  });
}
