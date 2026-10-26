/* =====================================================================
 * QMI Desk – UI (Repairs and Sales)
 * ---------------------------------------------------------------------
 * Screens : job list (left), job detail (right), New repair modal,
 *           Repair Details modal (replaces the CRM kiosk).
 * State   : `state` holds the job list, the selected job, the filter
 *           and the search text. Every change calls render().
 * Rule    : the first line items always come from Repair Details (one
 *           repair line per unit + the pack charge). Until then no line
 *           can be added by hand. After that the user may add EXTRA lines
 *           (parts, extra labour). Repair Details lines stay locked.
 *           Cambertronics' Repair Complete parts are added automatically.
 * Change log:
 *   2026-10-26  Draft for review.
 * ===================================================================== */

// ---------- SECTION 1: STATE ----------
// jobs: all repair jobs | selectedId: open job | filter: list tab | q: search
// process: 'repair' | 'sales' – which process the desk is showing
const state = { jobs: [], selectedId: null, filter: 'qmi', q: '', process: 'repair' };

const FILTERS = [
  { id: 'qmi', label: 'QMI to do', test: (j) => ownerOf(j) === 'qmi' },
  { id: 'cam', label: 'With Cambertronics', test: (j) => ownerOf(j) === 'cam' },
  { id: 'open', label: 'All open', test: (j) => ownerOf(j) !== 'done' },
  { id: 'closed', label: 'Closed', test: (j) => ownerOf(j) === 'done' },
];

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '£' + Number(n).toFixed(2);
function stageOf(job) { const st = procOf(job).stages; return st.find((s) => s.stage === job.stage) || st[0]; }
// ownerOf: who must act now. An invoice that hasn't been emailed is always a QMI to-do.
function ownerOf(job) {
  if (job.invoice && job.invoice.status === 'Draft' && stageOf(job).owner !== 'done') return 'qmi';
  return stageOf(job).owner;
}
const inProcess = (j) => j.process === state.process;
function ownerLabel(owner) { return owner === 'qmi' ? 'QMI to do' : owner === 'cam' ? 'Cambertronics' : 'Closed'; }

// ---------- SECTION 2: STARTUP ----------
async function start() {
  // Add-on switch: when off, show a short notice and stop. The Deal page,
  // Blueprint, kiosk and CRM functions keep working without the widget.
  if (!(await RepairsApi.isEnabled())) {
    document.querySelector('.workspace').innerHTML = `<div class="off"><div class="off-box">
      <h2>QMI Desk is switched off</h2>
      <p>Repairs and sales orders work as normal from the Deal page. On a Repairs Deal, click <strong>Repair Details</strong> first.</p>
      <p class="code">To turn the QMI Desk on, contact your system administrator.</p></div></div>`;
    $('#filters').hidden = true; document.querySelector('.topbar-actions').hidden = true;
    console.log(LOG_PREFIX + 'QMI Desk switched off');
    return;
  }
  if (IS_DEMO) {
    $('#demo-banner').hidden = false;
    $('#try-it').hidden = false; updateTryButton();
    $('#try-it').addEventListener('click', openTryIt);
    setTimeout(openTryIt, 400);   // show the tests straight away for first-time testers
  }
  state.jobs = await RepairsApi.listJobs();
  selectFirst();
  $('#search').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); renderList(); });
  $('#new-repair').addEventListener('click', () => (state.process === 'sales' ? openNewSales() : openNewRepair()));
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  render();
}

function selectFirst() {
  const mine = state.jobs.filter(inProcess);
  const pick = mine.find((j) => ownerOf(j) === 'qmi') || mine[0];
  state.selectedId = pick ? pick.id : null;
}

function render() { renderProcess(); renderFilters(); renderList(); renderDetail(); }

// ---------- SECTION 2B: PROCESS SWITCH (Repairs | Sales) ----------
function renderProcess() {
  $('#proc').innerHTML = Object.values(PROCESSES).map((p) => `<button role="tab" type="button" data-p="${p.id}" aria-selected="${state.process === p.id}">${esc(p.label)}</button>`).join('');
  $('#proc').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    if (state.process === b.dataset.p) return;
    state.process = b.dataset.p; state.filter = 'qmi'; selectFirst(); render();
  }));
  $('#new-repair').textContent = PROCESSES[state.process].newLabel;
  $('#search').placeholder = state.process === 'sales' ? 'Deal, customer, PO' : 'Ref, customer, serial';
}

// ---------- SECTION 3: FILTER TABS ----------
function renderFilters() {
  $('#filters').innerHTML = FILTERS.map((f) => {
    const n = state.jobs.filter(inProcess).filter(f.test).length;
    return `<button role="tab" type="button" data-f="${f.id}" aria-selected="${state.filter === f.id}">${esc(f.label)}<span class="count num">${n}</span></button>`;
  }).join('');
  $('#filters').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.f; render(); }));
}

// ---------- SECTION 4: JOB LIST ----------
function visibleJobs() {
  const f = FILTERS.find((x) => x.id === state.filter);
  return state.jobs.filter(inProcess).filter(f.test).filter((j) => {
    if (!state.q) return true;
    const hay = [j.ref, j.customer, j.clientPo, ...j.units.map((x) => x.serial)].join(' ').toLowerCase();
    return hay.includes(state.q);
  });
}

function renderList() {
  const jobs = visibleJobs();
  const noun = state.process === 'sales' ? 'order' : 'job';
  $('#list-count').textContent = jobs.length + ' ' + noun + (jobs.length === 1 ? '' : 's');
  if (!jobs.length) { $('#jobs').innerHTML = '<li class="empty-list">Nothing here.</li>'; return; }
  $('#jobs').innerHTML = jobs.map((j) => {
    const s = stageOf(j);
    return `<li><button class="job" type="button" data-id="${j.id}" aria-current="${j.id === state.selectedId}">
      <div class="job-top"><span class="job-ref">${esc(j.ref)}</span><span class="pill ${ownerOf(j)}">${ownerLabel(ownerOf(j))}</span></div>
      <div class="job-cust">${esc(j.customer)}</div>
      <div class="job-meta"><span class="job-stage">${esc(j.stage)}</span><span class="job-stage">· ${j.process === 'sales' ? esc(j.dealType) + ' · ' + j.lines.length + ' line' + (j.lines.length === 1 ? '' : 's') : j.units.length + ' unit' + (j.units.length === 1 ? '' : 's')}</span></div>
    </button></li>`;
  }).join('');
  $('#jobs').querySelectorAll('.job').forEach((b) => b.addEventListener('click', () => { state.selectedId = b.dataset.id; renderList(); renderDetail(); }));
}

