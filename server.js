const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
require('dotenv').config();

const db = require('./database');
const mailer = require('./mailer');
const feeReceipts = require('./feeReceipts');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'icmlde_super_secret_jwt_salt_2026';

// Upload directories
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const baseUpload = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
const papersDir = path.join(baseUpload, 'papers');
const proofsDir = path.join(baseUpload, 'proofs');
const cameraReadyDir = path.join(baseUpload, 'camera_ready');

[papersDir, proofsDir, cameraReadyDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer Storage Configuration
const createStorage = (destFolder) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, destFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${unique}-${sanitized}`);
  }
});

const paperUpload = multer({
  storage: createStorage(papersDir),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and DOC/DOCX manuscript files are permitted.'));
  }
});

const proofUpload = multer({
  storage: createStorage(proofsDir),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JPG, or PNG payment receipts are accepted.'));
  }
});

const cameraReadyUpload = multer({
  storage: createStorage(cameraReadyDir),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF or ZIP camera-ready source files are allowed.'));
  }
});

// Production Security & Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { error: 'Too many requests from this IP address. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Submission rate limit reached for this IP. Please try again in an hour.' }
});

const receiptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RECEIPT_LOOKUPS_PER_15_MIN || 40),
  message: { error: 'Too many receipt lookups from this connection. Try again in 15 minutes.' }
});

// Vercel / Render sit behind a proxy: use the real client IP for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(globalLimiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT Admin Verification Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid token.' });
  }
}

// ==========================================
// PUBLIC PRODUCTION ENDPOINTS
// ==========================================

// 1. Conference & Official Banking Info
app.get('/api/conference-info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.CONFERENCE_NAME || '5th International Conference on Machine Learning and Data Engineering (ICMLDE 2026)',
      dates: process.env.CONFERENCE_DATES || '27–28 November 2026',
      venue: process.env.CONFERENCE_VENUE || 'School of Computer Science, UPES, Bidholi Via–Prem Nagar, Dehradun 248007, India',
      email: process.env.CONFERENCE_EMAIL || 'info@icmlde.org',
      // Indian authors pay through the official Paytm link on the ICMLDE registration form
      // (icmlde.org does not publish a bank account for Indian payments).
      indianPayment: {
        method: 'Online payment (Paytm) via the official ICMLDE registration form',
        registrationFormUrl: process.env.OFFICIAL_REGISTRATION_URL || 'https://icmlde.org/icmlde_registration5.html'
      },
      foreignWireDetails: {
        beneficiary: process.env.FOREIGN_BENEFICIARY || 'UPES',
        purpose: process.env.FOREIGN_PURPOSE || 'ICMLDE CONFERENCE',
        bankName: process.env.FOREIGN_BANK_NAME || 'YES Bank',
        accountNumber: process.env.FOREIGN_ACCOUNT_NUMBER || '011594600000224',
        ifsc: process.env.FOREIGN_BRANCH_IFSC || 'YESB0000115',
        swift: process.env.FOREIGN_SWIFT || 'YESBINBB',
        address: process.env.FOREIGN_BRANCH_ADDRESS || 'Ground Floor, 56, Rajpur Road, Dehradun, Uttarakhand, India - 248001',
        branchCode: process.env.FOREIGN_BRANCH_CODE || '000115',
        accountType: 'Savings'
      },
      smtpActive: mailer.isConfigured()
    }
  });
});

// 2. Submit Manuscript
app.post('/api/submissions', submissionLimiter, paperUpload.single('paperFile'), async (req, res) => {
  try {
    const { title, authors, corresponding_email, affiliation, track, abstract, keywords } = req.body;

    if (!title || !authors || !corresponding_email || !affiliation || !track || !abstract) {
      return res.status(400).json({ error: 'All manuscript metadata fields are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload the paper manuscript document (.pdf or .docx).' });
    }

    // Generate unique Paper ID
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const paper_id = `ICMLDE-2026-${randomDigits}`;

    const submissionData = {
      paper_id,
      title: title.trim(),
      authors: authors.trim(),
      corresponding_email: corresponding_email.trim().toLowerCase(),
      affiliation: affiliation.trim(),
      track: track.trim(),
      abstract: abstract.trim(),
      keywords: keywords ? keywords.trim() : '',
      file_path: req.file.filename,
      original_filename: req.file.originalname,
      file_size: req.file.size,
      status: 'Under Review'
    };

    const saved = db.createSubmission(submissionData);

    // Dispatch automated confirmation email
    await mailer.sendSubmissionConfirmation(saved.corresponding_email, saved);

    res.status(201).json({
      success: true,
      message: 'Manuscript submitted successfully and queued for peer review.',
      data: {
        paper_id: saved.paper_id,
        title: saved.title,
        authors: saved.authors,
        track: saved.track,
        status: saved.status,
        created_at: saved.created_at
      }
    });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Failed to process manuscript: ' + err.message });
  }
});

// 3. Track Submission Status
app.get('/api/submissions/track', (req, res) => {
  try {
    const { paper_id, email } = req.query;
    if (!paper_id) {
      return res.status(400).json({ error: 'Paper ID is required.' });
    }

    const sub = db.getSubmissionByPaperId(paper_id, email);
    if (!sub) {
      return res.status(404).json({ error: 'No paper record matching this Paper ID and email.' });
    }

    res.json({
      success: true,
      data: {
        paper_id: sub.paper_id,
        title: sub.title,
        authors: sub.authors,
        affiliation: sub.affiliation,
        track: sub.track,
        status: sub.status,
        reviewer_feedback: sub.reviewer_feedback,
        has_camera_ready: !!sub.camera_ready_file,
        submitted_at: sub.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error querying paper status.' });
  }
});

// 4. Upload Camera-Ready Final Manuscript
app.post('/api/submissions/camera-ready', cameraReadyUpload.single('cameraReadyFile'), (req, res) => {
  try {
    const { paper_id } = req.body;
    if (!paper_id || !req.file) {
      return res.status(400).json({ error: 'Paper ID and final camera-ready file are required.' });
    }

    const sub = db.getSubmissionByPaperId(paper_id);
    if (!sub) {
      return res.status(404).json({ error: 'Paper ID not found.' });
    }

    if (sub.status !== 'Accepted') {
      return res.status(400).json({ error: 'Camera-ready upload is only permitted for Accepted papers.' });
    }

    db.updateCameraReady(paper_id, req.file.filename);

    res.json({
      success: true,
      message: 'Camera-ready version archived successfully for Elsevier publication.',
      data: { paper_id, file: req.file.originalname }
    });
  } catch (err) {
    res.status(500).json({ error: 'Camera-ready upload failed: ' + err.message });
  }
});

// 5. Delegate & Author Registration
app.post('/api/registrations', proofUpload.single('paymentProof'), async (req, res) => {
  try {
    const {
      full_name, email, phone, affiliation, country,
      category, paper_id, mode, amount, payment_method, transaction_id
    } = req.body;

    if (!full_name || !email || !affiliation || !country || !category || !amount) {
      return res.status(400).json({ error: 'All mandatory registration details must be provided.' });
    }

    const regRandom = Math.floor(1000 + Math.random() * 9000);
    const reg_id = `REG-2026-${regRandom}`;
    const txn = transaction_id ? transaction_id.trim() : `TXN-${Date.now().toString(36).toUpperCase()}`;
    const proofFile = req.file ? req.file.filename : null;

    const regData = {
      reg_id,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      affiliation: affiliation.trim(),
      country: country.trim(),
      category: category.trim(),
      paper_id: paper_id ? paper_id.trim() : '',
      mode: mode || 'In-Person',
      amount: amount.trim(),
      payment_method: payment_method || 'Online / Wire',
      payment_status: 'Confirmed',
      transaction_id: txn,
      payment_proof_file: proofFile
    };

    const registration = db.createRegistration(regData);

    // Generate Verification QR Code
    const qrPayload = JSON.stringify({
      conf: 'ICMLDE 2026',
      regId: registration.reg_id,
      name: registration.full_name,
      mode: registration.mode,
      verified: true
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    // Send confirmation email with QR Pass
    await mailer.sendRegistrationInvoice(registration.email, registration, qrDataUrl);

    res.status(201).json({
      success: true,
      message: 'Registration confirmed successfully!',
      data: {
        ...registration,
        qrCode: qrDataUrl
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// 6. Contact & Inquiry Submission
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Please fill in all inquiry fields.' });
    }

    const saved = db.createInquiry({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim()
    });

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been routed to the ICMLDE 2026 Secretariat.',
      data: { id: saved.id }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit inquiry.' });
  }
});

// 7. Special Sessions Proposal Submission
app.post('/api/special-sessions', (req, res) => {
  try {
    const { session_title, proposer_name, proposer_email, proposer_affiliation, session_scope, expected_papers } = req.body;
    if (!session_title || !proposer_name || !proposer_email || !proposer_affiliation || !session_scope) {
      return res.status(400).json({ error: 'All fields are required to propose a special session.' });
    }

    const saved = db.createSpecialSession({
      session_title: session_title.trim(),
      proposer_name: proposer_name.trim(),
      proposer_email: proposer_email.trim().toLowerCase(),
      proposer_affiliation: proposer_affiliation.trim(),
      session_scope: session_scope.trim(),
      expected_papers: parseInt(expected_papers) || 6
    });

    res.status(201).json({
      success: true,
      message: 'Special session proposal submitted successfully! The organizing committee will review your proposal.',
      data: saved
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit proposal: ' + err.message });
  }
});

// 8. Certificate Generator & Verification API
app.post('/api/certificates/generate', async (req, res) => {
  try {
    const { recipient_name, cert_type, paper_title, paper_id, affiliation } = req.body;
    if (!recipient_name || !cert_type || !affiliation) {
      return res.status(400).json({ error: 'Recipient name, certificate type, and affiliation are required.' });
    }

    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const cert_id = `CERT-ICMLDE-2026-${randomCode}`;

    const certData = {
      cert_id,
      recipient_name: recipient_name.trim(),
      cert_type: cert_type.trim(),
      paper_title: paper_title ? paper_title.trim() : '',
      paper_id: paper_id ? paper_id.trim() : '',
      affiliation: affiliation.trim(),
      issue_date: '28 November 2026'
    };

    const saved = db.createCertificate(certData);

    // Verification QR code
    const qrPayload = `https://icmlde-website.vercel.app/certificate.html?verify=${saved.cert_id}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully!',
      data: {
        ...saved,
        qrCode: qrDataUrl,
        verifyUrl: qrPayload
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate certificate: ' + err.message });
  }
});

