// Minimal user-side client updated: combined Lost + Found listing view, separate Claimed list.
// Uses same storage keys as admin (pcclnf_*).


const header = document.getElementById('h2');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});


let lastScrollY = window.scrollY;
const header2 = document.getElementById('h2');

window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;

  if (currentScrollY < lastScrollY && currentScrollY > 50) {
    // Scrolling up and header is about to exit
    header2.classList.add('exit');
  } else {
    header2.classList.remove('exit');
  }

  lastScrollY = currentScrollY;
});


const DATA_PATH = '../data/';
const FILES = { lost: 'lostItems.json', found: 'foundItems.json', claimed: 'claimedItems.json', pending: 'pendingList.json' };
let store = { lost: [], found: [], claimed: [], pending: [] };

function q(sel, root = document){ try { return (root || document).querySelector(sel); } catch(e){ return null; } }
function qa(sel, root = document){ try { return Array.from((root || document).querySelectorAll(sel)); } catch(e){ return []; } }

function saveToLocal(key, arr){ try { localStorage.setItem(`pcclnf_${key}`, JSON.stringify(arr)); } catch(e){} }
function loadFromLocal(key){ try { const v = localStorage.getItem(`pcclnf_${key}`); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
async function fetchJsonFile(name){ try { const res = await fetch(`${DATA_PATH}${name}`, {cache:"no-store"}); if(!res.ok) throw new Error(); return await res.json(); } catch(e){ return null; } }

function ensurePendingPid(item){
  if (!item) return;
  if (!item._pid) item._pid = 'PID-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  return item._pid;
}

async function loadAllData(){
  for (const k of ['lost','found','claimed','pending']){
    const local = loadFromLocal(k);
    if (local && Array.isArray(local) && local.length) store[k] = local;
    else {
      const data = await fetchJsonFile(FILES[k]);
      store[k] = Array.isArray(data) ? data : [];
      saveToLocal(k, store[k]);
    }
  }
  if (Array.isArray(store.pending)) store.pending.forEach(ensurePendingPid);
  saveToLocal('pending', store.pending);
}

function formatDateOnly(val){
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString();
}

function renderCard(item, kind){
  const header = item.category || '—';

  // determine image src: prefer data: URLs, otherwise treat as filename or absolute URL
  let src = null;
  if (item && item.image) {
    try {
      if (typeof item.image === 'string') {
        if (item.image.startsWith('data:')) {
          src = item.image;
        } else if (item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/')) {
          src = item.image;
        } else {
          // assume filename stored, resolve to images folder
          src = `../images/${item.image}`;
        }
      }
    } catch (e) { src = null; }
  }

  const imgHtml = src
    ? `<div class="img"><img src="${src}" alt="image" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=&quot;width:100%;height:160px;background:#eee;display:flex;align-items:center;justify-content:center;color:#777&quot;>No Image</div>'"></div>`
    : `<div class="img">No Image</div>`;

  const dateLabel = kind === 'found' ? (item.dateFound || item.postedAt) : (item.dateLost || item.postedAt);
  const location = item.locationLost || item.locationFound || '—';
  const posted = item.postedAt ? formatDateOnly(item.postedAt) : (item.submissionDate ? formatDateOnly(item.submissionDate) : '—');
  const status = item.status || (kind === 'found' ? 'Unclaimed' : 'Unclaimed');
  const idAttr = item.id || '';
  return `
    <div class="card" data-kind="${kind}" data-id="${idAttr}" data-pid="${item._pid || ''}">
      <div class="card-header">${header}</div>
      ${imgHtml}
      <div class="card-body">
        <div><strong>${kind === 'found' ? 'Date Found' : 'Date Lost'}:</strong> ${dateLabel ? formatDateOnly(dateLabel) : '—'}</div>
        <div><strong>${kind === 'found' ? 'Found At' : 'Last Seen At'}:</strong> ${location}</div>
        ${ kind === 'found' ? `<div><strong>Stored At:</strong> ${item.storedAt || '—'}</div>` : '' }
        <div><strong>Status:</strong> ${status}</div>
        <div><strong>Date Posted:</strong> ${posted}</div>
        <div>
          <button class="btn-view" data-kind="${kind}" data-id="${idAttr}" data-pid="${item._pid || ''}">View Details</button>
        </div>
      </div>
    </div>
  `;
}

// combined filtering for lost+found items
function applyFilters(list){
  const search = (q('#search-input')?.value || '').trim().toLowerCase();
  const reportFilter = (q('#filter-reportAs')?.value) || 'all';
  const catFilter = (q('#filter-category')?.value) || 'all';
  const statusFilter = (q('#filter-status')?.value) || 'all';
  const sortOrder = (q('#sort-order')?.value) || 'newest';

  return list.filter(it => {
    if (reportFilter !== 'all' && it.__kind !== reportFilter) return false;
    if (catFilter !== 'all' && (it.category || '') !== catFilter) return false;
    if (statusFilter !== 'all' && it.status && it.status !== statusFilter) return false;
    if (search){
      const hay = [it.type, it.brand, it.model, it.color, it.accessories, it.serial, it.locationLost, it.locationFound, it.reporter, it.foundBy, it.storedAt, it.status].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => {
    const da = new Date(a.postedAt || a.submissionDate || 0);
    const db = new Date(b.postedAt || b.submissionDate || 0);
    return sortOrder === 'newest' ? db - da : da - db;
  });
}

function renderCards(){
  const container = q('#cards-items');
  const claimed = q('#cards-claimed');
  if (container) container.innerHTML = '';
  if (claimed) claimed.innerHTML = '';

  // build combined items array with kind marker
  const combined = [];
  (store.lost || []).forEach(i => combined.push(Object.assign({}, i, { __kind: 'lost' })));
  (store.found || []).forEach(i => combined.push(Object.assign({}, i, { __kind: 'found' })));

  const filtered = applyFilters(combined);
  filtered.forEach(it => container && container.insertAdjacentHTML('beforeend', renderCard(it, it.__kind)));

  // claimed remains separate (unchanged)
  (store.claimed || []).forEach(it => claimed && claimed.insertAdjacentHTML('beforeend', renderCard(it,'claimed')));
}

function openModal(html){ const overlay = q('#modal-overlay'), modal = q('#modal'); if (!overlay || !modal) return; modal.innerHTML = html; overlay.style.display = ''; }
function closeModal(){ const overlay = q('#modal-overlay'), modal = q('#modal'); if (overlay) overlay.style.display = 'none'; if (modal) modal.innerHTML = ''; }

// create generic pending entry and persist + notify admin
function createPendingEntry(type, payload){
  const entry = {
    type: type,
    payload: payload || {},
    status: 'Pending',
    submissionDate: new Date().toISOString()
  };
  ensurePendingPid(entry);
  store.pending = store.pending || [];
  store.pending.push(entry);
  saveToLocal('pending', store.pending);
  try { localStorage.setItem('pcclnf_sync', Date.now().toString()); } catch(e){}
  // also write full pcclnf_pending for admin sync
  saveToLocal('pending', store.pending);
  renderCards();
  return entry;
}

function openViewDetails(kind, id){
  let item = null;
  if (id && kind) item = (store[kind] || []).find(x => x.id === id);
  if (!item && id) item = (store.pending || []).find(x => x._pid === id);
  if (!item) {
    for (const k of ['lost','found','claimed','pending']){
      item = (store[k] || []).find(x => x.id === id || x._pid === id);
      if (item) { kind = k; break; }
    }
  }
  if (!item) {
    console.warn('openViewDetails: item not found', { kind, id });
    return;
  }

  // robust image source resolution
  let imgSrc = '';
  if (item && item.image) {
    if (typeof item.image === 'string') {
      if (item.image.startsWith('data:') || item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/')) {
        imgSrc = item.image;
      } else {
        imgSrc = `../images/${item.image}`;
      }
    } else if (item.image && typeof item.image === 'object') {
      imgSrc = item.image.url || item.image.src || '';
    }
  }

  // action buttons
  const actions = [];
  const isFound = (kind === 'found') || (item.__kind === 'found') || (item.status && item.status.toLowerCase().includes('found'));
  if (isFound && !(kind === 'claimed')) actions.push(`<button id="btn-claim" type="button">Claim Item</button>`);
  const isLost = (kind === 'lost') || (item.__kind === 'lost');
  if (isLost && !(kind === 'claimed')) actions.push(`<button id="btn-report-found" type="button">I Have the Lost Item</button>`);
  const isClaimed = (kind === 'claimed') || (item.status && item.status.toLowerCase() === 'claimed');
  if (isClaimed) actions.push(`<button id="btn-report-false" type="button">Report False Claim</button>`);

  const imgHtml = imgSrc
    ? `<div class="img-preview-wrap"><img id="view-image" class="img-preview" src="${imgSrc}" alt="item image" onerror="this.remove(); this.parentNode.innerHTML='<div class=&quot;img-placeholder&quot;>No image available</div>'"></div>`
    : `<div class="img-preview-wrap"><div class="img-placeholder">No image available</div></div>`;

  const html = `
    <div class="view-details-modal" role="dialog" aria-modal="true" aria-labelledby="view-details-title">
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">Details</h1>
        <div class="modal-header-actions">
          <button id="fs-close" type="button" aria-label="Close">Close</button>
        </div>
      </header>

      <div class="add-modal-middle">
        <aside class="add-left">
          ${imgHtml}
          <div class="modal-body2">
            <h3>Status Info</h3>
            <p><strong>Status:</strong> ${ item.status || '—' }</p>
            <p><strong>Posted:</strong> ${ formatDateOnly(item.postedAt || item.createdAt) }</p>
            <p><strong>Last Updated:</strong> ${ formatDateOnly(item.lastUpdated) }</p>
          </div>
            <div class="view-actions">${actions.join(' ')}</div>
        </aside>

        <section class="view-right">
          <div class="modal-body">
            <h3>Item Details</h3>
            <p><strong>Category:</strong> ${ item.category || '—' }</p>
            <p><strong>Type:</strong> ${ item.type || '—' }</p>
            <p><strong>Brand / Model:</strong> ${ item.brand || '—' }</p>
            <p><strong>Color:</strong> ${ item.color || '—' }</p>
            <p><strong>Accessories / Contents:</strong> ${ item.accessories || '—' }</p>
            <p><strong>Condition:</strong> ${ item.condition || '—' }</p>
            <p><strong>Serial / Unique Mark:</strong> ${ item.serial || '—' }</p>

            <h3>Discovery Info</h3>
            <p><strong>Report Type:</strong> ${ (item.reportAs || kind || '').toUpperCase() }</p>
            <p><strong>Reported By:</strong> ${ item.reporter || item.foundBy || '—' }</p>
            <p><strong>Contact:</strong> ${ item.contact || '—' }</p>
            <p><strong>Location Found / Lost:</strong> ${ item.locationFound || item.locationLost || '—' }</p>
            <p><strong>Date Found / Lost:</strong> ${ formatDateOnly(item.dateFound || item.dateLost) }</p>
            <p><strong>Currently Stored At / Last Seen At:</strong> ${ item.storedAt || item.locationLost || '—' }</p>


            <h3>Claim Information</h3>
            <p><strong>Claimed By:</strong> ${ item.claimedBy || '—' }</p>
            <p><strong>Claimed Date:</strong> ${ item.claimedAt ? formatDateOnly(item.claimedAt) : '—' }</p>
            <hr class="divider-line">
          </div>
        </section>
      </div>
    </div>
  `;
  openModal(html);

  // wire actions
  q('#fs-close')?.addEventListener('click', closeModal);
  q('#btn-claim')?.addEventListener('click', ()=> openClaimForm(item, kind));
  q('#btn-report-found')?.addEventListener('click', ()=> openReportFoundForm(item, kind));
  q('#btn-report-false')?.addEventListener('click', ()=> openFalseClaimForm(item, kind));
}

// Claim form modal
function openClaimForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">CLAIM FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-claim">Cancel</button>
        </div>
      </header> 
      
      <form id="form-claim">
      <p>Claiming item: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Full Name: <input name="name" required></label><br>
      <label>Role:
        <select name="role">
          <option>Student</option>
          <option>Faculty</option>
        </select>
      </label><br>
      <label>ID Number: <input name="idNumber"></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Evidence / Description: <textarea name="evidence" rows="3"></textarea></label><br>
      <label><input type="checkbox" name="declaration" required> I certify I am the rightful owner and information is true.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Claim Request</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-claim')?.addEventListener('click', closeModal);
  const form = q('#form-claim');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_claimFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

function openReportFoundForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">REPORT FOUND FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-found">Cancel</button>
        </div>
      </header> 
      
      <form id="form-report-found">
      <p>Reporting found for item: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Full Name: <input name="name" required></label><br>
      <label>Role:
        <select name="role">
          <option>Student</option>
          <option>Faculty</option>
        </select>
      </label><br>
      <label>ID Number: <input name="idNumber"></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Date Found: <input type="date" name="dateFound"></label><br>
      <label>Found At: <input name="locationFound"></label><br>
      <label>I Will Hand It Over To: <input name="handoverTo"></label><br>
      <label><input type="checkbox" name="declaration" required> I confirm I found this item and will surrender it.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Found Report</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-found')?.addEventListener('click', closeModal);
  const form = q('#form-report-found');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_reportFoundFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

// Report False Claim form modal
function openFalseClaimForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">FALSE CLAIM FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-false">Cancel</button>
        </div>
      </header>
      
      <form id="form-false-claim">
      <p>Reporting false claim on: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Your Name: <input name="name" required></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Reason / Explanation: <textarea name="reason" rows="4" required></textarea></label><br>
      <label><input type="checkbox" name="declaration" required> I request admin review and believe this claim is false.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Report</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-false')?.addEventListener('click', closeModal);
  const form = q('#form-false-claim');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_falseClaimFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

function openAddListingModal(){
  openModal(`
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">ADD LISTING</h1>
        <div class="modal-header-actions">
          <button type="button" id="fs-submit-header">Submit Listing</button>
          <button id="fs-close" type="button" aria-label="Close">Close</button>
        </div>
      </header>

      <form id="fs-form-add">
      <div class="left-side-add">
            <label class="img-dropzone" id="img-dropzone" tabindex="0" aria-label="Drop image here or click to choose">
              <input type="file" id="image-file" name="imageFile" accept="image/*" style="display:none">
              <div class="img-placeholder" id="img-placeholder">
                <div class="img-instructions">
                  <div>'Attach image'}</div>
                  <div>'Click or drop an image here. Optional but recommended.'}</div>
                </div>
              </div>
      </label><div class="modal-body2">
        <label><input type="checkbox" id="fs-confirm-false" required> I understand false or misleading reports may result in suspension.</label><br>
        <label><input type="checkbox" id="fs-confirm-public" required> I consent to my report being reviewed and made public once approved by an administrator.</label>
      </div>
      </div>

      <div class="right-side-add">
      <div>
          <label><input type="radio" name="reportAs" value="lost" checked> REPORT AS LOST</label>
          <label><input type="radio" name="reportAs" value="found"> REPORT AS FOUND</label>
      </div>
      <div>
        <label>Category:
          <select name="category" required>
            <option value="">-- select --</option>
            <option>Personal Items</option>
            <option>Electronics</option>
            <option>Documents</option>
            <option>School / Office Supplies</option>
            <option>Miscellaneous</option>
          </select>
        </label><br>
        <label>Type: <input name="type" required></label><br>
        <label>Brand / Model: <input name="brand"></label><br>
        <label>Color: <input name="color"></label><br>
        <label>Contents: <input name="accessories"></label><br>
        <label>Condition:
          <select name="condition">
            <option>Brand New</option>
            <option>Used</option>
            <option>Slightly Used</option>
            <option>Damaged</option>
          </select>
        </label><br>
        <label>Unique Mark: <input name="serial"></label><br>
      </div>
      <div id="fs-lost-fields">
        <h4>LOST REPORTER FORM</h4>
        <label>Lost At: <input name="locationLost"></label><br>
        <label>Date Lost: <input name="dateLost" type="date"></label><br>
        <label>Reporter Name: <input name="reporter"></label><br>
        <label>Contact Info: <input name="contact"></label><br>
      </div>
      <div id="fs-found-fields" style="display:none">
        <h4>FOUND REPORTER FORM</h4>
        <label>Found At: <input name="locationFound"></label><br>
        <label>Date Found: <input name="dateFound" type="date"></label><br>
        <label>Found By: <input name="foundBy"></label><br>
        <label>Currently Stored At: <input name="storedAt"></label><br>
      </div>
      </div>
    </form>
  `);

  // toggle lost/found sections
  qa('input[name="reportAs"]').forEach(r => r.addEventListener('change', () => {
    const v = q('input[name="reportAs"]:checked')?.value || 'lost';
    q('#fs-lost-fields').style.display = v === 'lost' ? '' : 'none';
    q('#fs-found-fields').style.display = v === 'found' ? '' : 'none';
  }));

  // corrected cancel wiring (id used in markup is #fs-close)
  q('#fs-close')?.addEventListener('click', closeModal);

  // wire header submit button to the form (submit button sits outside the form in header)
  const form = q('#fs-form-add');
  const headerSubmit = q('#fs-submit-header');
  if (headerSubmit && form) {
    headerSubmit.addEventListener('click', () => {
      // prefer requestSubmit to trigger HTML validation; fallback to submit()
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }

  // form submit handler (unchanged)
  form?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const obj = Object.fromEntries(fd.entries());
    const fileInput = q('#fs-file-image');
    if (fileInput && fileInput.files && fileInput.files[0]){
      const reader = new FileReader();
      reader.onload = function(e){
        obj.image = e.target.result;
        persistPending(obj);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      persistPending(obj);
    }
  });
}

function persistPending(obj){
  const pendingItem = Object.assign({}, obj, {
    status: 'Pending',
    submissionDate: new Date().toISOString(),
    _kind: 'pending'
  });
  if ('id' in pendingItem) delete pendingItem.id;
  ensurePendingPid(pendingItem);
  store.pending.push(pendingItem);
  saveToLocal('pending', store.pending);
  try { localStorage.setItem('pcclnf_sync', Date.now().toString()); } catch(e){}
  closeModal();
  console.log('Submitted pending report (no alert).');
  renderCards();
}

function wire(){
  // add listing button
  q('#btn-add-listing')?.addEventListener('click', openAddListingModal);

  // filters
  ['#search-input','#filter-reportAs','#filter-category','#filter-status','#sort-order'].forEach(sel=>{
    q(sel)?.addEventListener('input', renderCards);
    q(sel)?.addEventListener('change', renderCards);
  });

  // delegated view button clicks
  document.body.addEventListener('click', (ev) => {
    const btn = ev.target.closest ? ev.target.closest('.btn-view') : null;
    if (!btn) return;
    ev.preventDefault();
    const kind = btn.getAttribute('data-kind');
    const id = btn.getAttribute('data-id') || btn.getAttribute('data-pid') || '';
    if (!id) return alert('Item id missing');
    openViewDetails(kind, id);
  });

  // modal overlay click closes
  q('#modal-overlay')?.addEventListener('click', (ev)=>{ if (ev.target.id === 'modal-overlay') closeModal(); });

  // storage sync from admin tab
  window.addEventListener('storage', (ev)=>{
    if (!ev.key) return;
    if (ev.key.startsWith('pcclnf_')) {
      const k = ev.key.replace('pcclnf_','');
      try { store[k] = JSON.parse(ev.newValue || '[]'); } catch(e){ store[k] = []; }
      renderCards();
    } else if (ev.key === 'pcclnf_sync') {
      loadAllData().then(renderCards);
    }
  });

  // expose API for fallback
  window.openAddListingModal = openAddListingModal;
  window.openViewDetails = openViewDetails;
}

// QR generator base (use your preferred QR service by setting window.QR_BASE_URL)
const QR_BASE = window.QR_BASE_URL || 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=';

function escapeHtml(str){
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function openQrModal(qrId, title, info){
  const infoHtml = Object.entries(info || {}).map(([k,v])=>{
    const val = (v === null || v === undefined) ? '—' : escapeHtml(String(v));
    return `<div class="qr-info-row"><strong>${escapeHtml(k)}:</strong> <span>${val}</span></div>`;
  }).join('');
  const html = `
    <div class="view-details-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="qr-title">${escapeHtml(title || 'QR')}</h1>
        <div class="modal-header-actions">
          <button id="qr-close" type="button" aria-label="Close">Close</button>
        </div>
      </header>

      <div class="add-modal-middle" style="gap:18px; padding:16px;">
        <aside class="add-left" style="align-items:center">
          <div class="img-preview-wrap" style="width:220px;height:220px;border-radius:8px;overflow:hidden;">
            <img class="img-preview" src="${QR_BASE}${encodeURIComponent(qrId || '')}" alt="QR code">
          </div>
          <div style="margin-top:8px;font-weight:700;">ID: ${escapeHtml(qrId || '')}</div>
        </aside>

        <section class="view-right" style="min-width:240px;">
          <div class="modal-body">
            <h3>Submission Details</h3>
            ${infoHtml || '<div>No details provided.</div>'}
          </div>
        </section>
      </div>
    </div>
  `;
  openModal(html);
  q('#qr-close')?.addEventListener('click', closeModal);
  // download link - open in new tab for some hosts
  q('#qr-download')?.addEventListener('click', (e)=>{ /* let browser handle */ });
}

// --- Replace alert flows with QR modal ---

// Claim form submit
// original payload creation preserved; show QR modal instead of alert
// find the handler location and replace its body with below:
q('#form-claim')?.addEventListener?.('submit', (ev)=>{
  // handler already wired in openClaimForm; this ensures replacement if rewired
});

// inside openClaimForm where submit handler is defined, replace with:
function _claimFormSubmitHandler(ev, item){
  ev.preventDefault();
  const fd = new FormData(q('#form-claim'));
  const data = Object.fromEntries(fd.entries());
  const payload = { itemRef: item.id || item._pid, itemSnapshot: item, claimant: data };
  const entry = createPendingEntry('claim-request', payload);
  // show QR modal with claimant info
  openQrModal(entry.payload?.itemRef || payload.itemRef, 'Claim Request Submitted', entry.payload?.claimant || data);
}

// Report Found submit => show QR modal
function _reportFoundFormSubmitHandler(ev, item){
  ev.preventDefault();
  const fd = new FormData(q('#form-report-found'));
  const data = Object.fromEntries(fd.entries());
  const payload = { itemRef: item.id || item._pid, itemSnapshot: item, reporter: data };
  const entry = createPendingEntry('found-report', payload);
  openQrModal(entry.payload?.itemRef || payload.itemRef, 'Found Report Submitted', entry.payload?.reporter || data);
}

// False Claim submit => show QR modal
function _falseClaimFormSubmitHandler(ev, item){
  ev.preventDefault();
  const fd = new FormData(q('#form-false-claim'));
  const data = Object.fromEntries(fd.entries());
  const payload = { itemRef: item.id || item._pid, itemSnapshot: item, reporter: data };
  const entry = createPendingEntry('false-claim', payload);
  openQrModal(entry.payload?.itemRef || payload.itemRef, 'False Claim Report Submitted', entry.payload?.reporter || data);
}

// Now ensure the form wiring in openClaimForm / openReportFoundForm / openFalseClaimForm uses these handlers:
function openClaimForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">CLAIM FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-claim">Cancel</button>
        </div>
      </header> 
      
      <form id="form-claim">
      <p>Claiming item: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Full Name: <input name="name" required></label><br>
      <label>Role:
        <select name="role">
          <option>Student</option>
          <option>Faculty</option>
        </select>
      </label><br>
      <label>ID Number: <input name="idNumber"></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Evidence / Description: <textarea name="evidence" rows="3"></textarea></label><br>
      <label><input type="checkbox" name="declaration" required> I certify I am the rightful owner and information is true.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Claim Request</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-claim')?.addEventListener('click', closeModal);
  const form = q('#form-claim');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_claimFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

function openReportFoundForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">REPORT FOUND FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-found">Cancel</button>
        </div>
      </header> 
      
      <form id="form-report-found">
      <p>Reporting found for item: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Full Name: <input name="name" required></label><br>
      <label>Role:
        <select name="role">
          <option>Student</option>
          <option>Faculty</option>
        </select>
      </label><br>
      <label>ID Number: <input name="idNumber"></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Date Found: <input type="date" name="dateFound"></label><br>
      <label>Found At: <input name="locationFound"></label><br>
      <label>I Will Hand It Over To: <input name="handoverTo"></label><br>
      <label><input type="checkbox" name="declaration" required> I confirm I found this item and will surrender it.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Found Report</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-found')?.addEventListener('click', closeModal);
  const form = q('#form-report-found');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_reportFoundFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

// Report False Claim form modal
function openFalseClaimForm(item, kind){
  const html = `
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">FALSE CLAIM FORM</h1>
        <div class="modal-header-actions">
        <button type="button" id="btn-cancel-false">Cancel</button>
        </div>
      </header>
      
      <form id="form-false-claim">
      <p>Reporting false claim on: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Your Name: <input name="name" required></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Reason / Explanation: <textarea name="reason" rows="4" required></textarea></label><br>
      <label><input type="checkbox" name="declaration" required> I request admin review and believe this claim is false.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Report</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-false')?.addEventListener('click', closeModal);
  const form = q('#form-false-claim');
  if (form) {
    form.removeEventListener('submit', form._handlerRef);
    form._handlerRef = (ev)=>_falseClaimFormSubmitHandler(ev, item);
    form.addEventListener('submit', form._handlerRef);
  }
}

function openAddListingModal(){
  openModal(`
      <header class="modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo">
        <h1 id="view-details-title">ADD LISTING</h1>
        <div class="modal-header-actions">
          <button type="button" id="fs-submit-header">Submit Listing</button>
          <button id="fs-close" type="button" aria-label="Close">Close</button>
        </div>
      </header>

      <form id="fs-form-add">
      <div class="left-side-add">
            <label class="img-dropzone" id="img-dropzone" tabindex="0" aria-label="Drop image here or click to choose">
              <input type="file" id="image-file" name="imageFile" accept="image/*" style="display:none">
              <div class="img-placeholder" id="img-placeholder">
                <div class="img-instructions">
                  <div>'Attach image'}</div>
                  <div>'Click or drop an image here. Optional but recommended.'}</div>
                </div>
              </div>
      </label><div class="modal-body2">
        <label><input type="checkbox" id="fs-confirm-false" required> I understand false or misleading reports may result in suspension.</label><br>
        <label><input type="checkbox" id="fs-confirm-public" required> I consent to my report being reviewed and made public once approved by an administrator.</label>
      </div>
      </div>

      <div class="right-side-add">
      <div>
          <label><input type="radio" name="reportAs" value="lost" checked> REPORT AS LOST</label>
          <label><input type="radio" name="reportAs" value="found"> REPORT AS FOUND</label>
      </div>
      <div>
        <label>Category:
          <select name="category" required>
            <option value="">-- select --</option>
            <option>Personal Items</option>
            <option>Electronics</option>
            <option>Documents</option>
            <option>School / Office Supplies</option>
            <option>Miscellaneous</option>
          </select>
        </label><br>
        <label>Type: <input name="type" required></label><br>
        <label>Brand / Model: <input name="brand"></label><br>
        <label>Color: <input name="color"></label><br>
        <label>Contents: <input name="accessories"></label><br>
        <label>Condition:
          <select name="condition">
            <option>Brand New</option>
            <option>Used</option>
            <option>Slightly Used</option>
            <option>Damaged</option>
          </select>
        </label><br>
        <label>Unique Mark: <input name="serial"></label><br>
      </div>
      <div id="fs-lost-fields">
        <h4>LOST REPORTER FORM</h4>
        <label>Lost At: <input name="locationLost"></label><br>
        <label>Date Lost: <input name="dateLost" type="date"></label><br>
        <label>Reporter Name: <input name="reporter"></label><br>
        <label>Contact Info: <input name="contact"></label><br>
      </div>
      <div id="fs-found-fields" style="display:none">
        <h4>FOUND REPORTER FORM</h4>
        <label>Found At: <input name="locationFound"></label><br>
        <label>Date Found: <input name="dateFound" type="date"></label><br>
        <label>Found By: <input name="foundBy"></label><br>
        <label>Currently Stored At: <input name="storedAt"></label><br>
      </div>
      </div>
    </form>
  `);

  // toggle lost/found sections
  qa('input[name="reportAs"]').forEach(r => r.addEventListener('change', () => {
    const v = q('input[name="reportAs"]:checked')?.value || 'lost';
    q('#fs-lost-fields').style.display = v === 'lost' ? '' : 'none';
    q('#fs-found-fields').style.display = v === 'found' ? '' : 'none';
  }));

  // corrected cancel wiring (id used in markup is #fs-close)
  q('#fs-close')?.addEventListener('click', closeModal);

  // wire header submit button to the form (submit button sits outside the form in header)
  const form = q('#fs-form-add');
  const headerSubmit = q('#fs-submit-header');
  if (headerSubmit && form) {
    headerSubmit.addEventListener('click', () => {
      // prefer requestSubmit to trigger HTML validation; fallback to submit()
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }

  // form submit handler (unchanged)
  form?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const obj = Object.fromEntries(fd.entries());
    const fileInput = q('#fs-file-image');
    if (fileInput && fileInput.files && fileInput.files[0]){
      const reader = new FileReader();
      reader.onload = function(e){
        obj.image = e.target.result;
        persistPending(obj);
      };
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      persistPending(obj);
    }
  });
}

function persistPending(obj){
  const pendingItem = Object.assign({}, obj, {
    status: 'Pending',
    submissionDate: new Date().toISOString(),
    _kind: 'pending'
  });
  if ('id' in pendingItem) delete pendingItem.id;
  ensurePendingPid(pendingItem);
  store.pending.push(pendingItem);
  saveToLocal('pending', store.pending);
  try { localStorage.setItem('pcclnf_sync', Date.now().toString()); } catch(e){}
  closeModal();
  console.log('Submitted pending report (no alert).');
  renderCards();
}

function wire(){
  // add listing button
  q('#btn-add-listing')?.addEventListener('click', openAddListingModal);

  // filters
  ['#search-input','#filter-reportAs','#filter-category','#filter-status','#sort-order'].forEach(sel=>{
    q(sel)?.addEventListener('input', renderCards);
    q(sel)?.addEventListener('change', renderCards);
  });

  // delegated view button clicks
  document.body.addEventListener('click', (ev) => {
    const btn = ev.target.closest ? ev.target.closest('.btn-view') : null;
    if (!btn) return;
    ev.preventDefault();
    const kind = btn.getAttribute('data-kind');
    const id = btn.getAttribute('data-id') || btn.getAttribute('data-pid') || '';
    if (!id) return alert('Item id missing');
    openViewDetails(kind, id);
  });

  // modal overlay click closes
  q('#modal-overlay')?.addEventListener('click', (ev)=>{ if (ev.target.id === 'modal-overlay') closeModal(); });

  // storage sync from admin tab
  window.addEventListener('storage', (ev)=>{
    if (!ev.key) return;
    if (ev.key.startsWith('pcclnf_')) {
      const k = ev.key.replace('pcclnf_','');
      try { store[k] = JSON.parse(ev.newValue || '[]'); } catch(e){ store[k] = []; }
      renderCards();
    } else if (ev.key === 'pcclnf_sync') {
      loadAllData().then(renderCards);
    }
  });

  // expose API for fallback
  window.openAddListingModal = openAddListingModal;
  window.openViewDetails = openViewDetails;
}

function showPane(kind){
  ['lost','found','claimed'].forEach(k=>{
    const el = q(`#pane-${k}`);
    if (el) el.style.display = k === kind ? '' : 'none';
  });
}

async function init(){
  await loadAllData();
  wire();
  renderCards();
}

document.addEventListener('DOMContentLoaded', init);