// ---------- SECTION 5: JOB DETAIL ----------
function renderDetail() {
  const job = state.jobs.find((j) => j.id === state.selectedId);
  if (!job) { $('#detail').innerHTML = '<div class="empty"><strong>Nothing selected</strong>Pick one on the left or create a new one.</div>'; return; }
  const s = stageOf(job);
  $('#detail').innerHTML = `
    ${detailHeader(job)}
    ${stepper(job)}
    ${nextStep(job, s)}
    <div class="grid">
      ${linesCard(job)}
      ${quoteCard(job)}
      ${invoiceCard(job)}
      ${job.process === 'sales' ? packagesCard(job) : unitsCard(job)}
      ${docsCard(job)}
      ${activityCard(job)}
    </div>`;
  bindDetail(job, s);
}

function detailHeader(job) {
  return `<div class="d-head">
    <div>
      <h2 class="d-title">${esc(job.ref)} · ${esc(job.customer)}</h2>
      <div class="d-sub">
        ${job.process === 'sales' ? `<span class="pill plain qmi">${esc(job.dealType)}</span>` : ''}
        <span class="pill prio-${esc(job.priority)}">${esc(job.priority)}</span>
        <span>${esc(job.terms)}</span><span class="sep">|</span>
        <span>Contact: ${esc(job.contact)}</span><span class="sep">|</span>
        <span>Client PO: ${esc(job.clientPo || '–')}</span><span class="sep">|</span>
        <span>Notified ${esc(job.notified)}</span>
      </div>
    </div>
    <button class="link-btn" type="button" id="open-deal">Open CRM Deal ↗</button>
  </div>`;
}

function stepper(job) {
  const phases = procOf(job).phases;
  const idx = phases.findIndex((p) => p.id === stageOf(job).phase);
  return `<div class="stepper" aria-label="Progress">${phases.map((p, i) => {
    const cls = i < idx ? 'done' : i === idx ? (p.id === 'closed' ? 'done' : 'current') : '';
    return `<div class="phase ${cls}"><div class="bar"></div><div class="lbl">${esc(p.label)}</div></div>`;
  }).join('')}</div>`;
}

function nextStep(job, s) {
  const who = ownerOf(job);
  const kicker = who === 'qmi' ? 'Your next step' : who === 'cam' ? 'Waiting on Cambertronics' : 'Complete';
  let actions = '';
  if (s.action && job.stage === 'Repair Request Received') actions = `<button class="btn btn-primary" id="act-main" type="button">${esc(s.action)}</button>`;
  else if (s.action && s.transition) actions = `<button class="btn btn-primary" id="act-main" type="button">${esc(s.action)}</button>`;
  else if (s.action) actions = `<button class="btn btn-ghost" id="act-main" type="button">${esc(s.action)}</button>`;
  if (job.invoice && job.invoice.status === 'Draft' && job.stage !== 'Invoice Issued' && s.owner !== 'done') actions = `<button class="btn btn-primary" id="act-invoice" type="button">Email ${esc(job.invoice.kind.toLowerCase())}</button>` + actions;
  if (job.stage === 'Invoice Issued') actions += `<button class="btn btn-demo" id="act-demo-next" type="button">Demo: Cambertronics attach docs</button>`;
  if (s.owner === 'cam' && IS_DEMO) actions += `<button class="btn btn-demo" id="act-demo" type="button">Demo: do the portal step</button>`;
  let help = s.help;
  if (job.stage === 'Invoice Issued' && job.invoice && job.invoice.status === 'Sent') help = 'Invoice emailed. Waiting for Cambertronics to attach the documents to the parcel.';
  if (job.invoice && job.invoice.status === 'Draft' && job.stage !== 'Invoice Issued' && s.owner !== 'done') help = 'Email the ' + job.invoice.kind.toLowerCase() + ' ' + job.invoice.number + ' to the customer. ' + help;
  return `<div class="next ${who}">
    <div>
      <div class="next-kicker">${kicker}</div>
      <div class="next-stage">${esc(job.stage)}</div>
      ${s.portal && s.portal !== '–' ? `<div class="code">Portal Job: ${esc(s.portal)}${s.crm ? ' · CRM Deal stage: ' + esc(s.crm) : ''}</div>` : ''}
      <p class="next-help">${esc(help)}</p>
    </div>
    <div class="next-actions">${actions}</div>
  </div>`;
}

// Who added each line – shown in the "Added by" column
const SOURCE_LABEL = { blueprint: 'Repair Details', repair: 'Repair Complete', manual: 'Added by you' };

const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

// salesLinesOpen: Sales lines can be edited until the order is placed
function salesLinesOpen(job) { return job.process === 'sales' && ['enquiry', 'quote'].includes(stageOf(job).phase); }