app.get('/api/certificates/:certId', (req, res) => {
  try {
    const cert = db.getCertificateById(req.params.certId);
    if (!cert) {
      return res.status(404).json({ error: 'Certificate record not found or invalid serial.' });
    }
    res.json({ success: true, data: cert });
  } catch (err) {
    res.status(500).json({ error: 'Error verifying certificate.' });
  }
});

// 9. Public Conference Stats
app.get('/api/public-stats', (req, res) => {
  const stats = db.getStats();
  res.json({
    success: true,
    data: {
      submissions: stats.submissions.total,
      accepted: stats.submissions.accepted,
      registrations: stats.registrations.total,
      dates: process.env.CONFERENCE_DATES || '27–28 November 2026',
      venue: 'School of Computer Science, UPES, Dehradun, India',
      edition: '5th edition (ICMLDE 5.0)'
    }
  });
});

// 10. Fee Receipt Lookup (reads the secretariat's Google Sheet)
app.post('/api/fee-receipt', receiptLimiter, async (req, res) => {
  const paperId = String(req.body.paper_id || '').trim();
  const email = String(req.body.email || '').trim();

  if (!paperId || !email) {
    return res.status(400).json({ error: 'Enter both your Paper ID and the email you registered with.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address doesn\'t look complete. Check it and try again.' });
  }
  if (!feeReceipts.isConfigured()) {
    return res.status(503).json({ error: 'Fee receipts aren\'t published yet. Please check back later or write to info@icmlde.org.' });
  }

  try {
    const matches = await feeReceipts.findReceipts(paperId, email);
    if (matches.length === 0) {
      return res.status(404).json({
        error: 'No receipt matches that Paper ID and email. Use the exact email you registered with. If your payment was made recently, it may not have been confirmed yet.'
      });
    }

    const pendingRe = /^(pending|unverified|not\s*verified|rejected|failed|no|unpaid|under\s*verification)$/i;
    const confirmed = matches.filter(m => !m.status || !pendingRe.test(m.status.trim()));
    if (confirmed.length === 0) {
      return res.status(202).json({
        success: false,
        pending: true,
        error: 'We found your payment, but the finance team hasn\'t confirmed it yet. Your receipt will appear here once it is confirmed.'
      });
    }

    res.json({ success: true, data: confirmed });
  } catch (err) {
    console.error('[fee-receipt]', err.message);
    res.status(502).json({ error: 'The receipt records couldn\'t be reached just now. Try again in a minute.' });
  }
});

