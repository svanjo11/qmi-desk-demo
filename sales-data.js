/* =====================================================================
 * QMI Desk – Sales process model and demo data
 * ---------------------------------------------------------------------
 * Covers Spares and New System Deals, which become "Pack Only" Jobs in
 * the Cambertronics portal (Sales Job Management blueprint, Creator
 * Development / CRM Sandbox "Pre_Prod 0626"). Kari never goes to the
 * portal, so Kari Deals are not shown here.
 * Source: QMI Pack Only Portal Specification v1.0 (20-22 Oct 2026).
 * Change log:
 *   2026-10-26  Draft for review.
 * ===================================================================== */

// ---------- SECTION 1: SALES PHASES ----------
const SALES_PHASES = [
  { id: 'enquiry', label: 'Enquiry' },
  { id: 'quote', label: 'Quote' },
  { id: 'order', label: 'Order' },
  { id: 'pack', label: 'Pick & pack' },
  { id: 'ship', label: 'Ship out' },
  { id: 'closed', label: 'Closed' },
];

// ---------- SECTION 2: SALES STAGES ----------
// stage  : step shown in the desk (CRM Deal stage unless `crm` says otherwise)
// crm    : CRM Deal stage while at this step (when different from `stage`)
// portal : Pack Only Job stage in the Cambertronics portal
// owner / action / transition / help: as for Repairs (data.js)
const SALES_STAGES = [
  { stage: 'Enquiry Received', phase: 'enquiry', owner: 'qmi', action: 'Create Quote', transition: 'Create Quote', portal: '–', help: 'Add the products the customer wants, then create the quote.' },
  { stage: 'Quote Drafting', phase: 'quote', owner: 'qmi', action: 'Review and send quote', transition: 'Quote Sent', portal: '–', help: 'Check the quote, then email it to the customer from here.' },
  { stage: 'Quote Sent', phase: 'quote', owner: 'qmi', action: 'PO Received', transition: 'PO Received', portal: '–', help: 'When the customer confirms, enter their PO number. The order process checks credit and creates the order documents.' },
  { stage: 'Pre-Pay Awaiting Payment', phase: 'order', owner: 'qmi', action: 'Payment received', transition: 'Payment Made', portal: '–', help: 'Once Finance confirm the payment, Books releases the package and the pack-charge PO.' },
  { stage: 'Order Blocked', phase: 'order', owner: 'qmi', action: 'Re-run order process', transition: 'PO Received', portal: '–', help: 'Credit limit exceeded or payment terms not recognised. Fix it on the Account, then re-run.' },
  { stage: 'Picklist Sent', phase: 'pack', owner: 'cam', action: null, transition: null, portal: 'Awaiting Picking', help: 'Cambertronics have the pick list, pack-charge PO and package slip. Waiting for Picked and Packed.' },
  { stage: 'Package Ready', phase: 'ship', owner: 'qmi', action: 'Confirm Courier and Invoice Customer', transition: 'Confirm Courier and Invoice Customer', portal: 'Package Ready', help: 'Book the courier using the box sizes, then upload the Airway Bill. Credit orders are invoiced here.' },
  { stage: 'Shipping Instructions Received', crm: 'Package Ready', phase: 'ship', owner: 'cam', action: null, transition: null, portal: 'Shipping Instructions Received', help: 'Cambertronics attach the Airway Bill and documents to the parcel.' },
  { stage: 'Ready to Ship', phase: 'ship', owner: 'cam', action: null, transition: null, portal: 'Ready to Ship', help: 'Waiting for the courier or customer to collect the parcel.' },
  { stage: 'Dispatched', phase: 'closed', owner: 'done', action: null, transition: null, portal: 'Collected / Dispatched', help: 'The order has been dispatched.' },
];

// Products a user can add to a Sales Deal (demo catalogue; live = CRM Products)
const SALES_PRODUCTS = [
  { code: 'Q0114', name: '1.25 Amp Fuse for FS1 Monitor Power Supply (Pack of 5)', salePrice: 3.1 },
  { code: 'Q0112', name: '400 mA Anti-Surge Fuse (Pack of 5)', salePrice: 3.4 },
  { code: 'OP133', name: 'OPTO OP133 - For Clear Lens', salePrice: 6.6 },
  { code: 'Q10LG', name: 'Q10 Lid Cover Gasket', salePrice: 12 },
  { code: 'Q10', name: 'Q10 Atmospheric Sensor (New System)', salePrice: 2850 },
  { code: 'CP', name: 'Carriage & Packing', salePrice: 18 },
];

