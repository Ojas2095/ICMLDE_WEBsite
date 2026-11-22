# Project Submission & Technical Evaluation Report

**Project Title:** ICMLDE 2026 Conference Management & Editorial Web Platform  
**Conference:** 5th International Conference on Machine Learning and Data Engineering  
**Dates:** November 27th & 28th, 2026  
**Venue:** School of Computer Science, UPES, Dehradun 248007, Uttarakhand, India  
**Publisher & Indexing:** Elsevier Procedia Computer Science (Scopus, Web of Science, DBLP)  
**Developer / Student Repository:** [https://github.com/Ojas2095/ICMLDE_WEBsite](https://github.com/Ojas2095/ICMLDE_WEBsite)  
**Live Production URL:** [https://icmlde-website.vercel.app](https://icmlde-website.vercel.app)

---

## 1. Executive Summary

This project delivers a full-stack academic conference web platform designed to handle the end-to-end digital operations for **ICMLDE 2026**. Modeled strictly after the official operational guidelines of `icmlde.org`, the system replaces fragile third-party forms with an integrated, secure, and self-hosted platform covering:

1. Public conference dissemination (tracks, speakers, workshops, dates, FAQs).
2. Author paper submission and double-blind peer review handling.
3. Live submission tracking and camera-ready version archival.
4. Delegate registration with dual-currency fee calculation (INR / USD).
5. Indian banking (YES Bank / NEFT / UPI) and international SWIFT wire transfer reconciliation with UTR proof uploads.
6. Dynamic cryptographic QR Code delegate pass generation.
7. Secure JWT-authenticated administrative editorial dashboard with CSV attendee roster exports.

---

## 2. System Architecture & Tech Stack

```
[ Client Browser ]
        │
        ├── HTTPS (Vercel Edge Global CDN)
        │
[ Express.js REST API Server ] (Node.js v22+)
        │
        ├── Security Layer: bcryptjs + JWT + express-rate-limit
        ├── Upload Streamer: Multer (PDF/DOCX validation)
        ├── Code Generator: QRCode (Base64 pass badges)
        ├── Mailer Engine: Nodemailer (SMTP transactional notices)
        │
[ Relational SQLite Database (WAL Mode) ]
        ├── submissions
        ├── registrations
        ├── special_sessions
        ├── inquiries
        └── admin_users
```

* **Frontend:** Semantic HTML5, CSS3 Grid/Flexbox, custom responsive theme with glassmorphism, vanilla JavaScript (no heavy runtime framework overhead).
* **Backend:** Node.js (v22+), Express.js framework.
* **Database:** SQLite with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) for concurrent read/write stability.
* **Authentication:** Password hashing via `bcryptjs`, tamper-proof administrative sessions via signed `jsonwebtoken` (24-hour expiration).
* **Rate Limiting:** Protected with `express-rate-limit` against brute-force authentication and spam submissions.
* **DevOps:** Configured for Vercel Serverless (`vercel.json`), Containerization (`Dockerfile`), and persistent infrastructure (`render.yaml`).

---

## 3. Core Feature Matrix

| Feature Module | Endpoint | Description |
| :--- | :--- | :--- |
| **Conference Info** | `GET /api/conference-info` | Exposes verified banking (YES Bank & UPES NEFT/SWIFT), dates, and venue metadata. |
| **Manuscript Upload** | `POST /api/submissions` | Handles multipart form upload of research papers up to 25MB, auto-generating Paper IDs (e.g., `ICMLDE-2026-XXXX`). |
| **Standalone Submission Portal** | `GET /submission-form.html` | Distraction-free dedicated multi-step paper submission portal with live word counter, drag-and-drop PDF dropzone, and printable receipt. |
| **Paper Status Tracker** | `GET /api/submissions/track` | Allows authors to check live status (*Under Review*, *Accepted*, *Revision*, *Rejected*) and reviewer remarks. |
| **Camera-Ready Archival** | `POST /api/submissions/camera-ready` | Permits accepted authors to upload final camera-ready versions for Elsevier publication. |
| **Certificate Creator & Verifier** | `POST /api/certificates/generate` | Generates official conference presentation, participation, and best paper awards with dynamic QR verification seals. |
| **Certificate Public Verification** | `GET /api/certificates/:certId` | Instant cryptographic validation of participant credentials via serialized Certificate IDs. |
| **Delegate Registration** | `POST /api/registrations` | Computes fee tiers (Regular Author, Students, Industry, Listener), uploads UTR payment proof, and generates QR badge. |
| **Special Sessions** | `POST /api/special-sessions` | Captures special session proposals with scope and target paper quotas. |
| **Contact / Secretariat** | `POST /api/contact` | Captures inquiries regarding visa letters, travel, and sponsorships. |
| **Editorial Login** | `POST /api/admin/login` | Authenticates conference chairs and issues signed JWT bearer tokens. |
| **Editorial Review** | `PATCH /api/admin/submissions/:id/status` | Allows track chairs to update decisions and dispatch automated decision emails. |
| **CSV Export** | `GET /api/admin/registrations/export` | Generates a downloadable `.csv` attendee roster for on-campus registration desks. |

---

## 4. Administrative & Portal URLs

* **Official Portal:** [https://icmlde-website.vercel.app](https://icmlde-website.vercel.app)
* **Standalone Submission Form:** [https://icmlde-website.vercel.app/submission-form.html](https://icmlde-website.vercel.app/submission-form.html)
* **Certificate Creator & Verifier:** [https://icmlde-website.vercel.app/certificate.html](https://icmlde-website.vercel.app/certificate.html)
* **Author Call for Papers & Tracking:** [https://icmlde-website.vercel.app/papers.html](https://icmlde-website.vercel.app/papers.html)
* **Registration & Fee Calculator:** [https://icmlde-website.vercel.app/register.html](https://icmlde-website.vercel.app/register.html)
* **Editorial Dashboard:** [https://icmlde-website.vercel.app/admin.html](https://icmlde-website.vercel.app/admin.html)
* **Default Username:** `admin`
* **Default Password:** `icmlde2026_SecretPass!`

---

## 5. Verification & Testing Instructions

1. **Standalone Submission Test:** Open [Standalone Form](https://icmlde-website.vercel.app/submission-form.html), fill out author details, attach a sample PDF, submit, and view the generated Paper ID receipt.
2. **Review Test:** Open [Admin Console](https://icmlde-website.vercel.app/admin.html), log in, locate the submission, change status to **Accepted**, and add reviewer remarks.
3. **Tracking Test:** Open [Papers Hub](https://icmlde-website.vercel.app/papers.html#tracker), query your Paper ID, and verify the status update and camera-ready upload prompt.
4. **Certificate Creator Test:** Open [Certificate Portal](https://icmlde-website.vercel.app/certificate.html), customize recipient name, paper title, click **Save & Generate QR Verification Seal**, and test **Print / Save as PDF**.
5. **Certificate Public Verification Test:** Scan or visit `https://icmlde-website.vercel.app/certificate.html?verify=CERT-ID` to confirm the system loads the verified record.
6. **Registration Test:** Open [Registration Portal](https://icmlde-website.vercel.app/register.html), complete registration, and inspect the dynamically generated QR pass.
7. **CSV Roster Test:** In the Admin Console, click **Export Registrations (CSV)** to inspect the generated spreadsheet.