// ==========================================
// ADMIN DASHBOARD & EDITORIAL API
// ==========================================

// Admin Login with JWT & Bcrypt
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = db.verifyAdmin(username, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    username: admin.username,
    role: admin.role,
    message: 'Authentication successful.'
  });
});

// Admin Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.getStats() });
});

// Admin Submissions List
app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.getAllSubmissions() });
});

// Admin Update Paper Review Status & Send Email Decision
app.patch('/api/admin/submissions/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status, reviewer_feedback, notify_author } = req.body;
    const valid = ['Under Review', 'Accepted', 'Revision Requested', 'Rejected'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const updated = db.updateSubmissionStatus(req.params.id, status, reviewer_feedback);
    if (!updated) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    // Automatically send decision email if notify_author is true (default true)
    if (notify_author !== false) {
      await mailer.sendReviewDecision(updated.corresponding_email, updated, status, reviewer_feedback);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update review status: ' + err.message });
  }
});

// Download Original Manuscript
app.get('/api/admin/submissions/:id/download', (req, res) => {
  // Allow token from query param for direct browser download links
  const token = req.query.authorization || req.headers['authorization'];
  try {
    const actualToken = token && token.startsWith('Bearer ') ? token.slice(7) : token;
    jwt.verify(actualToken, JWT_SECRET);
  } catch (e) {
    return res.status(401).send('Unauthorized to download manuscript.');
  }

  const sub = db.getSubmissionById(req.params.id);
  if (!sub) return res.status(404).send('Submission not found.');

  const filePath = path.join(papersDir, sub.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found on disk.');

  res.download(filePath, sub.original_filename);
});

// Admin Registrations List
app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.getAllRegistrations() });
});

