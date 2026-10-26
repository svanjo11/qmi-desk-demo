/* =====================================================================
 * QMI Repairs Desk – process model and demo data
 * ---------------------------------------------------------------------
 * PROCESS  : the Repairs V1 Blueprint stages in order, grouped into
 *            phases, with the owner of the next step and the action the
 *            widget offers. This is the single source of truth for the
 *            stepper, the "Next step" card and the list filters.
 * DEMO     : sample jobs used by the preview (MockAdapter). The live
 *            widget replaces these with CRM data (ZohoAdapter in api.js).
 * Change log:
 *   2026-10-26  Draft for review.
 * ===================================================================== */

// ---------- SECTION 1: PHASES (top-level stepper) ----------
// id: internal key | label: shown in the stepper
const PHASES = [
  { id: 'book', label: 'Book in' },
  { id: 'quote', label: 'Quote' },
  { id: 'inbound', label: 'Goods in' },
  { id: 'repair', label: 'Repair' },
  { id: 'outbound', label: 'Ship out' },
  { id: 'closed', label: 'Closed' },
];

// ---------- SECTION 2: STAGES (Repairs V1 Blueprint) ----------
// stage   : exact CRM Deal stage name
// phase   : PHASES id
// owner   : who does the next step – 'qmi' | 'cam' (Cambertronics) | 'done'
// action  : the one thing to do now (button label), or null when the user waits
// transition: CRM Blueprint transition the live widget runs
// help    : one-line instruction shown under the button
const STAGES = [
  { stage: 'Repair Request Received', phase: 'book', owner: 'qmi', action: 'Add units (Repair Details)', transition: 'Repair Details', help: 'Pick the customer\'s units and enter each fault. The line items are created for you.' },
  { stage: 'Service Reference Generated', phase: 'quote', owner: 'qmi', action: 'Create Quote', transition: 'Create Quote', help: 'The repair lines are ready. Add any extra items if needed, then create the quote.' },
  { stage: 'Quote Drafting', phase: 'quote', owner: 'qmi', action: 'Review and send quote', transition: 'Quote Sent', help: 'Check the quote, then email it to the customer from here.' },
  { stage: 'Quote Sent', phase: 'quote', owner: 'qmi', action: 'Send Customer Acknowledgement', transition: 'Send Customer Acknowledgement', help: 'Emails the Service Reference and creates the Cambertronics portal Job. Pre-pay customers: raise the pre-payment invoice first.' },
  { stage: 'Pre-Pay Awaiting Payment', phase: 'quote', owner: 'qmi', action: 'Pre-Payment Invoice Paid', transition: 'Pre-Payment Invoice Paid', help: 'Click once Finance confirm the payment has arrived.' },
  { stage: 'Acknowledgement Sent', phase: 'inbound', owner: 'qmi', action: 'Record Goods In Transit', transition: 'Goods In Transit', help: 'Enter the expected date and carrier once the customer has sent the units.' },
  { stage: 'Goods in Transit', phase: 'inbound', owner: 'cam', action: null, transition: null, help: 'Waiting for Cambertronics to confirm Goods Receipt in the portal.' },
  { stage: 'Goods Received / GRN Issued', phase: 'repair', owner: 'qmi', action: 'Issue Cambertronics PO', transition: 'Issue Cambertronics PO', help: 'Creates the PO (labour per unit + pack charge) and releases the units to Cambertronics.' },
  { stage: 'Cambertronics PO Issued', phase: 'repair', owner: 'cam', action: null, transition: null, help: 'Cambertronics are repairing the units. Extra parts they use are added for you.' },
  { stage: 'Repair Complete', phase: 'repair', owner: 'cam', action: null, transition: null, help: 'Cambertronics are packing. Sizes and weights appear here when they finish.' },
  { stage: 'Package Ready', phase: 'outbound', owner: 'qmi', action: 'Confirm Courier and Invoice Customer', transition: 'Confirm Courier and Invoice Customer', help: 'Book the courier, then upload the Airway Bill. The invoice is raised for you.' },
  { stage: 'Invoice Issued', phase: 'outbound', owner: 'qmi', action: 'Review and email invoice', transition: null, help: 'Check the invoice, then email it to the customer from here. Cambertronics attach the documents to the parcel.' },
  { stage: 'Ready to Ship', phase: 'outbound', owner: 'cam', action: null, transition: null, help: 'Waiting for the courier or customer to collect the parcel.' },
  { stage: 'Dispatched', phase: 'closed', owner: 'done', action: null, transition: null, help: 'The repair is complete.' },
];