function linesCard(job) {
  if (job.process === 'sales') return salesLinesCard(job);
  let body;
  if (!job.lines.length) {
    body = `<div class="empty"><strong>No line items yet</strong>They are created for you when you add the units with Repair Details.<br>
      <button class="btn btn-primary" type="button" id="lines-cta">Add units (Repair Details)</button></div>`;
  } else {
    const total = job.lines.reduce((t, l) => t + l.qty * l.price, 0);
    body = `<table>
      <thead><tr><th>Item</th><th>Serial</th><th class="r">Qty</th><th class="r">Price</th><th>Added by</th></tr></thead>
      <tbody>${job.lines.map((l) => `<tr>
        <td>${esc(l.name)}<div class="code">${esc(l.code)}</div></td>
        <td class="num">${esc(l.serial || '–')}</td>
        <td class="r num">${l.qty}</td>
        <td class="r num">${money(l.price)}</td>
        <td><span class="src ${l.source}">${SOURCE_LABEL[l.source]}</span></td>
      </tr>`).join('')}
      <tr class="totals"><td colspan="3">Subtotal (ex VAT)</td><td class="r num">${money(total)}</td><td></td></tr></tbody>
    </table>`;
  }
  // Header: locked until Repair Details has run, then extra lines allowed
  const open = job.lines.some((l) => l.source === 'blueprint') && stageOf(job).owner !== 'done';
  const head = open
    ? `<span class="lock-note">${LOCK_SVG} Repair Details lines are locked</span><button class="btn btn-ghost btn-sm" type="button" id="add-line">+ Add extra line</button>`
    : `<span class="lock-note">${LOCK_SVG} Locked until Repair Details creates the repair lines</span>`;
  return `<section class="card span-2">
    <div class="card-head"><h3>Line items</h3><div class="head-right">${head}</div></div>
    <div class="card-body">${body}</div>
  </section>`;
}

// ---------- Sales line items: the user adds the products ----------
function salesLinesCard(job) {
  const open = salesLinesOpen(job);
  let body;
  if (!job.lines.length) {
    body = `<div class="empty"><strong>No products yet</strong>Add the products the customer has asked for.<br>
      <button class="btn btn-primary" type="button" id="sales-add">+ Add product</button></div>`;
  } else {
    const total = job.lines.reduce((t, l) => t + l.qty * l.price, 0);
    body = `<table>
      <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
      <tbody>${job.lines.map((l) => `<tr><td>${esc(l.name)}<div class="code">${esc(l.code)}</div></td><td class="r num">${l.qty}</td><td class="r num">${money(l.price)}</td><td class="r num">${money(l.qty * l.price)}</td></tr>`).join('')}
      <tr class="totals"><td colspan="3">Subtotal (ex VAT)</td><td class="r num">${money(total)}</td></tr></tbody></table>`;
  }
  const head = open
    ? `<span class="lock-note qmi-note">You add the products on Sales orders</span>${job.lines.length ? '<button class="btn btn-ghost btn-sm" type="button" id="add-line">+ Add product</button>' : ''}`
    : `<span class="lock-note">${LOCK_SVG} Locked – the order has been placed</span>`;
  return `<section class="card span-2"><div class="card-head"><h3>Products</h3><div class="head-right">${head}</div></div><div class="card-body">${body}</div></section>`;
}

// ---------- Packages (Sales): boxes entered by Cambertronics at Picked and Packed ----------
function packagesCard(job) {
  const body = job.packages && job.packages.length
    ? `<table><thead><tr><th>Box</th><th>Type</th><th>Size</th><th class="r">Weight</th></tr></thead><tbody>${job.packages.map((p) => `<tr><td>${esc(p.box)}</td><td>${esc(p.type)}</td><td class="num">${esc(p.size)}</td><td class="r num">${esc(p.weight)}</td></tr>`).join('')}</tbody></table>`
    : `<div class="empty"><strong>No boxes yet</strong>Cambertronics enter the boxes when they click Picked and Packed in the portal.</div>`;
  return `<section class="card"><div class="card-head"><h3>Packages</h3><span class="code">From the portal</span></div><div class="card-body">${body}</div></section>`;
}

// ---------- Quote card: number, status, total, out-of-date warning ----------
function lineSig(lines) { return lines.filter((l) => l.source !== 'repair').map((l) => l.code + '|' + l.serial + '|' + l.qty).join(';'); }
function quoteOutOfDate(job) { return job.quote && lineSig(job.quote.lines) !== lineSig(job.lines) && stageOf(job).phase === 'quote'; }

function quoteCard(job) {
  if (!job.quote) {
    const ready = job.lines.length > 0;
    return `<section class="card span-2 quote-strip"><div class="card-body qs">
      <div><h3>Quote</h3><p class="code">${ready ? 'Not created yet. Click Create Quote when the lines are complete.' : (job.process === 'sales' ? 'Add the products, then click Create Quote.' : 'Created after Repair Details has added the repair lines.')}</p></div>
    </div></section>`;
  }
  const q = job.quote;
  const warn = quoteOutOfDate(job)
    ? `<div class="qs-warn">The line items have changed since this quote was created. <button class="btn btn-ghost btn-sm" type="button" id="refresh-quote">Update quote</button></div>` : '';
  return `<section class="card span-2 quote-strip"><div class="card-body qs">
    <div><h3>Quote ${esc(q.number)}</h3><p class="code">${q.status === 'Sent' ? 'Sent ' + esc(q.sentOn) : 'Draft – not sent yet'} · valid until ${esc(q.expiry)}</p></div>
    <div class="qs-total num">${money(q.total)} <span class="code">inc VAT</span></div>
    <span class="pill ${q.status === 'Sent' ? 'cam' : 'qmi'}">${esc(q.status)}</span>
    <button class="btn ${q.status === 'Sent' ? 'btn-ghost' : 'btn-primary'}" type="button" id="view-quote">${q.status === 'Sent' ? 'View quote' : 'View and send'}</button>
  </div>${warn}</section>`;
}

// ---------- Invoice card ----------
function invoiceCard(job) {
  if (!job.invoice) return '';
  const inv = job.invoice;
  return `<section class="card span-2 quote-strip"><div class="card-body qs">
    <div><h3>${esc(inv.kind)} ${esc(inv.number)}</h3><p class="code">${inv.status === 'Sent' ? 'Emailed ' + esc(inv.sentOn) : 'Raised – not emailed to the customer yet'} · ${esc(job.terms)}</p></div>
    <div class="qs-total num">${money(inv.total)} <span class="code">inc VAT</span></div>
    <span class="pill ${inv.status === 'Sent' ? 'cam' : 'qmi'}">${inv.status === 'Sent' ? 'Sent' : 'Not sent'}</span>
    <button class="btn ${inv.status === 'Sent' ? 'btn-ghost' : 'btn-primary'}" type="button" id="view-invoice">${inv.status === 'Sent' ? 'View invoice' : 'View and email'}</button>
  </div></section>`;
}

