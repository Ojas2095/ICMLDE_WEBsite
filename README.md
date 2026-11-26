# ICMLDE 2026 — Conference Website & Author Platform

Website and author platform for the **5th International Conference on Machine Learning and Data Engineering (ICMLDE 5.0, 2026)**. Conference details follow the official site, [icmlde.org](https://icmlde.org/).  
**Dates:** 27–28 November 2026  
**Venue:** School of Computer Science, UPES, Bidholi Via–Prem Nagar, Dehradun 248007, India  
**Proceedings:** Procedia Computer Science, Elsevier (indexed in Scopus, Web of Science, DBLP).

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
* **Official fee structure (icmlde.org):** Regular author ₹12,000 / $350, student author ₹11,500 / $300, industry professional ₹13,000, second paper ₹11,500 / $250, listener ₹7,000 / $150.
* **Payment routes (as on icmlde.org):**
  * Indian authors: Paytm link on the [official registration form](https://icmlde.org/icmlde_registration5.html).
  * Foreign authors: wire transfer to UPES, YES Bank (details on the site).
* **Payment Proof Upload:** Upload the payment screenshot or receipt (`.pdf`, `.png`, `.jpg`) with the transaction ID.
* **Dynamic QR Pass Generation:** Generates a real scannable QR Code pass on the delegate ticket containing cryptographic verification.
* **Automatic Invoice Generation:** Generates printable invoice / badge and dispatches email confirmation.

### 4. 📅 Programme (`/schedule.html`)
* The 10 keynote speakers, Workshop 01 and the 30 special sessions (ICMLDE.001–030), as listed on icmlde.org.
* Links to the official paper presentation schedule search.

### 5. 🛡️ Editorial & Admin Console (`/admin.html`)
* **Security & Authentication:** Password hashing with `bcryptjs` and 24-hour tamper-proof JSON Web Tokens (`jsonwebtoken`).
* **Rate Limiting:** Protects against DDoS attacks and brute-force password guessing via `express-rate-limit`.
* **Submissions Manager:** Inspect manuscripts, download uploaded PDFs, change editorial decisions (*Accepted*, *Revision Requested*, *Rejected*), enter reviewer comments, and auto-dispatch decision emails.
* **Attendee Manager:** Inspect registrations, verified payments, transaction UTR numbers, payment proofs, and download one-click CSV export (`/api/admin/registrations/export`).
* **Secretariat Mailbox:** Review inquiries submitted via the public contact form and mark them as resolved.
* **Database Reset / Purge Action:** Secure button allowing the conference chairs to clear test records anytime to ensure a 100% clean operational database.

### 6. 🧾 Fee Receipt Download (`/fee-receipt.html`)
* Authors enter their **Paper ID** and **registered email**; if both match a confirmed payment, a printable receipt (with the amount in words) is shown and can be saved as PDF.
* Data comes from a **Google Sheet** kept by the secretariat. The server reads it (`feeReceipts.js`, endpoint `POST /api/fee-receipt`) and returns only the matching row, so other authors' details never reach the browser. Lookups are rate-limited.

**Setting up the sheet**
1. Create a Google Sheet with a header row. Required columns: `Paper ID`, `Email`. Recommended: `Name`, `Amount`, `Currency`, `Payment Mode`, `Transaction ID`, `Date`. Optional: `Receipt No`, `Paper Title`, `Category`, `Affiliation`, `Status`. A ready-made template is in [`docs/fee-sheet-template.csv`](docs/fee-sheet-template.csv) (File → Import in Google Sheets).
   * Header names are flexible (`Gmail`, `UTR No`, `NEFT/UPI No`, `Amount Paid`, `Dated` … all work). Any other columns are printed on the receipt as extra rows.
   * Paper IDs match loosely: `913` finds `ICMLDE-2026-913`. An email cell may hold several addresses separated by commas or semicolons (e.g. co-authors).
   * If there is a `Status` column, rows marked `Pending`, `Unverified`, `Rejected` or `Failed` are **not** shown as receipts; the author is told the payment is awaiting confirmation.
2. Share it: **Share → General access → Anyone with the link → Viewer** (or **File → Share → Publish to web → CSV**).
3. In Vercel: **Project → Settings → Environment Variables**, add `FEE_SHEET_URL` = the sheet link, then redeploy. Changes to the sheet appear on the site within about a minute.
   * Uploaded `.xlsx` files opened in Google Sheets work too (e.g. the Paytm export `EReceipt.xlsx`). Columns such as `Payout Date`, `UTR`, `Registration Fees`, `Participant Name`, `Mail id`, `Title of the paper`, `Paper ID` are recognised, stray apostrophes (`913'`) are stripped, and phone numbers / internal columns (`Contact No`, `CB Amt`, `Invoice ID`) are never shown.
   * The receipt names the edition from the payment date: payments in 2025 print as ICMLDE 2025 (4th edition, 6–8 November 2025), 2026 as ICMLDE 2026. Edit `EDITIONS` in `public/js/fee-receipt.js` for future years.
   * Lookups are limited to 40 per connection per 15 minutes; change with `RECEIPT_LOOKUPS_PER_15_MIN`.

---

## ⚙️ Configuration & Environment (`.env`)

Configure settings in `.env`:

```env
PORT=3000
NODE_ENV=production

# Administrative Security
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose_a_strong_password
JWT_SECRET=choose_a_long_random_string

# Automated Email System (SMTP)
# Enter your Gmail App Password, SendGrid, Amazon SES, or UPES university SMTP:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_app_password
SMTP_FROM="ICMLDE 2026 Secretariat" <secretariat@icmlde2026.org>

# Official registration form (Indian authors pay via its Paytm link)
OFFICIAL_REGISTRATION_URL=https://icmlde.org/icmlde_registration5.html
# Public site URL used in emails
SITE_URL=https://icmlde-website.vercel.app
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
* **Fee Receipt Download:** `http://localhost:3000/fee-receipt.html`
* **Admin & Editorial Console:** `http://localhost:3000/admin.html`
  * **Default Username:** `admin`
  * **Password:** the value of `ADMIN_PASSWORD` (set it in your Vercel environment variables)