// ---------- SECTION 3: REPAIR LINE RULES (mirrors fn_RepairLineItems1) ----------
// Unit product code -> repair line created by Repair Details.
// salePrice: customer price (Books rate). Pack line is added once per Deal.
const REPAIR_LINE_RULES = {
  Q10: { code: 'Q1001', name: 'Atmospheric Sensor Repair', salePrice: 330, purchasePrice: 75 },
  Q02: { code: 'Q0201', name: 'Engine Detector Repair', salePrice: 225, purchasePrice: 75 },
};
const PACK_LINE = { code: 'PO', name: 'Pack Only - Repairs', salePrice: 40, purchasePrice: 25 };
// Pack charge on Sales (Spares / New System) POs – Books "Pack Only - Packaging"
const SALES_PACK_LINE = { code: 'PKO', name: 'Pack Only - Packaging', purchasePrice: 22 };
const VENDOR = 'Cambertronics Ltd';

// Extra items a user may add by hand AFTER Repair Details has created the
// repair lines (demo catalogue; live = CRM Products lookup).
const EXTRA_PRODUCTS = [
  { code: 'OP133', name: 'OPTO OP133 - For Clear Lens', salePrice: 6.6 },
  { code: 'Q10LG', name: 'Q10 Lid Cover Gasket', salePrice: 0 },
  { code: 'Q10IG', name: 'Q10 Inspection Gasket', salePrice: 0 },
  { code: 'LABSD', name: 'Labour charge - Adding Shutdown', salePrice: 240 },
  { code: 'CP', name: 'Carriage & Packing', salePrice: 18 },
];

// ---------- SECTION 4: DEMO DATA ----------
// Customers' asset registers (what Repair Details lets you pick from)
const DEMO_ASSETS = {
  'Northsea Shipping Ltd': [
    { serial: 'A2246', model: 'Q10 Atmospheric Sensor', productCode: 'Q10', vessel: 'MV Aurora', imo: '9312456' },
    { serial: 'A2256', model: 'Q10 Atmospheric Sensor', productCode: 'Q10', vessel: 'MV Aurora', imo: '9312456' },
    { serial: '4410', model: 'Q02 Engine Detector', productCode: 'Q02', vessel: 'MV Aurora', imo: '9312456' },
    { serial: '4472', model: 'Q02 Engine Detector', productCode: 'Q02', vessel: 'MV Borealis', imo: '9420113' },
  ],
};

// Helper: build repair lines for a list of units (used by demo + Repair Details)
function buildLinesForUnits(units) {
  const lines = units.map((u) => {
    const rule = REPAIR_LINE_RULES[u.productCode];
    return { code: rule.code, name: rule.name, serial: u.serial, qty: 1, price: rule.salePrice, source: 'blueprint' };
  });
  lines.push({ code: PACK_LINE.code, name: PACK_LINE.name, serial: '', qty: 1, price: PACK_LINE.salePrice, source: 'blueprint' });
  return lines;
}

// ---------- SECTION 3B: VAT TREATMENT ----------
// The Account's country sets the default VAT treatment for the quote and
// invoice. The user can override it with a reason (logged on the Deal).
// booksTax: the active Books tax (Books → Settings → Taxes, 26-Oct-2026:
// "Standard Rate" 20% and "Zero Rate" 0%). Rule: UK orders 20%, all others 0%. Cambertronics POs always carry UK purchase
// VAT (20%) because Cambertronics is a UK supplier.
const VAT_OPTIONS = [
  { id: 'std20', label: 'Standard Rate (20%)', short: 'Standard Rate 20%', rate: 0.2, booksTax: 'Standard Rate' },
  { id: 'zero', label: 'Zero Rate (0%)', short: 'Zero Rate 0%', rate: 0, booksTax: 'Zero Rate' },
];
const UK_COUNTRIES = ['united kingdom', 'uk', 'great britain', 'gb', 'england', 'scotland', 'wales', 'northern ireland'];
function vatOption(id) { return VAT_OPTIONS.find((o) => o.id === id) || VAT_OPTIONS[0]; }
// defaultVatFor: UK (or no country on the Account) -> Standard Rate 20%; any other country -> Zero Rate 0%
function defaultVatFor(country) {
  const c = String(country || '').trim().toLowerCase();
  if (!c) return { id: 'std20', note: 'No country on the Account – 20% used. Add the country to the Account.' };
  if (UK_COUNTRIES.includes(c)) return { id: 'std20', note: 'UK order' };
  return { id: 'zero', note: 'Order from outside the UK (' + country + ')' };
}
// stampVat: apply the job's VAT treatment to a quote or invoice
function stampVat(doc, job) {
  if (!doc) return doc;
  const opt = vatOption(job.vat ? job.vat.id : 'std20');
  doc.vatId = opt.id; doc.vatShort = opt.short; doc.vatLabel = opt.label; doc.vatRate = opt.rate;
  doc.vat = doc.subtotal * opt.rate; doc.total = doc.subtotal + doc.vat;
  return doc;
}
// Demo Account countries (live: Accounts.Billing_Country)
const CUSTOMER_COUNTRY = { 'Northsea Shipping Ltd': 'Norway', 'Baltic Marine Services': 'Lithuania', 'Demo Generation Ltd': 'United Kingdom', 'QMI TEST': 'United Kingdom' };

