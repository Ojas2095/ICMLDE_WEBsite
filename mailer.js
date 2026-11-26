const nodemailer = require('nodemailer');
require('dotenv').config();
const SITE_URL = (process.env.SITE_URL || 'https://icmlde-website.vercel.app').replace(/\/$/, '');

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const DEFAULT_FROM = process.env.SMTP_FROM || '"ICMLDE 2026 Secretariat" <secretariat@icmlde2026.org>';

module.exports = {
  isConfigured() {
    return transporter !== null;
  },

  async sendSubmissionConfirmation(toEmail, paper) {
    const subject = `[ICMLDE 2026] Manuscript Submission Acknowledgment - ${paper.paper_id}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: #1e1b4b; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">5th International Conference on Machine Learning and Data Engineering</h2>
          <p style="margin: 6px 0 0; font-size: 14px; color: #cbd5e1;">27–28 November 2026 &bull; Dehradun, India &bull; Procedia Computer Science, Elsevier</p>
        </div>
        
        <div style="padding: 24px; border: 1px solid #e2e8f0; background: #ffffff;">
          <h3 style="color: #0f172a; margin-top: 0;">Submission Acknowledgment</h3>
          <p>Dear <strong>${paper.authors}</strong>,</p>
          <p>Thank you for submitting your research manuscript to <strong>ICMLDE 2026</strong>. Your submission has been securely cataloged and assigned for double-blind peer review.</p>
          
          <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px;"><strong>Paper ID:</strong> <span style="font-size: 18px; color: #4f46e5; font-weight: bold;">${paper.paper_id}</span></p>
            <p style="margin: 0 0 8px;"><strong>Title:</strong> ${paper.title}</p>
            <p style="margin: 0 0 8px;"><strong>Track:</strong> ${paper.track}</p>
            <p style="margin: 0 0 8px;"><strong>Affiliation:</strong> ${paper.affiliation}</p>
            <p style="margin: 0;"><strong>Submission Date:</strong> ${paper.created_at || new Date().toISOString()}</p>
          </div>

          <p>You can monitor the live peer-review progress and editorial decisions using our online portal:</p>
          <p><a href="${SITE_URL}/papers.html#tracker" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Check Paper Status Online</a></p>

          <p style="font-size: 13px; color: #64748b; margin-top: 30px;">Important: Please quote your unique Paper ID (<strong>${paper.paper_id}</strong>) in all future correspondence with the Technical Program Committee.</p>
        </div>

        <div style="text-align: center; padding: 16px; font-size: 12px; color: #94a3b8;">
          ICMLDE 2026 Organising Secretariat &bull; School of Computer Science, UPES, Bidholi Via–Prem Nagar, Dehradun 248007, India
        </div>
      </div>
    `;

    if (!transporter) {
      console.log(`[SMTP Not Configured] Mock dispatched submission email to ${toEmail} for ${paper.paper_id}`);
      return { sent: false, mock: true };
    }

    try {
      await transporter.sendMail({ from: DEFAULT_FROM, to: toEmail, subject, html });
      return { sent: true };
    } catch (err) {
      console.error('Failed to send submission email:', err.message);
      return { sent: false, error: err.message };
    }
  },

  async sendReviewDecision(toEmail, paper, status, feedback) {
    const isAccepted = status === 'Accepted';
    const subject = `[ICMLDE 2026] Editorial Decision Notification - ${paper.paper_id}: ${status}`;
    const statusColor = isAccepted ? '#10b981' : '#f59e0b';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: #1e1b4b; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">ICMLDE 2026 Editorial Board</h2>
          <p style="margin: 6px 0 0; font-size: 14px; color: #cbd5e1;">Elsevier Procedia Computer Science (Scopus Indexed)</p>
        </div>

        <div style="padding: 24px; border: 1px solid #e2e8f0; background: #ffffff;">
          <p>Dear <strong>${paper.authors}</strong>,</p>
          <p>The Technical Program Committee has concluded the peer review process for your manuscript submitted to <strong>ICMLDE 2026</strong>.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 6px;"><strong>Paper ID:</strong> ${paper.paper_id}</p>
            <p style="margin: 0 0 6px;"><strong>Title:</strong> ${paper.title}</p>
            <p style="margin: 0 0 6px;"><strong>Decision Status:</strong> <span style="font-weight: bold; color: ${statusColor};">${status}</span></p>
          </div>

          <h4 style="color: #0f172a; margin-bottom: 8px;">Reviewer Evaluation & Comments:</h4>
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; font-size: 14px; color: #78350f; margin-bottom: 20px;">
            ${feedback || 'No additional comments provided by editorial chair.'}
          </div>

          ${isAccepted ? `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #065f46; margin: 0 0 8px;">Next Steps for Publication:</h4>
              <ol style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px;">
                <li>Complete author registration by the regular registration deadline, 15 November 2026.</li>
                <li>Prepare and submit your Camera-Ready manuscript formatted strictly according to the Elsevier Procedia template.</li>
                <li>Submit the signed Elsevier Copyright Transfer Form.</li>
              </ol>
              <div style="margin-top: 14px;">
                <a href="${SITE_URL}/register.html?paperId=${encodeURIComponent(paper.paper_id)}" style="background: #10b981; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Proceed to Author Registration &rarr;</a>
              </div>
            </div>
          ` : ''}

          <p style="font-size: 13px; color: #64748b;">Sincerely,<br><strong>Technical Program Committee Chairs</strong><br>ICMLDE 2026</p>
        </div>
      </div>
    `;

    if (!transporter) {
      console.log(`[SMTP Not Configured] Mock dispatched review decision email to ${toEmail} for ${paper.paper_id} (${status})`);
      return { sent: false, mock: true };
    }

    try {
      await transporter.sendMail({ from: DEFAULT_FROM, to: toEmail, subject, html });
      return { sent: true };
    } catch (err) {
      console.error('Failed to send decision email:', err.message);
      return { sent: false, error: err.message };
    }
  },

  async sendRegistrationInvoice(toEmail, reg, qrDataUrl) {
    const subject = `[ICMLDE 2026] Official Registration Confirmation & Delegate Pass - ${reg.reg_id}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
        <div style="background: #1e1b4b; padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">ICMLDE 2026 Official Delegate Pass</h2>
          <p style="margin: 6px 0 0; font-size: 14px; color: #cbd5e1;">27–28 November 2026 &bull; Dehradun, India</p>
        </div>

        <div style="padding: 24px; border: 1px solid #e2e8f0; background: #ffffff;">
          <p>Dear <strong>${reg.full_name}</strong>,</p>
          <p>We are delighted to confirm your registration for the <strong>5th International Conference on Machine Learning and Data Engineering (ICMLDE 2026)</strong>.</p>
          
          <div style="border: 2px dashed #4f46e5; border-radius: 12px; padding: 20px; margin: 20px 0; background: #faf5ff;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e9d5ff; padding-bottom: 12px; margin-bottom: 12px;">
              <div>
                <span style="font-size: 12px; color: #6b21a8; text-transform: uppercase; font-weight: bold;">Confirmed Registration ID</span>
                <div style="font-size: 22px; font-weight: bold; color: #4f46e5;">${reg.reg_id}</div>
              </div>
              <span style="background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 13px;">${reg.payment_status}</span>
            </div>

            <p style="margin: 4px 0;"><strong>Delegate:</strong> ${reg.full_name}</p>
            <p style="margin: 4px 0;"><strong>Affiliation:</strong> ${reg.affiliation} (${reg.country})</p>
            <p style="margin: 4px 0;"><strong>Category:</strong> ${reg.category} &bull; <span style="color:#4f46e5;">${reg.mode}</span></p>
            ${reg.paper_id ? `<p style="margin: 4px 0;"><strong>Linked Paper:</strong> ${reg.paper_id}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> <strong>${reg.amount}</strong></p>
            <p style="margin: 4px 0; font-size: 12px; color: #64748b;"><strong>Transaction ID:</strong> ${reg.transaction_id}</p>

            ${qrDataUrl ? `
              <div style="text-align: center; margin-top: 16px;">
                <img src="${qrDataUrl}" alt="Conference Entry QR" style="width: 140px; height: 140px; display: inline-block;">
                <div style="font-size: 11px; color: #64748b;">Present this QR badge at the registration desk in Dehradun</div>
              </div>
            ` : ''}
          </div>

          <p style="font-size: 14px;"><strong>Conference Venue:</strong><br>School of Computer Science, UPES, Bidholi Via–Prem Nagar, Dehradun 248007, India</p>
        </div>
      </div>
    `;

    if (!transporter) {
      console.log(`[SMTP Not Configured] Mock dispatched registration email to ${toEmail} for ${reg.reg_id}`);
      return { sent: false, mock: true };
    }

    try {
      await transporter.sendMail({ from: DEFAULT_FROM, to: toEmail, subject, html });
      return { sent: true };
    } catch (err) {
      console.error('Failed to send registration email:', err.message);
      return { sent: false, error: err.message };
    }
  }
};
