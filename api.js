/* =====================================================================
 * QMI Desk – data layer (Repairs and Sales)
 * ---------------------------------------------------------------------
 * The UI (app.js) only talks to `RepairsApi`. Two adapters implement it:
 *   MockAdapter  – used by this preview. Works on DEMO_JOBS in memory.
 *   ZohoAdapter  – used when the widget runs inside Zoho CRM as a Web
 *                  Tab. Uses the Zoho Embedded App SDK (ZOHO.CRM.*).
 * The adapter is chosen automatically: if the Zoho SDK is present the
 * live adapter is used, otherwise the demo.
 *
 * Logging: every live call writes a console line with prefix
 * "[QMI Repairs Desk]". Server-side steps keep logging to the Creator
 * Sync Log through the existing CRM functions (fn_writeFunctionLog).
 * Change log:
 *   2026-10-26  Draft for review.
 *   2026-10-26  Add-on switch (isEnabled), quotes, extra lines.
 * ===================================================================== */

const LOG_PREFIX = '[QMI Desk] ';

// ---------- SECTION 1: MOCK ADAPTER (preview) ----------
const MockAdapter = {
  jobs: JSON.parse(JSON.stringify(DEMO_JOBS.concat(DEMO_SALES))),

  // isEnabled: add-on switch. Preview: add ?off to the URL to see the
  // switched-off screen.
  async isEnabled() { return !/[?&]off\b/.test(location.search); },

  // listJobs: all open Repairs Deals (live: Deals where Type = Repairs, layout Repairs V1)
  async listJobs() { return this.jobs; },

  // getAssets: the customer's Asset Register (live: Assets_Register by Account)
  // assets: per-customer Asset Register copies, so new assets persist in the demo session
  assets: JSON.parse(JSON.stringify(DEMO_ASSETS)),
  async getAssets(customer) {
    if (!this.assets[customer]) {
      this.assets[customer] = [
        { serial: 'DEMO-01', model: 'Q10 Atmospheric Sensor', productCode: 'Q10', vessel: 'Demo vessel', imo: '' },
        { serial: 'DEMO-02', model: 'Q02 Engine Detector', productCode: 'Q02', vessel: 'Demo vessel', imo: '' },
      ];
    }
    return this.assets[customer];
  },

  // createAsset: add a unit to the customer's Asset Register
  // (live: insertRecord Assets_Register – see ZohoAdapter.createAsset)
  async createAsset(job, a) {
    const list = await this.getAssets(job.customer);
    if (list.some((x) => x.serial.toLowerCase() === a.serial.toLowerCase())) throw new Error('Serial number ' + a.serial + ' is already on this customer\'s Asset Register.');
    list.push({ serial: a.serial, model: a.model, productCode: a.productCode, vessel: a.vessel, imo: a.imo, isNew: true });
    job.log.push({ when: nowText(), text: 'New asset ' + a.serial + ' (' + a.productCode + ') added to the Asset Register' });
    return list[list.length - 1];
  },

  // createRepair: new Repairs V1 Deal (live: ZOHO.CRM.API.insertRecord Deals)
  async createRepair(form) {
    const next = 25 + this.jobs.filter((j) => j.id.startsWith('n')).length;
    const job = {
      id: 'n' + next, process: 'repair', ref: 'SVC-2026-00' + next, customer: form.customer, contact: form.contact,
      terms: form.terms, priority: form.priority, notified: form.notified, stage: 'Repair Request Received',
      clientPo: form.clientPo, units: [], lines: [], docs: [], sync: {}, quote: null,
      email: (form.contact || 'contact').toLowerCase().replace(/[^a-z]+/g, '.') + '@' + form.customer.toLowerCase().replace(/[^a-z]+/g, '') + '.example',
      log: [{ when: nowText(), text: 'Repairs Deal created in Repairs Desk' }],
      country: CUSTOMER_COUNTRY[form.customer] || '', vat: (() => { const d = defaultVatFor(CUSTOMER_COUNTRY[form.customer]); return { id: d.id, source: 'country', note: d.note }; })(),
    };
    this.jobs.unshift(job);
    return job;
  },

  // createSales: new Spares / New System Deal at Enquiry Received
  // (live: insertRecord Deals with Type and the Standard layout)
  async createSales(form) {
    const job = {
      id: 'ns' + Date.now(), process: 'sales', dealType: form.dealType, ref: form.dealName, customer: form.customer, contact: form.contact,
      terms: form.terms, priority: 'Standard', notified: nowText().slice(0, 6) + ' 2026', stage: 'Enquiry Received', clientPo: '',
      units: [], lines: [], docs: [], sync: {}, packages: [], quote: null, invoice: null,
      email: (form.contact || 'contact').toLowerCase().replace(/[^a-z]+/g, '.') + '@' + form.customer.toLowerCase().replace(/[^a-z]+/g, '') + '.example',
      log: [{ when: nowText(), text: form.dealType + ' Deal created in QMI Desk' }],
      country: CUSTOMER_COUNTRY[form.customer] || '', vat: (() => { const d = defaultVatFor(CUSTOMER_COUNTRY[form.customer]); return { id: d.id, source: 'country', note: d.note }; })(),
    };
    this.jobs.unshift(job);
    return job;
  },

  // runRepairDetails: replicates the Repair Details kiosk.
  // live: updates each Asset (updateRepairAsset2), adds the repair line per
  // unit (fn_RepairLineItems1) + pack line (repairPackOnly), then completes
  // the "Repair Details" Blueprint transition.
  async runRepairDetails(job, selected) {
    job.units = selected.map((s) => ({ serial: s.serial, productCode: s.productCode, model: s.model, fault: s.fault || 'None known', portal: '–' }));
    job.lines = buildLinesForUnits(selected);
    job.stage = 'Service Reference Generated';
    job.log.push({ when: nowText(), text: 'Repair Details completed – ' + job.lines.length + ' line items created' });
    return job;
  },

  // runTransition: any other Blueprint step (live: ZOHO.CRM.API.updateBluePrint)
  async runTransition(job) {
    if (job.process === 'sales') return this.runSalesTransition(job);
    const i = STAGES.findIndex((s) => s.stage === job.stage);
    const current = STAGES[i];
    let next = STAGES[i + 1];
    // Credit customers skip the pre-pay stage
    if (current.stage === 'Quote Sent' && job.terms !== 'Due on Receipt') next = STAGES[i + 2];
    if (current.stage === 'Quote Sent' && job.terms === 'Due on Receipt') next = STAGES[i + 1];
    job.log.push({ when: nowText(), text: current.transition ? current.transition + ' completed' : current.stage + ' done' });
    // Simulated system/portal effects so the reviewer can follow the flow
    if (current.stage === 'Service Reference Generated') {
      const ref = 'QT-0002' + (20 + this.jobs.indexOf(job));
      job.docs.push({ type: 'Quote', ref });
      job.quote = makeQuote(ref, job.lines, 'Draft'); stampVat(job.quote, job);
    }
    if (current.stage === 'Quote Sent') { job.sync.job = 'Success'; job.units.forEach((x) => (x.portal = 'Awaiting goods')); }
    if (current.stage === 'Goods Received / GRN Issued') {
      const ref = 'PO-00' + (230 + this.jobs.indexOf(job));
      job.docs.push({ type: 'Cambertronics PO', ref });
      job.po = makePO(ref, job, 'Issued', nowText());
      job.log.push({ when: nowText(), text: 'Cambertronics PO ' + ref + ' issued (' + job.po.lines.length + ' lines) and added to the portal Job' });
      job.sync.po = 'Issued'; job.units.forEach((x) => (x.portal = 'Released for repair'));
    }
    if (current.stage === 'Package Ready' && !job.invoice) {
      const ref = 'INV-0001' + (40 + this.jobs.indexOf(job));
      job.docs.push({ type: 'Invoice', ref });
      job.invoice = makeInvoice(ref, job.lines, 'Draft'); stampVat(job.invoice, job);
      job.log.push({ when: nowText(), text: 'Invoice ' + ref + ' raised (draft) and added to the portal Job' });
    }
    job.stage = next.stage;
    return job;
  },

  // runSalesTransition: Sales (Pack Only) steps. Mirrors process_order_v2,
  // Books prepay_payment_received and fn_syncDealToPortal.
  async runSalesTransition(job) {
    const n = 40 + this.jobs.indexOf(job);
    const release = (why) => {
      job.docs.push({ type: 'Sales Order', ref: 'SO-002' + n }, { type: 'Pack-charge PO', ref: 'PO-002' + n }, { type: 'Package slip', ref: 'PKG-SO-002' + n });
      job.po = makePO('PO-002' + n, job, 'Issued', nowText());
      job.sync.job = 'Success'; job.sync.po = 'Issued';
      job.log.push({ when: nowText(), text: why + ' – SO-002' + n + ' and pack-charge PO-002' + n + ' created' });
      job.log.push({ when: nowText(), text: 'Order Confirmed – portal Pack Only Job created, Deal moved to Picklist Sent' });
      job.stage = 'Picklist Sent';
    };
    switch (job.stage) {
      case 'Enquiry Received': {
        if (!job.lines.length) throw new Error('Add at least one product first');
        const ref = 'QT-0002' + n;
        job.docs.push({ type: 'Quote', ref });
        job.quote = makeQuote(ref, job.lines, 'Draft'); stampVat(job.quote, job);
        job.log.push({ when: nowText(), text: 'Quote ' + ref + ' created' });
        job.stage = 'Quote Drafting';
        break;
      }
      case 'Quote Sent':
      case 'Order Blocked':
        if (job.terms === 'Due on Receipt') {
          const ref = 'INV-0001' + n;
          job.docs.push({ type: 'Pre-payment invoice', ref });
          job.invoice = makeInvoice(ref, job.lines, 'Draft', 'Pre-payment invoice'); stampVat(job.invoice, job);
          job.log.push({ when: nowText(), text: 'PO Received – pre-pay invoice ' + ref + ' raised' });
          job.stage = 'Pre-Pay Awaiting Payment';
        } else {
          release('PO Received – credit check passed');
        }
        break;
      case 'Pre-Pay Awaiting Payment':
        job.log.push({ when: nowText(), text: 'Payment recorded in Books' });
        release('Books released the order');
        break;
      case 'Package Ready':
        if (!job.invoice) {
          const ref = 'INV-0001' + n;
          job.docs.push({ type: 'Invoice', ref });
          job.invoice = makeInvoice(ref, job.lines, 'Draft'); stampVat(job.invoice, job);
          job.log.push({ when: nowText(), text: 'Invoice ' + ref + ' raised (draft)' });
        }
        job.log.push({ when: nowText(), text: 'Courier confirmed – Airway Bill sent to the portal' });
        job.stage = 'Shipping Instructions Received';
        break;
      default:
        throw new Error('No QMI step at ' + job.stage);
    }
    return job;
  },

  // refreshQuote: rebuild the draft quote from the current line items
  // (live: create_estimate updates the Books Estimate from Items Required)
  async refreshQuote(job) {
    job.quote = makeQuote(job.quote.number, job.lines.filter((l) => l.source !== 'repair'), job.quote.status === 'Sent' ? 'Draft' : job.quote.status); stampVat(job.quote, job);
    stampVat(job.quote, job);
    job.log.push({ when: nowText(), text: 'Quote ' + job.quote.number + ' updated from the line items and VAT' });
    return job;
  },

  // sendQuote: email the quote to the customer, then move the Deal on
  // (live: POST books/v3/estimates/{id}/email, then Blueprint "Quote Sent")
  async sendQuote(job, mail) {
    job.quote.status = 'Sent';
    job.quote.sentOn = nowText();
    job.log.push({ when: nowText(), text: 'Quote ' + job.quote.number + ' emailed to ' + mail.to });
    if (job.stage === 'Quote Drafting') job.stage = 'Quote Sent';
    return job;
  },

  // setVat: change the VAT treatment (user override or back to the Account default)
  // live: updates the Deal VAT fields; the next quote / draft invoice uses the matching Books tax_id
  async setVat(job, id, source, note) {
    const before = vatOption(job.vat.id).short;
    job.vat = { id, source, note };
    if (job.quote && job.quote.status === 'Draft') stampVat(job.quote, job);
    if (job.invoice && job.invoice.status === 'Draft') stampVat(job.invoice, job);
    job.log.push({ when: nowText(), text: 'VAT changed from ' + before + ' to ' + vatOption(id).short + (source === 'user' ? ' – reason: ' + note : ' (Account default)') });
    return job;
  },

  // sendInvoice: email the invoice to the customer
  // (live: POST books/v3/invoices/{id}/email – marks it Sent in Books)
  async sendInvoice(job, mail) {
    job.invoice.status = 'Sent';
    job.invoice.sentOn = nowText();
    job.log.push({ when: nowText(), text: job.invoice.kind + ' ' + job.invoice.number + ' emailed to ' + mail.to });
    return job;
  },

  // simulatePortal: demo-only – plays the Cambertronics side so the
  // reviewer can move a job forward without the portal.
  async simulatePortal(job) {
    if (job.process === 'sales') {
      const salesMsg = { 'Picklist Sent': 'Cambertronics clicked Picked and Packed – 1 box', 'Shipping Instructions Received': 'Cambertronics clicked Docs Attached to Parcel', 'Ready to Ship': 'Cambertronics clicked Collected' };
      if (job.stage === 'Picklist Sent') job.packages = [{ box: 'Box 1', type: 'Carton', size: '40 × 30 × 25 cm', weight: '3.6 kg' }];
      job.log.push({ when: nowText(), text: salesMsg[job.stage] || 'Portal step done' });
      const k = SALES_STAGES.findIndex((s) => s.stage === job.stage);
      job.stage = SALES_STAGES[k + 1].stage;
      return job;
    }
    const effects = {
      'Goods in Transit': () => { job.docs.push({ type: 'Goods Receipt', ref: 'GRN-2026-00' + (30 + this.jobs.indexOf(job)) }); job.units.forEach((x) => (x.portal = 'Goods received')); },
      'Cambertronics PO Issued': () => { job.lines.push({ code: 'Q10IG', name: 'Q10 Inspection Gasket', serial: job.units[0] ? job.units[0].serial : '', qty: 1, price: 0, source: 'repair' }); job.units.forEach((x) => (x.portal = 'Complete')); },
      'Repair Complete': () => { job.package = { cartons: 1, weight: '5.8 kg', size: '40 × 30 × 30 cm' }; job.units.forEach((x) => (x.portal = 'Packed')); },
      'Ready to Ship': () => {},
    };
    const msg = {
      'Goods in Transit': 'Cambertronics confirmed Goods Receipt',
      'Cambertronics PO Issued': 'Cambertronics clicked Repair Complete – 1 part added',
      'Repair Complete': 'Cambertronics clicked Prepare for Shipping',
      'Ready to Ship': 'Parcel collected',
    };
    if (effects[job.stage]) effects[job.stage]();
    job.log.push({ when: nowText(), text: msg[job.stage] || 'Portal step done' });
    const i = STAGES.findIndex((s) => s.stage === job.stage);
    job.stage = STAGES[i + 1].stage;
    return job;
  },
};

// ---------- SECTION 2: LIVE ADAPTER ----------
// Not included in the public demo build.

// ---------- SECTION 3: ADAPTER SELECTION ----------
const RepairsApi = MockAdapter;
const IS_DEMO = RepairsApi === MockAdapter;

function nowText() {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toTimeString().slice(0, 5);
}