// Quote (Zoho Books Estimate) snapshot of the line items. VAT from stampVat().
// live: GET books/v3/estimates/{Estimate_ID}
const VAT_RATE = 0.2;
function makeQuote(number, lines, status, sentOn) {
  const subtotal = lines.reduce((t, l) => t + l.qty * l.price, 0);
  return {
    number, status, sentOn: sentOn || '', date: '26 Oct 2026', expiry: '25 Nov 2026',
    lines: lines.map((l) => ({ ...l })), subtotal, vat: subtotal * VAT_RATE, total: subtotal * (1 + VAT_RATE),
  };
}

// Invoice (Zoho Books Invoice) – built from ALL line items, including the
// parts Cambertronics added at Repair Complete.
// live: GET books/v3/invoices/{Invoice_ID}
// Cambertronics Purchase Order (Zoho Books PO). Rules = fn_process_repair_po
// and the Sales pack-charge PO (process_order_v2_credit_docs):
//   Repairs: one LABOUR line per unit at the purchase price + Pack Only - Repairs.
//            Parts are never on the PO (QMI stock).
//   Sales  : one line, Pack Only - Packaging (pack charge).
// live: GET books/v3/purchaseorders?purchaseorder_number=...
function makePO(number, job, status, issuedOn) {
  let lines;
  if (job.process === 'sales') {
    lines = [{ code: SALES_PACK_LINE.code, name: SALES_PACK_LINE.name, serial: '', qty: 1, price: SALES_PACK_LINE.purchasePrice, note: 'Pick and pack ' + job.ref }];
  } else {
    const labourCodes = Object.values(REPAIR_LINE_RULES).map((r) => r.code);
    lines = job.lines.filter((l) => labourCodes.includes(l.code) && l.source !== 'repair').map((l) => {
      const rule = Object.values(REPAIR_LINE_RULES).find((r) => r.code === l.code);
      return { code: l.code, name: l.name + ' – labour', serial: l.serial, qty: l.qty, price: rule.purchasePrice };
    });
    lines.push({ code: PACK_LINE.code, name: PACK_LINE.name, serial: '', qty: 1, price: PACK_LINE.purchasePrice, note: 'Units (' + job.units.length + '): ' + job.units.map((x) => x.serial).join(', ') });
  }
  const subtotal = lines.reduce((t, l) => t + l.qty * l.price, 0);
  return { number, status: status || 'Issued', issuedOn: issuedOn || '', vendor: VENDOR, lines, subtotal, vat: subtotal * VAT_RATE, total: subtotal * (1 + VAT_RATE) };
}

function makeInvoice(number, lines, status, kind, sentOn) {
  const doc = makeQuote(number, lines, status, sentOn);
  doc.kind = kind || 'Invoice';
  doc.date = '26 Oct 2026';
  doc.expiry = '';
  return doc;
}

const u = (serial, productCode, fault, portal) => ({
  serial, productCode, fault, portal,
  model: productCode === 'Q10' ? 'Q10 Atmospheric Sensor' : 'Q02 Engine Detector',
});

