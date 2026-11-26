/* ===================================================================
   ICMLDE 2026 - Fee receipt lookup backed by a Google Sheet
   -------------------------------------------------------------------
   The secretariat keeps confirmed payments in a Google Sheet. This
   module downloads that sheet as CSV (cached briefly), finds the rows
   that match BOTH the Paper ID and the email the author typed, and
   returns only those rows. The full sheet never reaches the browser.

   Configure ONE of these in .env / Vercel environment variables:
     FEE_SHEET_URL   Any Google Sheets link:
                       - the normal sharing link (sheet must be shared as
                         "Anyone with the link: Viewer"), or
                       - a "Publish to web" CSV link (…/pub?output=csv)
     FEE_SHEET_FILE  Path to a local CSV file (for local testing)

   Optional:
     FEE_SHEET_CACHE_SECONDS  How long to cache the sheet (default 60)
   =================================================================== */

const fs = require('fs');
const path = require('path');

// Column headers we recognise (case, spaces and punctuation are ignored).
const COLUMN_ALIASES = {
  paper_id: ['paperid', 'paperno', 'papernumber', 'paper', 'id', 'submissionid'],
  email: ['email', 'gmail', 'emailid', 'emailaddress', 'mail', 'mailid', 'authoremail', 'correspondingemail'],
  name: ['name', 'fullname', 'authorname', 'receivedfrom', 'payername', 'delegatename', 'participantname'],
  amount: ['amount', 'amountpaid', 'fee', 'feepaid', 'fees', 'sum', 'amountrs', 'amountinr', 'totalamount'],
  currency: ['currency'],
  reference: ['transactionid', 'transactionno', 'utr', 'utrno', 'utrnumber', 'reference', 'referenceno', 'neftupino', 'neftupinoch', 'neftupino/ch', 'chequeno', 'txnid', 'neftno', 'upino', 'upiref'],
  mode: ['paymentmode', 'mode', 'paymentmethod', 'paidvia', 'via'],
  date: ['date', 'paymentdate', 'dated', 'dateofpayment', 'receiptdate'],
  receipt_no: ['receiptno', 'receiptnumber', 'receiptid'],
  paper_title: ['papertitle', 'title'],
  category: ['category', 'registrationcategory', 'regcategory', 'registrationtype'],
  affiliation: ['affiliation', 'institution', 'organisation', 'organization', 'university', 'college'],
  status: ['status', 'paymentstatus', 'verified']
};

const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normId = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normEmail = (v) => String(v || '').trim().toLowerCase();

/** Minimal RFC 4180 CSV parser (handles quotes, escaped quotes, newlines in cells). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const s = String(text).replace(/^﻿/, '');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** Turn whatever Google Sheets link the organisers paste into a CSV download URL. */
function toCsvUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();
  // Published-to-web links already serve CSV when output=csv
  if (/\/pub(\?|$)/.test(url) || /output=csv/.test(url) || /format=csv/.test(url)) {
    return url.includes('output=') || url.includes('format=') ? url : `${url}${url.includes('?') ? '&' : '?'}output=csv`;
  }
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (idMatch) {
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
  }
  // Bare sheet ID
  if (/^[a-zA-Z0-9-_]{30,}$/.test(url)) {
    return `https://docs.google.com/spreadsheets/d/${url}/export?format=csv&gid=0`;
  }
  return url;
}

let cache = { at: 0, rows: null };

function isConfigured() {
  return Boolean(process.env.FEE_SHEET_URL || process.env.FEE_SHEET_FILE);
}

async function loadSheet() {
  const ttl = Number(process.env.FEE_SHEET_CACHE_SECONDS || 60) * 1000;
  if (cache.rows && Date.now() - cache.at < ttl) return cache.rows;

  let text;
  if (process.env.FEE_SHEET_FILE) {
    text = fs.readFileSync(path.resolve(process.env.FEE_SHEET_FILE), 'utf8');
  } else {
    const csvUrl = toCsvUrl(process.env.FEE_SHEET_URL);
    const res = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.includes('text/html')) {
      // Google returns an HTML sign-in page when the sheet isn't shared publicly
      throw new Error(`Could not read the fee sheet (HTTP ${res.status}). Share it as "Anyone with the link: Viewer" or publish it to the web as CSV.`);
    }
    text = await res.text();
  }

  const table = parseCsv(text);
  if (table.length < 2) throw new Error('The fee sheet has no data rows.');

  // Allow a title row or two above the real header: pick the first row that
  // contains both a paper-id column and an email column.
  let headerIdx = table.findIndex(r => {
    const h = r.map(normHeader);
    return h.some(x => COLUMN_ALIASES.paper_id.includes(x)) && h.some(x => COLUMN_ALIASES.email.includes(x));
  });
  if (headerIdx === -1) throw new Error('The fee sheet needs a "Paper ID" column and an "Email" column.');

  const headers = table[headerIdx].map(h => String(h).trim());
  const keyFor = headers.map(h => {
    const n = normHeader(h);
    return Object.keys(COLUMN_ALIASES).find(k => COLUMN_ALIASES[k].includes(n)) || null;
  });

  const rows = table.slice(headerIdx + 1).map(cells => {
    const rec = { extra: [] };
    headers.forEach((h, i) => {
      const value = String(cells[i] ?? '').trim();
      const key = keyFor[i];
      if (key && rec[key] === undefined) rec[key] = value;
      else if (value && h) rec.extra.push({ label: h, value });
    });
    return rec;
  });

  cache = { at: Date.now(), rows };
  return rows;
}

function idsMatch(sheetValue, typed) {
  const a = normId(sheetValue);
  const b = normId(typed);
  if (!a || !b) return false;
  if (a === b) return true;
  // "913" should match "ICMLDE-2026-913" and vice versa: compare the trailing number
  // (taken from the raw value so "ICMLDE-2026-913" gives 913, not 2026913)
  const numA = (String(sheetValue).trim().match(/(\d+)\D*$/) || [])[1];
  const numB = (String(typed).trim().match(/(\d+)\D*$/) || [])[1];
  const aIsNum = /^\d+$/.test(a);
  const bIsNum = /^\d+$/.test(b);
  if ((aIsNum || bIsNum) && numA && numB) return Number(numA) === Number(numB);
  return false;
}

function emailsMatch(sheetValue, typed) {
  const want = normEmail(typed);
  if (!want) return false;
  return String(sheetValue || '')
    .split(/[,;\s/]+/)
    .map(normEmail)
    .filter(Boolean)
    .includes(want);
}

/** Returns an array of matching receipts (a paper can have more than one payment). */
async function findReceipts(paperId, email) {
  const rows = await loadSheet();
  return rows
    .filter(r => idsMatch(r.paper_id, paperId) && emailsMatch(r.email, email))
    .map(r => ({
      paper_id: r.paper_id || '',
      name: r.name || '',
      // Echo back only the address the visitor typed, never other addresses in the cell
      email: normEmail(email),
      amount: r.amount || '',
      currency: r.currency || '',
      reference: r.reference || '',
      mode: r.mode || '',
      date: r.date || '',
      receipt_no: r.receipt_no || '',
      paper_title: r.paper_title || '',
      category: r.category || '',
      affiliation: r.affiliation || '',
      status: r.status || '',
      extra: r.extra
    }));
}

function clearCache() { cache = { at: 0, rows: null }; }

module.exports = { isConfigured, findReceipts, parseCsv, toCsvUrl, clearCache };