// Admin Registrations CSV Export
app.get('/api/admin/registrations/export', (req, res) => {
  const token = req.query.authorization || req.headers['authorization'];
  try {
    const actualToken = token && token.startsWith('Bearer ') ? token.slice(7) : token;
    jwt.verify(actualToken, JWT_SECRET);
  } catch (e) {
    return res.status(401).send('Unauthorized.');
  }

  const records = db.getAllRegistrations();
  let csv = 'RegID,FullName,Email,Phone,Affiliation,Country,Category,PaperID,Mode,Amount,PaymentMethod,Status,TxnID,Date\n';

  records.forEach(r => {
    csv += `"${r.reg_id}","${r.full_name}","${r.email}","${r.phone || ''}","${r.affiliation}","${r.country}","${r.category}","${r.paper_id || ''}","${r.mode}","${r.amount}","${r.payment_method}","${r.payment_status}","${r.transaction_id}","${r.created_at}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ICMLDE_Registrations_2026.csv"');
  res.send(csv);
});

// Admin Inquiries List
app.get('/api/admin/inquiries', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.getAllInquiries() });
});

// Admin Resolve Inquiry
app.patch('/api/admin/inquiries/:id/status', requireAdmin, (req, res) => {
  const { status, reply_text } = req.body;
  const updated = db.updateInquiryStatus(req.params.id, status || 'Resolved', reply_text);
  res.json({ success: true, data: updated });
});

// Admin Special Sessions List
app.get('/api/admin/special-sessions', requireAdmin, (req, res) => {
  res.json({ success: true, data: db.getAllSpecialSessions() });
});

// Admin Update Special Session Status
app.patch('/api/admin/special-sessions/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const updated = db.updateSpecialSessionStatus(req.params.id, status || 'Approved');
  res.json({ success: true, data: updated });
});

// Admin Database Reset / Clean Production Action
app.post('/api/admin/clear-demo-data', requireAdmin, (req, res) => {
  db.clearAllDemoData();
  res.json({ success: true, message: 'All demo entries purged. Database is ready for live conference operations.' });
});

// Start Server if not running on Vercel serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  ICMLDE 2026 Production Server Initialized`);
    console.log(`  Dates: 27–28 November 2026`);
    console.log(`  Host URL: http://localhost:${PORT}`);
    console.log(`  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`  Default Admin: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`  SMTP Service: ${mailer.isConfigured() ? 'Active (Live)' : 'Standby (Configure .env for live emails)'}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