// Each job = one Repairs Deal. Fields mirror the CRM Deal + portal Job.
const DEMO_JOBS_RAW = [
  {
    id: 'd1', ref: 'SVC-2026-0024', customer: 'Northsea Shipping Ltd', contact: 'Ola Hansen', terms: 'Net 30',
    priority: 'Standard', notified: '26 Oct 2026', stage: 'Repair Request Received', clientPo: '',
    units: [], lines: [], docs: [], sync: {},
    log: [{ when: '26 Oct 09:12', text: 'Repairs Deal created' }],
  },
  {
    id: 'd2', ref: 'SVC-2026-0023', customer: 'Baltic Marine Services', contact: 'Jonas Berg', terms: 'Due on Receipt',
    priority: 'Urgent', notified: '22 Oct 2026', stage: 'Pre-Pay Awaiting Payment', clientPo: 'BMS-7781',
    units: [u('A5048', 'Q10', 'No reading on display', '–')],
    lines: buildLinesForUnits([{ serial: 'A5048', productCode: 'Q10' }]),
    docs: [{ type: 'Quote', ref: 'QT-000214' }, { type: 'Pre-payment invoice', ref: 'INV-000131' }],
    sync: {},
    log: [{ when: '22 Oct 10:02', text: 'Repair Details completed – 2 lines created' }, { when: '22 Oct 10:20', text: 'Quote QT-000214 sent' }, { when: '23 Oct 08:41', text: 'Pre-payment invoice INV-000131 raised' }],
  },
  {
    id: 'd3', ref: 'SVC-2026-0021', customer: 'Demo Generation Ltd', contact: 'Kate Moore', terms: 'Net 30',
    priority: 'Standard', notified: '15 Oct 2026', stage: 'Goods Received / GRN Issued', clientPo: 'TBC',
    units: [u('3418', 'Q02', 'None known', 'On Hold'), u('5164', 'Q02', 'None known', 'On Hold'), u('5207', 'Q02', 'None known', 'On Hold'), u('3839', 'Q02', 'None known', 'On Hold')],
    lines: buildLinesForUnits([{ serial: '3418', productCode: 'Q02' }, { serial: '5164', productCode: 'Q02' }, { serial: '5207', productCode: 'Q02' }, { serial: '3839', productCode: 'Q02' }]),
    docs: [{ type: 'Quote', ref: 'QT-000209' }, { type: 'Goods Receipt', ref: 'GRN-2026-0019' }],
    sync: { job: 'Success', po: 'Not issued' },
    log: [{ when: '20 Oct 11:44', text: 'Portal Job created – 4 units' }, { when: '20 Oct 11:55', text: 'Cambertronics confirmed Goods Receipt GRN-2026-0019' }],
  },
  {
    id: 'd4', ref: 'SVC-2026-0019', customer: 'QMI TEST', contact: 'Kathryn Smith', terms: 'Net 30',
    priority: 'Critical', notified: '12 Oct 2026', stage: 'Repair Complete', clientPo: 'PO22233',
    units: [u('TEST001', 'Q10', 'Intermittent fault', 'Complete'), u('AAAAA', 'Q10', 'Lens cracked', 'Complete')],
    lines: [
      ...buildLinesForUnits([{ serial: 'TEST001', productCode: 'Q10' }, { serial: 'AAAAA', productCode: 'Q10' }]),
      { code: 'OP133', name: 'OPTO OP133 - For Clear Lens', serial: 'TEST001', qty: 1, price: 6.6, source: 'repair' },
      { code: 'Q10LG', name: 'Q10 Lid Cover Gasket', serial: 'TEST001', qty: 1, price: 0, source: 'repair' },
    ],
    docs: [{ type: 'Quote', ref: 'QT-000201' }, { type: 'Goods Receipt', ref: 'GRN-2026-0017' }, { type: 'Cambertronics PO', ref: 'PO-00208' }],
    sync: { job: 'Success', po: 'Issued' },
    log: [{ when: '14 Oct 07:38', text: 'PO-00208 issued – units released' }, { when: '17 Oct 15:10', text: 'Cambertronics clicked Repair Complete – 2 parts added' }],
  },
  {
    id: 'd5', ref: 'SVC-2026-0017', customer: 'QMI TEST', contact: 'Kathryn Smith', terms: 'Net 30',
    priority: 'Urgent', notified: '05 Oct 2026', stage: 'Package Ready', clientPo: 'fff4444',
    units: [u('TEST001', 'Q10', 'Calibration drift', 'Packed'), u('AAAAA', 'Q10', 'No output', 'Packed')],
    lines: buildLinesForUnits([{ serial: 'TEST001', productCode: 'Q10' }, { serial: 'AAAAA', productCode: 'Q10' }]),
    docs: [{ type: 'Quote', ref: 'QT-000188' }, { type: 'Goods Receipt', ref: 'GRN-2026-0018' }, { type: 'Cambertronics PO', ref: 'PO-00206' }],
    sync: { job: 'Success', po: 'Issued' },
    package: { cartons: 1, weight: '6.4 kg', size: '40 × 30 × 30 cm' },
    log: [{ when: '06 Oct 08:02', text: 'Cambertronics clicked Prepare for Shipping – 1 carton, 6.4 kg' }],
  },
  {
    id: 'd7', ref: 'SVC-2026-0015', customer: 'QMI TEST', contact: 'Kathryn Smith', terms: 'Net 30',
    priority: 'Standard', notified: '29 Sep 2026', stage: 'Invoice Issued', clientPo: 'SVC-2026-0015- Repair',
    units: [u('AAAAA', 'Q10', 'Sensor drift', 'Packed'), u('TEST001', 'Q10', 'No output', 'Packed')],
    lines: [
      ...buildLinesForUnits([{ serial: 'AAAAA', productCode: 'Q10' }, { serial: 'TEST001', productCode: 'Q10' }]),
      { code: 'OP133', name: 'OPTO OP133 - For Clear Lens', serial: 'TEST001', qty: 1, price: 6.6, source: 'repair' },
    ],
    docs: [{ type: 'Quote', ref: 'QT-000176' }, { type: 'Goods Receipt', ref: 'GRN-2026-0015' }, { type: 'Cambertronics PO', ref: 'PO-00206' }, { type: 'Invoice', ref: 'INV-000114' }],
    sync: { job: 'Success', po: 'Issued', shipping: 'Success' },
    draftInvoice: true,
    log: [{ when: '02 Oct 10:27', text: 'Courier confirmed – Airway Bill sent to the portal' }, { when: '02 Oct 10:27', text: 'Invoice INV-000114 raised (draft) and added to the portal Job' }],
  },
  {
    id: 'd6', ref: 'SVC-2026-0016', customer: 'Baltic Marine Services', contact: 'Jonas Berg', terms: 'Net 60',
    priority: 'Standard', notified: '02 Oct 2026', stage: 'Goods in Transit', clientPo: 'PO1112',
    units: [u('4410', 'Q02', 'Alarm stuck on', 'Awaiting goods')],
    lines: buildLinesForUnits([{ serial: '4410', productCode: 'Q02' }]),
    docs: [{ type: 'Quote', ref: 'QT-000184' }],
    sync: { job: 'Success' },
    log: [{ when: '03 Oct 12:20', text: 'Goods In Transit recorded – DHL, expected 05 Oct' }],
  },
];

