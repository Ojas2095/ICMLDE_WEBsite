const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbDir = isVercel ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'icmlde.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for high concurrency & production stability
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (e) {
  console.warn('Note on WAL mode:', e.message);
}

// Production Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    corresponding_email TEXT NOT NULL,
    affiliation TEXT NOT NULL,
    track TEXT NOT NULL,
    abstract TEXT NOT NULL,
    keywords TEXT,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER,
    status TEXT DEFAULT 'Under Review',
    reviewer_feedback TEXT DEFAULT '',
    camera_ready_file TEXT DEFAULT NULL,
    copyright_form_file TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reg_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    affiliation TEXT NOT NULL,
    country TEXT NOT NULL,
    category TEXT NOT NULL,
    paper_id TEXT,
    mode TEXT DEFAULT 'In-Person',
    amount TEXT NOT NULL,
    payment_method TEXT DEFAULT 'Online Gateway',
    payment_status TEXT DEFAULT 'Confirmed',
    transaction_id TEXT,
    payment_proof_file TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Unread',
    reply_text TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS special_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_title TEXT NOT NULL,
    proposer_name TEXT NOT NULL,
    proposer_email TEXT NOT NULL,
    proposer_affiliation TEXT NOT NULL,
    session_scope TEXT NOT NULL,
    expected_papers INTEGER DEFAULT 6,
    status TEXT DEFAULT 'Pending Review',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_id TEXT UNIQUE NOT NULL,
    recipient_name TEXT NOT NULL,
    cert_type TEXT NOT NULL,
    paper_title TEXT,
    paper_id TEXT,
    affiliation TEXT NOT NULL,
    issue_date TEXT DEFAULT 'November 28, 2026',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_paper_id ON submissions(paper_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(corresponding_email);
  CREATE INDEX IF NOT EXISTS idx_registrations_reg_id ON registrations(reg_id);
`);

// Migrations for existing schemas
try { db.exec('ALTER TABLE submissions ADD COLUMN camera_ready_file TEXT DEFAULT NULL;'); } catch (e) {}
try { db.exec('ALTER TABLE submissions ADD COLUMN copyright_form_file TEXT DEFAULT NULL;'); } catch (e) {}
try { db.exec('ALTER TABLE registrations ADD COLUMN payment_method TEXT DEFAULT "Online / NEFT";'); } catch (e) {}
try { db.exec('ALTER TABLE registrations ADD COLUMN payment_proof_file TEXT DEFAULT NULL;'); } catch (e) {}
try { db.exec('ALTER TABLE inquiries ADD COLUMN reply_text TEXT DEFAULT "";'); } catch (e) {}

// Initialize Admin Credentials
function initAdminAccount() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'icmlde2026_SecretPass!';

  const existing = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(adminUsername);
  if (!existing) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);
    db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(adminUsername, hash, 'superadmin');
    console.log(`[Security] Initialized primary administrator: ${adminUsername}`);
  }
}
initAdminAccount();

module.exports = {
  db,

  // Admin Auth
  verifyAdmin(username, password) {
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!user) return null;
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) return null;
    return { id: user.id, username: user.username, role: user.role };
  },

  updateAdminPassword(username, newPassword) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, username);
    return true;
  },

  // Submissions
  createSubmission(data) {
    const stmt = db.prepare(`
      INSERT INTO submissions (
        paper_id, title, authors, corresponding_email, affiliation,
        track, abstract, keywords, file_path, original_filename, file_size, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.paper_id,
      data.title,
      data.authors,
      data.corresponding_email,
      data.affiliation,
      data.track,
      data.abstract,
      data.keywords || '',
      data.file_path,
      data.original_filename,
      data.file_size,
      data.status || 'Under Review'
    );
    return this.getSubmissionByPaperId(data.paper_id);
  },

  getSubmissionByPaperId(paperId, email) {
    if (email) {
      return db.prepare(`
        SELECT * FROM submissions 
        WHERE LOWER(paper_id) = LOWER(?) AND LOWER(corresponding_email) = LOWER(?)
      `).get(paperId.trim(), email.trim());
    }
    return db.prepare('SELECT * FROM submissions WHERE LOWER(paper_id) = LOWER(?)').get(paperId.trim());
  },

  getSubmissionById(idOrPaperId) {
    if (!isNaN(Number(idOrPaperId))) {
      const byId = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(idOrPaperId));
      if (byId) return byId;
    }
    return db.prepare('SELECT * FROM submissions WHERE LOWER(paper_id) = LOWER(?)').get(String(idOrPaperId).trim());
  },

  getAllSubmissions() {
    return db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  },

  updateSubmissionStatus(idOrPaperId, status, reviewer_feedback) {
    const isNum = !isNaN(Number(idOrPaperId)) && String(Number(idOrPaperId)) === String(idOrPaperId).trim();
    if (isNum) {
      db.prepare(`
        UPDATE submissions 
        SET status = ?, reviewer_feedback = ?
        WHERE id = ?
      `).run(status, reviewer_feedback || '', Number(idOrPaperId));
      return this.getSubmissionById(Number(idOrPaperId));
    } else {
      db.prepare(`
        UPDATE submissions 
        SET status = ?, reviewer_feedback = ?
        WHERE LOWER(paper_id) = LOWER(?)
      `).run(status, reviewer_feedback || '', String(idOrPaperId).trim());
      return this.getSubmissionByPaperId(String(idOrPaperId));
    }
  },

  updateCameraReady(paperId, filename) {
    db.prepare('UPDATE submissions SET camera_ready_file = ? WHERE LOWER(paper_id) = LOWER(?)')
      .run(filename, paperId.trim());
    return this.getSubmissionByPaperId(paperId);
  },

  // Registrations
  createRegistration(data) {
    const stmt = db.prepare(`
      INSERT INTO registrations (
        reg_id, full_name, email, phone, affiliation,
        country, category, paper_id, mode, amount, payment_method,
        payment_status, transaction_id, payment_proof_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.reg_id,
      data.full_name,
      data.email,
      data.phone || '',
      data.affiliation,
      data.country,
      data.category,
      data.paper_id || '',
      data.mode || 'In-Person',
      data.amount,
      data.payment_method || 'Online / NEFT',
      data.payment_status || 'Confirmed',
      data.transaction_id || `TXN-${Date.now().toString(36).toUpperCase()}`,
      data.payment_proof_file || null
    );
    return this.getRegistrationByRegId(data.reg_id);
  },

  getRegistrationByRegId(regId) {
    return db.prepare('SELECT * FROM registrations WHERE LOWER(reg_id) = LOWER(?)').get(regId.trim());
  },

  getAllRegistrations() {
    return db.prepare('SELECT * FROM registrations ORDER BY id DESC').all();
  },

  updateRegistrationPaymentStatus(id, payment_status) {
    db.prepare('UPDATE registrations SET payment_status = ? WHERE id = ?').run(payment_status, id);
    return db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  },

  // Inquiries
  createInquiry(data) {
    const stmt = db.prepare(`
      INSERT INTO inquiries (name, email, subject, message)
      VALUES (?, ?, ?, ?)
    `);
    const res = stmt.run(data.name, data.email, data.subject, data.message);
    return db.prepare('SELECT * FROM inquiries WHERE id = ?').get(res.lastInsertRowid);
  },

  getAllInquiries() {
    return db.prepare('SELECT * FROM inquiries ORDER BY id DESC').all();
  },

  updateInquiryStatus(id, status, reply_text) {
    db.prepare('UPDATE inquiries SET status = ?, reply_text = ? WHERE id = ?')
      .run(status, reply_text || '', id);
    return db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id);
  },

  // Special Sessions
  createSpecialSession(data) {
    const stmt = db.prepare(`
      INSERT INTO special_sessions (
        session_title, proposer_name, proposer_email,
        proposer_affiliation, session_scope, expected_papers
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      data.session_title,
      data.proposer_name,
      data.proposer_email,
      data.proposer_affiliation,
      data.session_scope,
      data.expected_papers || 6
    );
    return db.prepare('SELECT * FROM special_sessions WHERE id = ?').get(res.lastInsertRowid);
  },

  getAllSpecialSessions() {
    return db.prepare('SELECT * FROM special_sessions ORDER BY id DESC').all();
  },

  updateSpecialSessionStatus(id, status) {
    db.prepare('UPDATE special_sessions SET status = ? WHERE id = ?').run(status, id);
    return db.prepare('SELECT * FROM special_sessions WHERE id = ?').get(id);
  },

  // Certificates
  createCertificate(data) {
    const stmt = db.prepare(`
      INSERT INTO certificates (
        cert_id, recipient_name, cert_type, paper_title,
        paper_id, affiliation, issue_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.cert_id,
      data.recipient_name,
      data.cert_type,
      data.paper_title || '',
      data.paper_id || '',
      data.affiliation,
      data.issue_date || 'November 28, 2026'
    );
    return this.getCertificateById(data.cert_id);
  },

  getCertificateById(certId) {
    return db.prepare('SELECT * FROM certificates WHERE LOWER(cert_id) = LOWER(?)').get(certId.trim());
  },

  getAllCertificates() {
    return db.prepare('SELECT * FROM certificates ORDER BY id DESC').all();
  },

  // Summary Metrics
  getStats() {
    const submissionsTotal = db.prepare('SELECT COUNT(*) as count FROM submissions').get().count;
    const acceptedCount = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'Accepted'").get().count;
    const underReviewCount = db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'Under Review'").get().count;
    const registrationsTotal = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
    const inquiriesTotal = db.prepare('SELECT COUNT(*) as count FROM inquiries').get().count;

    return {
      submissions: {
        total: submissionsTotal,
        accepted: acceptedCount,
        underReview: underReviewCount
      },
      registrations: {
        total: registrationsTotal
      },
      inquiries: {
        total: inquiriesTotal
      }
    };
  },

  // Clean production helper
  clearAllDemoData() {
    db.exec(`
      DELETE FROM submissions;
      DELETE FROM registrations;
      DELETE FROM inquiries;
    `);
    console.log('[Database] Cleared all data for live conference run.');
  }
};