// ---------- SECTION 3: SALES DEMO JOBS ----------
const sl = (code, qty) => { const p = SALES_PRODUCTS.find((x) => x.code === code); return { code, name: p.name, serial: '', qty, price: p.salePrice, source: 'manual' }; };

const DEMO_SALES_RAW = [
  {
    id: 's1', process: 'sales', dealType: 'Spares', ref: 'Q10 spares – MV Aurora', customer: 'Northsea Shipping Ltd', contact: 'Ola Hansen', terms: 'Net 30',
    priority: 'Standard', notified: '26 Oct 2026', stage: 'Enquiry Received', clientPo: '', lines: [], docs: [], sync: {}, packages: [],
    log: [{ when: '26 Oct 08:30', text: 'Spares Deal created' }],
  },
  {
    id: 's2', process: 'sales', dealType: 'Spares', ref: 'Fuses and gaskets', customer: 'Baltic Marine Services', contact: 'Jonas Berg', terms: 'Net 60',
    priority: 'Standard', notified: '21 Oct 2026', stage: 'Quote Sent', clientPo: '', lines: [sl('Q0114', 4), sl('Q0112', 4), sl('Q10LG', 2)],
    docs: [{ type: 'Quote', ref: 'QT-000221' }], sync: {}, packages: [],
    log: [{ when: '21 Oct 14:10', text: 'Quote QT-000221 sent' }],
  },
  {
    id: 's3', process: 'sales', dealType: 'New System', ref: 'Q10 system – MV Borealis', customer: 'Northsea Shipping Ltd', contact: 'Ola Hansen', terms: 'Net 30',
    priority: 'Urgent', notified: '19 Oct 2026', stage: 'Picklist Sent', clientPo: 'NS-4471', lines: [sl('Q10', 1), sl('CP', 1)],
    docs: [{ type: 'Quote', ref: 'QT-000217' }, { type: 'Sales Order', ref: 'SO-00246' }, { type: 'Pack-charge PO', ref: 'PO-00226' }, { type: 'Package slip', ref: 'PKG-SO-00246' }],
    sync: { job: 'Success', po: 'Issued' }, packages: [],
    log: [{ when: '22 Oct 09:02', text: 'PO Received – credit OK, SO-00246 and PO-00226 created' }, { when: '22 Oct 09:03', text: 'Portal Pack Only Job created – Deal moved to Picklist Sent' }],
  },
  {
    id: 's4', process: 'sales', dealType: 'Spares', ref: 'OPTO lenses x10', customer: 'Demo Generation Ltd', contact: 'Kate Moore', terms: 'Net 30',
    priority: 'Standard', notified: '15 Oct 2026', stage: 'Package Ready', clientPo: 'DG-20107', lines: [sl('OP133', 10)],
    docs: [{ type: 'Quote', ref: 'QT-000210' }, { type: 'Sales Order', ref: 'SO-00243' }, { type: 'Pack-charge PO', ref: 'PO-00223' }, { type: 'Package slip', ref: 'PKG-SO-00243' }],
    sync: { job: 'Success', po: 'Issued' }, packages: [{ box: 'Box 1', type: 'Carton', size: '30 × 20 × 15 cm', weight: '1.2 kg' }],
    log: [{ when: '24 Oct 15:40', text: 'Cambertronics clicked Picked and Packed – 1 box, 1.2 kg' }],
  },
  {
    id: 's5', process: 'sales', dealType: 'Spares', ref: 'Gaskets – pre-pay', customer: 'Baltic Marine Services', contact: 'Jonas Berg', terms: 'Due on Receipt',
    priority: 'Standard', notified: '23 Oct 2026', stage: 'Pre-Pay Awaiting Payment', clientPo: 'BMS-7790', lines: [sl('Q10LG', 6)],
    docs: [{ type: 'Quote', ref: 'QT-000219' }, { type: 'Pre-payment invoice', ref: 'INV-000133' }], sync: {}, packages: [],
    log: [{ when: '23 Oct 11:15', text: 'PO Received – pre-pay invoice INV-000133 raised' }],
  },
];

const DEMO_SALES = DEMO_SALES_RAW.map((j) => prepareDemoJob({ units: [], ...j }));

// ---------- SECTION 4: PROCESS LOOK-UP ----------
// procOf(job): stages, phases and labels for the job's process.
const PROCESSES = {
  repair: { id: 'repair', label: 'Repairs', stages: STAGES, phases: PHASES, noun: 'repair', newLabel: '+ New repair' },
  sales: { id: 'sales', label: 'Sales', stages: SALES_STAGES, phases: SALES_PHASES, noun: 'order', newLabel: '+ New sales order' },
};
function procOf(job) { return PROCESSES[job.process] || PROCESSES.repair; }