// Attach a quote to every demo job that already has one, then expose DEMO_JOBS
function prepareDemoJob(j0) {
  const country = CUSTOMER_COUNTRY[j0.customer] || '';
  const d = defaultVatFor(country);
  const j = { ...j0, country, vat: { id: d.id, source: 'country', note: d.note } };
  const q = j.docs.find((d) => d.type === 'Quote');
  const contactEmail = j.contact.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + j.customer.toLowerCase().replace(/[^a-z]+/g, '') + '.example';
  const quoteLines = j.lines.filter((l) => l.source !== 'repair');
  const inv = j.docs.find((d) => /invoice/i.test(d.type));
  const poDoc = j.docs.find((d) => /PO$/.test(d.type));
  return {
    ...j, email: contactEmail,
    quote: q ? stampVat(makeQuote(q.ref, quoteLines, 'Sent', q.ref === 'QT-000214' ? '22 Oct 2026' : '—'), j) : null,
    po: poDoc ? makePO(poDoc.ref, j, 'Issued', '—') : null,
    invoice: inv ? stampVat(makeInvoice(inv.ref, j.lines, j.draftInvoice ? 'Draft' : 'Sent', inv.type === 'Pre-payment invoice' ? 'Pre-payment invoice' : 'Invoice', '23 Oct 2026'), j) : null,
  };
}
const DEMO_JOBS = DEMO_JOBS_RAW.map((j) => prepareDemoJob({ process: 'repair', ...j }));