function unitsCard(job) {
  const body = job.units.length
    ? `<table><thead><tr><th>Serial</th><th>Unit</th><th>Fault</th><th>Portal</th></tr></thead><tbody>${job.units.map((x) => `<tr>
        <td class="num"><strong>${esc(x.serial)}</strong></td><td>${esc(x.model)}</td><td>${esc(x.fault)}</td><td><span class="pill plain cam">${esc(x.portal)}</span></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty"><strong>No units yet</strong>Use Repair Details to pick them from the Asset Register.</div>';
  const pkg = job.package ? `<dl class="kv" style="margin-top:var(--space-4)"><dt>Cartons</dt><dd class="num">${job.package.cartons}</dd><dt>Weight</dt><dd class="num">${esc(job.package.weight)}</dd><dt>Largest size</dt><dd class="num">${esc(job.package.size)}</dd></dl>` : '';
  return `<section class="card"><div class="card-head"><h3>Units</h3><span class="code">${job.units.length} unit${job.units.length === 1 ? '' : 's'}</span></div><div class="card-body">${body}${pkg}</div></section>`;
}

function docsCard(job) {
  const sync = [
    ['Portal Job', job.sync.job || '–'],
    ['Cambertronics PO', job.sync.po || '–'],
  ];
  const docs = job.docs.length ? `<ul class="docs">${job.docs.map((d) => `<li><span class="t">${esc(d.type)}</span><span class="v num">${esc(d.ref)}</span></li>`).join('')}</ul>` : '<p class="code">No documents yet.</p>';
  return `<section class="card"><div class="card-head"><h3>Documents and sync</h3></div><div class="card-body">
    ${docs}
    <dl class="kv" style="margin-top:var(--space-4)">${sync.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  </div></section>`;
}

function activityCard(job) {
  return `<section class="card span-2"><div class="card-head"><h3>Activity</h3><span class="code">From the Deal and the portal Sync Log</span></div><div class="card-body">
    <ul class="timeline">${[...job.log].reverse().map((e) => `<li><span class="w num">${esc(e.when)}</span><span>${esc(e.text)}</span></li>`).join('')}</ul>
  </div></section>`;
}

// ---------- SECTION 6: DETAIL ACTIONS ----------
function bindDetail(job, s) {
  const main = $('#act-main');
  if (main) main.addEventListener('click', () => {
    if (job.process === 'repair' && job.stage === 'Repair Request Received') return openRepairDetails(job);
    if (job.process === 'sales' && (job.stage === 'Quote Sent' || job.stage === 'Order Blocked')) return openPoReceived(job);
    if (job.stage === 'Quote Drafting') return openQuote(job);
    if (job.stage === 'Invoice Issued') return openInvoice(job);
    return runStep(job, s);
  });
  const vq = $('#view-quote');
  if (vq) vq.addEventListener('click', () => openQuote(job));
  const ai = $('#act-invoice');
  if (ai) ai.addEventListener('click', () => openInvoice(job));
  const sa = $('#sales-add');
  if (sa) sa.addEventListener('click', () => openAddLine(job));
  const vi = $('#view-invoice');
  if (vi) vi.addEventListener('click', () => openInvoice(job));
  const rq = $('#refresh-quote');
  if (rq) rq.addEventListener('click', async () => { await RepairsApi.refreshQuote(job); toast('Quote updated from the line items'); render(); });
  const addLine = $('#add-line');
  if (addLine) addLine.addEventListener('click', () => openAddLine(job));
  const cta = $('#lines-cta');
  if (cta) cta.addEventListener('click', () => openRepairDetails(job));
  const demo = $('#act-demo');
  if (demo) demo.addEventListener('click', async () => { await RepairsApi.simulatePortal(job); toast('Demo: portal step done – the Deal moved on by itself'); render(); });
  const demoNext = $('#act-demo-next');
  if (demoNext) demoNext.addEventListener('click', async () => { job.stage = 'Ready to Ship'; job.log.push({ when: nowText(), text: 'Cambertronics clicked Docs Attached to Parcel' }); render(); });
  $('#open-deal').addEventListener('click', () => (IS_DEMO ? toast('In CRM this opens the Deal record') : RepairsApi.openDeal(job)));
}

async function runStep(job, s) {
  if (!s.transition) { toast('In CRM: open the invoice in Zoho Finance and click Send Email'); return; }
  try {
    await RepairsApi.runTransition(job, s.transition);
    toast(s.transition + ' done');
    render();
  } catch (err) {
    console.log(LOG_PREFIX + 'Step failed: ' + err.message);
    toast('Could not run "' + s.transition + '": ' + err.message);
  }
}

