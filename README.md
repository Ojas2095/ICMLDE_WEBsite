# ICMLDE 2026 - Production Conference Platform & Operational Engine

Official portal and real-time backend engine for the **5th International Conference on Machine Learning and Data Engineering (ICMLDE 2026)**.  
**Dates:** November 27th & 28th, 2026  
**Venue:** UPES Knowledge Acres, Dehradun 248007, Uttarakhand, India (Hybrid Format)  
**Proceedings & Indexing:** Published in open-access **Elsevier Procedia Computer Science** (Indexed in Scopus, Web of Science, DBLP).

---

## 🚀 Live Operational Features

### 1. 📝 Production Manuscript Submission Engine (`/papers.html`)
* **Real-time Manuscript Upload:** Multi-part file upload (`.pdf` / `.docx`) up to 25MB stored securely in `uploads/papers/`.
* **Automatic ID Generation:** Unique tracking codes (e.g., `ICMLDE-2026-5633`).
* **Automated Email Acknowledgment:** Automatically sends an official submission receipt to the author via SMTP (gracefully falls back to logged dispatch if SMTP is unconfigured).
* **Double-blind & Plagiarism Verification:** Automated validation against conference guidelines.
* **Camera-Ready Version Archival:** Accepted papers can upload their camera-ready manuscripts directly for Elsevier publication.

### 2. 🔍 Real-Time Paper Tracking (`/papers.html#tracker` & Homepage Widget)
* Authors can query their Paper ID anytime to inspect:
  * Review status: `Under Review`, `Accepted`, `Revision Requested`, `Rejected`.
  * Technical Program Committee (TPC) peer-review remarks and ablation suggestions.
  * Camera-Ready upload status.
  * Direct one-click link to Author Registration upon acceptance.

### 3. 🎟️ Registration & Payment Reconciliation (`/register.html`)
* **Multi-Tier Fee Structure:** Student, Academician, Industry Professional, Attendee, International Author.
* **Dual Currency Support:** ₹ INR (Indian delegates) & $ USD (International delegates).
* **Payment Methods:**
  * Direct Bank Transfer (NEFT / RTGS / IMPS) to the official State Bank of India conference account.
  * Instant UPI Transfer via official conference UPI ID.
  * SWIFT International Wire Transfer.
  * Online Card Payment.
* **Payment Proof Upload:** Upload bank transfer slips / screenshot (`.pdf`, `.png`, `.jpg`) with mandatory UTR number.
* **Dynamic QR Pass Generation:** Generates a real scannable QR Code pass on the delegate ticket containing cryptographic verification.
* **Automatic Invoice Generation:** Generates printable invoice / badge and dispatches email confirmation.

### 4. 📅 2-Day Conference Schedule (`/schedule.html`)
* Interactive day filter:
  * **Day 1: Friday, November 27, 2026** (Inauguration, Keynotes 1 & 2, Parallel Tracks 1 & 2, Industry Panel, Gala Dinner).
  * **Day 2: Saturday, November 28, 2026** (Keynotes 3 & 4, Parallel Tracks 3 & 4, Doctoral Symposium, Valedictory & Best Paper Awards).

### 5. 🛡️ Editorial & Admin Console (`/admin.html`)
* **Security & Authentication:** Password hashing with `bcryptjs` and 24-hour tamper-proof JSON Web Tokens (`jsonwebtoken`).
* **Rate Limiting:** Protects against DDoS attacks and brute-force password guessing via `express-rate-limit`.
* **Submissions Manager:** Inspect manuscripts, download uploaded PDFs, change editorial decisions (*Accepted*, *Revision Requested*, *Rejected*), enter reviewer comments, and auto-dispatch decision emails.
* **Attendee Manager:** Inspect registrations, verified payments, transaction UTR numbers, payment proofs, and download one-click CSV export (`/api/admin/registrations/export`).
* **Secretariat Mailbox:** Review inquiries submitted via the public contact form and mark them as resolved.
* **Database Reset / Purge Action:** Secure button allowing the conference chairs to clear test records anytime to ensure a 100% clean operational database.

---

## ⚙️ Configuration & Environment (`.env`)

Configure settings in `.env`:

```env
PORT=3000
NODE_ENV=production

# Administrative Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=icmlde2026_SecretPass!
JWT_SECRET=icmlde_jwt_secret_salt_key_994821_production_ready

# Automated Email System (SMTP)
# Enter your Gmail App Password, SendGrid, Amazon SES, or UPES university SMTP:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password
SMTP_FROM="ICMLDE 2026 Secretariat" <secretariat@icmlde2026.org>

# Official Conference Banking / NEFT / RTGS / UPI Credentials
BANK_ACCOUNT_NAME="ICMLDE Conference Account"
BANK_NAME="State Bank of India"
BANK_ACCOUNT_NUMBER="39847291049"
BANK_IFSC="SBIN0010542"
BANK_SWIFT="SBININBB105"
BANK_UPI_ID="icmlde2026@sbi"
```

---

## 🚀 Running the Production Server

```powershell
npm start
```

Access the system:
* **Public Conference Portal:** `http://localhost:3000`
* **Paper Submissions Hub:** `http://localhost:3000/papers.html`
* **Schedule & Agenda:** `http://localhost:3000/schedule.html`
* **Registration & QR Pass:** `http://localhost:3000/register.html`
* **Admin & Editorial Console:** `http://localhost:3000/admin.html`
  * **Default Username:** `admin`
  * **Default Password:** `icmlde2026_SecretPass!`