// ---------- SECTION 7: NEW REPAIR MODAL ----------
// After Create, Repair Details opens straight away – the user can't
// forget the step that creates the line items.
function openNewRepair() {
  const customers = Array.from(new Set(state.jobs.map((j) => j.customer).concat(Object.keys(DEMO_ASSETS)))).sort();
  openModal(`
    <div class="m-head"><h2 id="modal-title">New repair</h2><p>Creates the Repairs Deal. Repair Details opens next to add the units.</p>
      <div class="m-steps"><span class="on">1 Customer</span><span>2 Units</span><span>3 Faults</span></div></div>
    <form class="m-body" id="nr-form">
      <div class="form">
        <div class="field full"><label for="nr-cust">Customer account</label><select id="nr-cust" required>${customers.map((c) => `<option ${c === 'Northsea Shipping Ltd' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="nr-contact">Contact</label><input id="nr-contact" value="Ola Hansen"></div>
        <div class="field"><label for="nr-terms">Payment terms (from the Account)</label><select id="nr-terms"><option>Net 30</option><option>Net 60</option><option>Due on Receipt</option></select></div>
        <div class="field"><label for="nr-prio">Priority</label><select id="nr-prio"><option>Standard</option><option>Urgent</option><option>Critical</option></select></div>
        <div class="field"><label for="nr-po">Client PO number</label><input id="nr-po" placeholder="Optional"></div>
        <div class="field"><label for="nr-date">Date repair notified</label><input id="nr-date" type="date" value="2026-10-26"></div>
      </div>
    </form>
    <div class="m-foot"><span class="hint">Service Reference is generated for you</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="nr-create">Create and add units →</button></div></div>`);
  $('#nr-create').addEventListener('click', async () => {
    const d = $('#nr-date').value ? new Date($('#nr-date').value) : new Date();
    markTry('newRepair');
    const job = await RepairsApi.createRepair({
      customer: $('#nr-cust').value, contact: $('#nr-contact').value || '–', terms: $('#nr-terms').value,
      priority: $('#nr-prio').value, clientPo: $('#nr-po').value, notified: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
    state.selectedId = job.id; state.filter = 'qmi';
    render();
    openRepairDetails(job);
  });
}

// ---------- SECTION 8: REPAIR DETAILS MODAL (replaces the kiosk) ----------
// Step A: tick the units from the customer's Asset Register.
// Step B: fault + additional work per unit, with a live preview of the
//         line items that will be created.
async function openRepairDetails(job) {
  const assets = await RepairsApi.getAssets(job.customer);
  const list = assets.length ? assets : [
    { serial: 'DEMO-01', model: 'Q10 Atmospheric Sensor', productCode: 'Q10', vessel: 'Demo vessel', imo: '–' },
    { serial: 'DEMO-02', model: 'Q02 Engine Detector', productCode: 'Q02', vessel: 'Demo vessel', imo: '–' },
  ];
  openModal(`
    <div class="m-head"><h2 id="modal-title">Repair Details · ${esc(job.ref)}</h2><p>Tick the units the customer is returning. The line items are created from your selection.</p>
      <div class="m-steps"><span>1 Customer</span><span class="on">2 Units</span><span>3 Faults</span></div></div>
    <div class="m-body">
      <div class="assets">${list.map((a, i) => `<label class="asset"><input type="checkbox" value="${i}">
        <div><div class="s num">${esc(a.serial)}</div><div class="m">${esc(a.model)} · ${esc(a.vessel)} (IMO ${esc(a.imo)})</div></div>
        <span class="code">${esc(a.productCode)}</span></label>`).join('')}</div>
      <p class="code" style="margin-top:var(--space-3)">Unit not listed? Add it to the Asset Register first.</p>
    </div>
    <div class="m-foot"><span class="hint" id="rd-count">0 units selected</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="rd-next" disabled>Next: faults →</button></div></div>`);
  const boxes = () => Array.from(document.querySelectorAll('.asset input:checked')).map((b) => list[Number(b.value)]);
  document.querySelectorAll('.asset input').forEach((b) => b.addEventListener('change', () => {
    const n = boxes().length; $('#rd-count').textContent = n + ' unit' + (n === 1 ? '' : 's') + ' selected'; $('#rd-next').disabled = n === 0;
  }));
  $('#rd-next').addEventListener('click', () => repairDetailsFaults(job, boxes()));
}

function repairDetailsFaults(job, selected) {
  const lines = buildLinesForUnits(selected);
  openModal(`
    <div class="m-head"><h2 id="modal-title">Repair Details · ${esc(job.ref)}</h2><p>Enter the fault for each unit.</p>
      <div class="m-steps"><span>1 Customer</span><span>2 Units</span><span class="on">3 Faults</span></div></div>
    <div class="m-body">
      ${selected.map((a, i) => `<div class="unit-form"><h4>${esc(a.serial)} · ${esc(a.model)}</h4><div class="form">
        <div class="field"><label for="f-${i}">Fault description</label><textarea id="f-${i}" placeholder="What the customer reported">None known</textarea></div>
        <div class="field"><label for="w-${i}">Additional work</label><textarea id="w-${i}" placeholder="Optional"></textarea></div>
        <div class="field"><label for="t-${i}">Repair type</label><select id="t-${i}"><option>Standard Repair</option><option>Survey only</option><option>Calibration</option></select></div>
      </div></div>`).join('')}
      <div class="preview-lines"><h4>These line items will be created for you</h4><ul>${lines.map((l) => `<li>${esc(l.name)}${l.serial ? ' – serial ' + esc(l.serial) : ''} · ${money(l.price)}</li>`).join('')}</ul></div>
    </div>
    <div class="m-foot"><span class="hint">Completes the Repair Details Blueprint step</span><div><button class="btn btn-ghost" type="button" id="rd-back">← Back</button> <button class="btn btn-primary" type="button" id="rd-save">Save repair details</button></div></div>`);
  $('#rd-back').addEventListener('click', () => openRepairDetails(job));
  $('#rd-save').addEventListener('click', async () => {
    const withFaults = selected.map((a, i) => ({ ...a, fault: $('#f-' + i).value || 'None known', additions: $('#w-' + i).value, repairType: $('#t-' + i).value }));
    await RepairsApi.runRepairDetails(job, withFaults);
    markTry('repairDetails');
    closeModal();
    toast(job.lines.length + ' line items created – next: Create Quote');
    render();
  });
}

// ---------- SECTION 8C: QUOTE – VIEW AND SEND ----------
// Left: the quote as the customer will see it (Books Estimate).
// Below: the email. Send emails the quote and moves the Deal to Quote Sent.
function openQuote(job) {
  if (!job.quote) { toast('Create the quote first'); return; }
  const q = job.quote;
  const sent = q.status === 'Sent';
  openModal(`
    <div class="m-head"><h2 id="modal-title">Quote ${esc(q.number)} · ${esc(job.ref)}</h2><p>${sent ? 'Sent ' + esc(q.sentOn) + '. You can resend it below.' : 'Check the quote, then send it to the customer.'}</p></div>
    <div class="m-body">
      <div class="quote-doc">
        <div class="qd-top">
          <div><div class="qd-brand">Quality Monitoring Instruments Ltd</div><div class="code">Repair quotation</div></div>
          <dl class="kv qd-meta"><dt>Quote</dt><dd class="num">${esc(q.number)}</dd><dt>Date</dt><dd>${esc(q.date)}</dd><dt>Valid until</dt><dd>${esc(q.expiry)}</dd><dt>Reference</dt><dd>${esc(job.clientPo || job.ref)}</dd></dl>
        </div>
        <div class="qd-to"><span class="code">To</span><div><strong>${esc(job.customer)}</strong><br>${esc(job.contact)}</div></div>
        <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
          ${q.lines.map((l) => `<tr><td>${esc(l.name)}${l.serial ? `<div class="code">Serial Number: ${esc(l.serial)}</div>` : ''}</td><td class="r num">${l.qty}</td><td class="r num">${money(l.price)}</td><td class="r num">${money(l.qty * l.price)}</td></tr>`).join('')}
          <tr><td colspan="3" class="r">Subtotal</td><td class="r num">${money(q.subtotal)}</td></tr>
          <tr><td colspan="3" class="r">VAT 20%</td><td class="r num">${money(q.vat)}</td></tr>
          <tr class="totals"><td colspan="3" class="r">Total</td><td class="r num">${money(q.total)}</td></tr>
        </tbody></table>
        <p class="code" style="margin-top:var(--space-3)">Payment terms: ${esc(job.terms)}</p>
      </div>
      ${quoteOutOfDate(job) ? '<div class="qs-warn" style="margin-top:var(--space-4)">The line items have changed since this quote was created. Close this window and click Update quote first.</div>' : ''}
      <h3 class="send-h">Email to customer</h3>
      <div class="form">
        <div class="field"><label for="qm-to">To</label><input id="qm-to" type="email" value="${esc(job.email)}"></div>
        <div class="field"><label for="qm-cc">CC</label><input id="qm-cc" type="email" placeholder="Optional"></div>
        <div class="field full"><label for="qm-sub">Subject</label><input id="qm-sub" value="Quote ${esc(q.number)} for your repair ${esc(job.ref)}"></div>
        <div class="field full"><label for="qm-body">Message</label><textarea id="qm-body" rows="5">Dear ${esc(job.contact.split(' ')[0])},

Please find attached our quote ${esc(q.number)} for repair ${esc(job.ref)}.

Kind regards,
QMI</textarea></div>
      </div>
    </div>
    <div class="m-foot"><button class="btn btn-ghost" type="button" id="qm-pdf">Download PDF</button><div><button class="btn btn-ghost" type="button" data-close>Close</button> <button class="btn btn-primary" type="button" id="qm-send" ${quoteOutOfDate(job) ? 'disabled' : ''}>${sent ? 'Resend quote' : 'Send quote'}</button></div></div>`);
  $('#qm-pdf').addEventListener('click', () => toast(IS_DEMO ? 'In CRM this downloads the Books quote PDF' : 'Downloading PDF'));
  $('#qm-send').addEventListener('click', async () => {
    const to = $('#qm-to').value.trim();
    if (!to || !to.includes('@')) { toast('Enter the customer email address'); return; }
    await RepairsApi.sendQuote(job, { to, cc: $('#qm-cc').value.trim(), subject: $('#qm-sub').value, body: $('#qm-body').value });
    if (job.process === 'repair') markTry('repairQuote');
    console.log(LOG_PREFIX + 'Quote ' + q.number + ' sent to ' + to);
    closeModal(); toast('Quote ' + q.number + ' sent to ' + to); render();
  });
}

// ---------- SECTION 8D: INVOICE – VIEW AND EMAIL ----------
// Shows the Books invoice exactly as the customer gets it (all lines,
// including Repair Complete parts), with the email underneath.
function openInvoice(job) {
  if (!job.invoice) { toast('No invoice yet – it is raised at Confirm Courier and Invoice Customer'); return; }
  const inv = job.invoice;
  const sent = inv.status === 'Sent';
  openModal(`
    <div class="m-head"><h2 id="modal-title">${esc(inv.kind)} ${esc(inv.number)} · ${esc(job.ref)}</h2><p>${sent ? 'Emailed ' + esc(inv.sentOn) + '. You can resend it below.' : 'Check the invoice, then email it to the customer.'}</p></div>
    <div class="m-body">
      <div class="quote-doc">
        <div class="qd-top">
          <div><div class="qd-brand">Quality Monitoring Instruments Ltd</div><div class="code">${esc(inv.kind)}</div></div>
          <dl class="kv qd-meta"><dt>Invoice</dt><dd class="num">${esc(inv.number)}</dd><dt>Date</dt><dd>${esc(inv.date)}</dd><dt>Terms</dt><dd>${esc(job.terms)}</dd><dt>Reference</dt><dd>${esc(job.clientPo || job.ref)}</dd></dl>
        </div>
        <div class="qd-to"><span class="code">Bill to</span><div><strong>${esc(job.customer)}</strong><br>${esc(job.contact)}</div></div>
        <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
          ${inv.lines.map((l) => `<tr><td>${esc(l.name)}${l.serial ? `<div class="code">Serial Number: ${esc(l.serial)}</div>` : ''}</td><td class="r num">${l.qty}</td><td class="r num">${money(l.price)}</td><td class="r num">${money(l.qty * l.price)}</td></tr>`).join('')}
          <tr><td colspan="3" class="r">Subtotal</td><td class="r num">${money(inv.subtotal)}</td></tr>
          <tr><td colspan="3" class="r">VAT 20%</td><td class="r num">${money(inv.vat)}</td></tr>
          <tr class="totals"><td colspan="3" class="r">Total due</td><td class="r num">${money(inv.total)}</td></tr>
        </tbody></table>
      </div>
      <h3 class="send-h">Email to customer</h3>
      <div class="form">
        <div class="field"><label for="iv-to">To</label><input id="iv-to" type="email" value="${esc(job.email)}"></div>
        <div class="field"><label for="iv-cc">CC</label><input id="iv-cc" type="email" placeholder="Optional"></div>
        <div class="field full"><label for="iv-sub">Subject</label><input id="iv-sub" value="${esc(inv.kind)} ${esc(inv.number)} for your repair ${esc(job.ref)}"></div>
        <div class="field full"><label for="iv-body">Message</label><textarea id="iv-body" rows="5">Dear ${esc(job.contact.split(' ')[0])},

Please find attached ${esc(inv.kind.toLowerCase())} ${esc(inv.number)} for repair ${esc(job.ref)}.

Kind regards,
QMI</textarea></div>
      </div>
    </div>
    <div class="m-foot"><button class="btn btn-ghost" type="button" id="iv-pdf">Download PDF</button><div><button class="btn btn-ghost" type="button" data-close>Close</button> <button class="btn btn-primary" type="button" id="iv-send">${sent ? 'Resend invoice' : 'Email invoice'}</button></div></div>`);
  $('#iv-pdf').addEventListener('click', () => toast(IS_DEMO ? 'In CRM this downloads the Books invoice PDF' : 'Downloading PDF'));
  $('#iv-send').addEventListener('click', async () => {
    const to = $('#iv-to').value.trim();
    if (!to || !to.includes('@')) { toast('Enter the customer email address'); return; }
    await RepairsApi.sendInvoice(job, { to, cc: $('#iv-cc').value.trim(), subject: $('#iv-sub').value, body: $('#iv-body').value });
    markTry('invoice');
    console.log(LOG_PREFIX + 'Invoice ' + inv.number + ' emailed to ' + to);
    closeModal(); toast(inv.kind + ' ' + inv.number + ' emailed to ' + to); render();
  });
}

// ---------- SECTION 8B: ADD EXTRA LINE (only after Repair Details) ----------
// Extra parts or labour the customer has agreed to. The repair lines and
// pack charge created by Repair Details are never edited here.
function openAddLine(job) {
  if (job.process === 'sales') return openAddSalesLine(job);
  if (!job.lines.some((l) => l.source === 'blueprint')) { toast('Run Repair Details first – it creates the repair lines'); return; }
  openModal(`
    <div class="m-head"><h2 id="modal-title">Add extra line · ${esc(job.ref)}</h2><p>For extra parts or work on top of the repair lines. The repair lines from Repair Details stay as they are.</p></div>
    <div class="m-body"><div class="form">
      <div class="field full"><label for="al-prod">Product</label><select id="al-prod">${EXTRA_PRODUCTS.map((p, i) => `<option value="${i}">${esc(p.name)} (${esc(p.code)}) · ${money(p.salePrice)}</option>`).join('')}</select></div>
      <div class="field"><label for="al-qty">Quantity</label><input id="al-qty" type="number" min="1" value="1"></div>
      <div class="field"><label for="al-serial">For unit (optional)</label><select id="al-serial"><option value="">Not unit-specific</option>${job.units.map((x) => `<option>${esc(x.serial)}</option>`).join('')}</select></div>
    </div></div>
    <div class="m-foot"><span class="hint">Shown as "Added by you" on the quote lines</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="al-save">Add line</button></div></div>`);
  $('#al-save').addEventListener('click', () => {
    const p = EXTRA_PRODUCTS[Number($('#al-prod').value)];
    const qty = Math.max(1, parseInt($('#al-qty').value, 10) || 1);
    job.lines.push({ code: p.code, name: p.name, serial: $('#al-serial').value, qty, price: p.salePrice, source: 'manual' });
    job.log.push({ when: nowText(), text: 'Extra line added: ' + p.name + ' × ' + qty });
    console.log(LOG_PREFIX + 'Extra line added ' + p.code + ' x' + qty + ' on ' + job.ref);
    closeModal(); toast('Extra line added'); render();
  });
}

// ---------- SECTION 8E: SALES – ADD PRODUCT ----------
function openAddSalesLine(job) {
  if (!salesLinesOpen(job)) { toast('The order has been placed – products are locked'); return; }
  openModal(`
    <div class="m-head"><h2 id="modal-title">Add product · ${esc(job.ref)}</h2><p>Pick the product and quantity the customer wants.</p></div>
    <div class="m-body"><div class="form">
      <div class="field full"><label for="sp-prod">Product</label><select id="sp-prod">${SALES_PRODUCTS.map((p, i) => `<option value="${i}">${esc(p.name)} (${esc(p.code)}) · ${money(p.salePrice)}</option>`).join('')}</select></div>
      <div class="field"><label for="sp-qty">Quantity</label><input id="sp-qty" type="number" min="1" value="1"></div>
    </div></div>
    <div class="m-foot"><span class="hint">Price comes from the product</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="sp-save">Add product</button></div></div>`);
  $('#sp-save').addEventListener('click', () => {
    const p = SALES_PRODUCTS[Number($('#sp-prod').value)];
    const qty = Math.max(1, parseInt($('#sp-qty').value, 10) || 1);
    job.lines.push({ code: p.code, name: p.name, serial: '', qty, price: p.salePrice, source: 'manual' });
    job.log.push({ when: nowText(), text: 'Product added: ' + p.name + ' × ' + qty });
    console.log(LOG_PREFIX + 'Sales line added ' + p.code + ' x' + qty + ' on ' + job.ref);
    closeModal(); toast('Product added'); render();
  });
}

// ---------- SECTION 8F: SALES – PO RECEIVED ----------
// Captures the customer's PO number, then runs the order process:
// credit customers -> Sales Order + pack-charge PO + portal Job (Picklist Sent)
// Due on Receipt -> pre-payment invoice (Pre-Pay Awaiting Payment)
function openPoReceived(job) {
  openModal(`
    <div class="m-head"><h2 id="modal-title">PO Received · ${esc(job.ref)}</h2><p>${job.terms === 'Due on Receipt' ? 'Pre-pay customer: a pre-payment invoice is raised. The order is released when payment is recorded.' : 'Credit customer: the credit check runs, then the Sales Order, pack-charge PO and portal Job are created.'}</p></div>
    <div class="m-body"><div class="form">
      <div class="field"><label for="po-num">Customer PO number</label><input id="po-num" value="${esc(job.clientPo)}" placeholder="e.g. PO-12345"></div>
      <div class="field"><label>Payment terms</label><input value="${esc(job.terms)}" disabled></div>
    </div></div>
    <div class="m-foot"><span class="hint">Runs the PO Received Blueprint step</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="po-save">Confirm order</button></div></div>`);
  $('#po-save').addEventListener('click', async () => {
    const po = $('#po-num').value.trim();
    if (!po) { toast('Enter the customer PO number'); return; }
    job.clientPo = po;
    try {
      await RepairsApi.runTransition(job, 'PO Received');
      markTry('salesPo');
      closeModal(); toast(job.stage === 'Picklist Sent' ? 'Order confirmed – sent to Cambertronics' : 'Pre-payment invoice raised'); render();
    } catch (err) { toast('Could not confirm the order: ' + err.message); }
  });
}

// ---------- SECTION 8G: NEW SALES ORDER ----------
function openNewSales() {
  const customers = Array.from(new Set(state.jobs.map((j) => j.customer))).sort();
  openModal(`
    <div class="m-head"><h2 id="modal-title">New sales order</h2><p>Creates a Spares or New System Deal at Enquiry Received. You add the products next.</p></div>
    <div class="m-body"><div class="form">
      <div class="field"><label for="ns-type">Deal type</label><select id="ns-type"><option>Spares</option><option>New System</option></select></div>
      <div class="field"><label for="ns-name">Deal name</label><input id="ns-name" value="Spares enquiry"></div>
      <div class="field full"><label for="ns-cust">Customer account</label><select id="ns-cust">${customers.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="ns-contact">Contact</label><input id="ns-contact" value="Ola Hansen"></div>
      <div class="field"><label for="ns-terms">Payment terms (from the Account)</label><select id="ns-terms"><option>Net 30</option><option>Net 60</option><option>Due on Receipt</option></select></div>
    </div></div>
    <div class="m-foot"><span class="hint">Kari orders stay on the Deal page – they never go to the portal</span><div><button class="btn btn-ghost" type="button" data-close>Cancel</button> <button class="btn btn-primary" type="button" id="ns-create">Create and add products →</button></div></div>`);
  $('#ns-create').addEventListener('click', async () => {
    markTry('newSales');
    const job = await RepairsApi.createSales({ dealType: $('#ns-type').value, dealName: $('#ns-name').value || 'Sales order', customer: $('#ns-cust').value, contact: $('#ns-contact').value || '–', terms: $('#ns-terms').value });
    state.selectedId = job.id; state.filter = 'qmi'; render();
    openAddSalesLine(job);
  });
}

// ---------- SECTION 8H: DEMO "TRY IT" CHECKLIST ----------
// Six tests for the team. Each ticks itself when the tester completes it.
// Demo only – hidden in the live widget.
const TRY_TASKS = [
  { id: 'newRepair', title: 'Create a new Repairs deal', how: 'Repairs → + New repair → Create and add units', start: () => { state.process = 'repair'; render(); openNewRepair(); } },
  { id: 'repairDetails', title: 'Add the units with Repair Details', how: 'Tick units, enter faults, Save – watch the repair lines and pack charge appear', start: null },
  { id: 'repairQuote', title: 'Create and send the repair quote', how: 'Create Quote, then Review and send quote → Send quote', start: null },
  { id: 'newSales', title: 'Create a new Sales order', how: 'Sales → + New sales order → Create and add products', start: () => { state.process = 'sales'; render(); openNewSales(); } },
  { id: 'salesPo', title: 'Quote it and confirm the PO', how: 'Add a product, Create Quote, send it, then PO Received with a PO number', start: null },
  { id: 'invoice', title: 'View and email an invoice', how: 'Any job with an Invoice panel → View and email → Email invoice', start: null },
];
const tryDone = new Set();
function markTry(id) {
  if (!IS_DEMO || tryDone.has(id)) return;
  tryDone.add(id);
  updateTryButton();
  const t = TRY_TASKS.find((x) => x.id === id);
  const msg = 'Test done: ' + t.title + ' (' + tryDone.size + ' of ' + TRY_TASKS.length + ')';
  setTimeout(() => toast(msg), 1200);
}
function updateTryButton() { const b = $('#try-it'); if (b) b.textContent = 'Try it (' + tryDone.size + '/' + TRY_TASKS.length + ')'; }
function openTryIt() {
  openModal(`
    <div class="m-head"><h2 id="modal-title">Try the QMI Desk</h2><p>Six short tests. Each one ticks itself when you finish it. Nothing is saved to Zoho.</p></div>
    <div class="m-body"><ol class="try-list">${TRY_TASKS.map((t) => `<li class="${tryDone.has(t.id) ? 'done' : ''}">
      <span class="tick" aria-hidden="true">${tryDone.has(t.id) ? '✓' : ''}</span>
      <div><strong>${esc(t.title)}</strong><div class="code">${esc(t.how)}</div></div>
      ${t.start && !tryDone.has(t.id) ? `<button class="btn btn-ghost btn-sm" type="button" data-start="${t.id}">Start</button>` : '<span></span>'}
    </li>`).join('')}</ol></div>
    <div class="m-foot"><span class="hint">${tryDone.size} of ${TRY_TASKS.length} done</span><button class="btn btn-primary" type="button" data-close>${tryDone.size ? 'Carry on' : 'Let\'s go'}</button></div>`);
  document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
    const t = TRY_TASKS.find((x) => x.id === b.dataset.start); closeModal(); t.start();
  }));
}

// ---------- SECTION 9: MODAL + TOAST HELPERS ----------
let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  $('#modal-box').innerHTML = html;
  $('#modal').hidden = false;
  $('#modal-box').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  const first = $('#modal-box').querySelector('input, select, textarea, button');
  if (first) first.focus();
}
function closeModal() { $('#modal').hidden = true; $('#modal-box').innerHTML = ''; if (lastFocus) lastFocus.focus(); }
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200); }

start();
