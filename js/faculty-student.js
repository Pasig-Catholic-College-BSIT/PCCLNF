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
    ? `<div class="img"><img src="${src}" alt="image" style="max-width:100%;max-height:160px;object-fit:cover;justify-content:center" onerror="this.style.display='none';this.parentNode.innerHTML='<div style=&quot;width:100%;height:160px;background:#eee;display:flex;align-items:center;justify-content:center;color:#777&quot;>No Image</div>'"></div>`
    : `<div class="img">No Image</div>`;

  const dateLabel = kind === 'found' ? (item.dateFound || item.postedAt) : (item.dateLost || item.postedAt);
  const location = item.locationLost || item.locationFound || '—';
  const posted = item.postedAt ? formatDateOnly(item.postedAt) : (item.submissionDate ? formatDateOnly(item.submissionDate) : '—');
  const status = item.status || (kind === 'found' ? 'Unclaimed' : 'Unclaimed');
  const idAttr = item.id || '';
  return `
    <div class="card" style="width:300px;border:1px solid #ddd;border-radius:6px;background:#fff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)" data-kind="${kind}" data-id="${idAttr}" data-pid="${item._pid || ''}">
      <div style="padding:.5rem;background:#f4f6fb;font-weight:600">${header}</div>
      ${imgHtml}
      <div style="padding:.6rem;font-size:.9rem;line-height:1.4">
        <div><strong>${kind === 'found' ? 'Date Found' : 'Date Lost'}:</strong> ${dateLabel ? formatDateOnly(dateLabel) : '—'}</div>
        <div><strong>${kind === 'found' ? 'Found At' : 'Last Seen At'}:</strong> ${location}</div>
        ${ kind === 'found' ? `<div><strong>Stored At:</strong> ${item.storedAt || '—'}</div>` : '' }
        <div><strong>Status:</strong> ${status}</div>
        <div><strong>Date Posted:</strong> ${posted}</div>
        <div style="margin-top:.6rem;text-align:right">
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
    return; // fail silently (no alert)
  }

  // build actions depending on context
  const actions = [];
  // If item exists in found collection or has __kind 'found' => allow Claim Item
  const isFound = (kind === 'found') || (item.__kind === 'found') || (item.status && (item.status.toLowerCase() === 'unclaimed' || item.status.toLowerCase().includes('found')));
  if (isFound && !(kind === 'claimed')) actions.push(`<button id="btn-claim">Claim Item</button>`);
  // If item exists in lost collection or __kind 'lost' => allow Report Found Item
  const isLost = (kind === 'lost') || (item.__kind === 'lost');
  if (isLost && !(kind === 'claimed')) actions.push(`<button id="btn-report-found">I Have the Lost Item</button>`);
  // If item is claimed (in claimed collection) allow report false claim
  const isClaimed = (kind === 'claimed') || (item.status && item.status.toLowerCase() === 'claimed');
  if (isClaimed) actions.push(`<button id="btn-report-false">Report False Claim</button>`);

  const html = `
    <h3>Details</h3>
    <div style="display:flex;gap:1rem;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        ${ item.image && typeof item.image === 'string' && item.image.startsWith('data:') ? `<img src="${item.image}" style="width:100%;max-height:360px;object-fit:cover">` : '<div style="width:100%;height:220px;background:#eee;display:flex;align-items:center;justify-content:center">No Image</div>' }
      </div>
      <div style="flex:1;min-width:260px;text-align:left">
        <p><strong>Category:</strong> ${item.category || '—'}</p>
        <p><strong>Type:</strong> ${item.type || '—'}</p>
        <p><strong>Brand/Model:</strong> ${item.brand || '—'}</p>
        <p><strong>Color:</strong> ${item.color || '—'}</p>
        <p><strong>Accessories/Contents:</strong> ${item.accessories || '—'}</p>
        <p><strong>Condition:</strong> ${item.condition || '—'}</p>
        <p><strong>Serial/Unique Mark:</strong> ${item.serial || '—'}</p>
        <p><strong>${item.locationFound ? 'Found At' : 'Lost/Last Seen At'}:</strong> ${item.locationFound || item.locationLost || '—'}</p>
        <p><strong>Date ${item.dateFound ? 'Found' : 'Lost'}:</strong> ${formatDateOnly(item.dateFound || item.dateLost)}</p>
        <p><strong>Status:</strong> ${item.status || 'Pending'}</p>
        <p><strong>Reporter/Finder:</strong> ${item.reporter || item.foundBy || '—'}</p>
        <p><strong>Stored At / Claimed From:</strong> ${item.storedAt || item.claimedFrom || '—'}</p>
        <p><strong>Remarks:</strong> ${item.remarks || '—'}</p>
        <div style="margin-top:1rem;text-align:right">
          ${actions.join(' ')}
          <button id="fs-close">Close</button>
        </div>
      </div>
    </div>
  `;
  openModal(html);

  // wire action buttons inside modal
  q('#fs-close')?.addEventListener('click', closeModal);
  q('#btn-claim')?.addEventListener('click', ()=> openClaimForm(item, kind));
  q('#btn-report-found')?.addEventListener('click', ()=> openReportFoundForm(item, kind));
  q('#btn-report-false')?.addEventListener('click', ()=> openFalseClaimForm(item, kind));
}

// Claim form modal
function openClaimForm(item, kind){
  const html = `
    <h3>Claim Item</h3>
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
        <button type="button" id="btn-cancel-claim">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-claim')?.addEventListener('click', closeModal);
  q('#form-claim')?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(q('#form-claim'));
    const data = Object.fromEntries(fd.entries());
    const payload = { itemRef: item.id || item._pid, itemSnapshot: item, claimant: data };
    createPendingEntry('claim-request', payload);
    closeModal();
    alert('Claim request submitted. Admin will review.');
  });
}

// Report Found form modal
function openReportFoundForm(item, kind){
  const html = `
    <h3>Report Found Item</h3>
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
        <button type="button" id="btn-cancel-found">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-found')?.addEventListener('click', closeModal);
  q('#form-report-found')?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(q('#form-report-found'));
    const data = Object.fromEntries(fd.entries());
    const payload = { itemRef: item.id || item._pid, itemSnapshot: item, reporter: data };
    createPendingEntry('found-report', payload);
    closeModal();
    alert('Found report submitted. Admin will review.');
  });
}

// Report False Claim form modal
function openFalseClaimForm(item, kind){
  const html = `
    <h3>Report False Claim</h3>
    <form id="form-false-claim">
      <p>Reporting false claim on: <strong>${item.type || item.category || 'Item'}</strong></p>
      <label>Your Name: <input name="name" required></label><br>
      <label>Contact Info: <input name="contact"></label><br>
      <label>Reason / Explanation: <textarea name="reason" rows="4" required></textarea></label><br>
      <label><input type="checkbox" name="declaration" required> I request admin review and believe this claim is false.</label><br>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Submit Report</button>
        <button type="button" id="btn-cancel-false">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-false')?.addEventListener('click', closeModal);
  q('#form-false-claim')?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const fd = new FormData(q('#form-false-claim'));
    const data = Object.fromEntries(fd.entries());
    const payload = { itemRef: item.id || item._pid, itemSnapshot: item, reporter: data };
    createPendingEntry('false-claim', payload);
    closeModal();
    alert('False claim report submitted. Admin will review.');
  });
}

function openAddListingModal(){
  // reuse previous form markup
  openModal(`
    <h3>Add Listing</h3>
    <form id="fs-form-add">
      <div>
        <label>Report as:
          <label><input type="radio" name="reportAs" value="lost" checked> LOST</label>
          <label><input type="radio" name="reportAs" value="found"> FOUND</label>
        </label>
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
        <label>Accessories / Contents: <input name="accessories"></label><br>
        <label>Condition:
          <select name="condition">
            <option>Brand New</option>
            <option>Used</option>
            <option>Slightly Used</option>
            <option>Damaged</option>
          </select>
        </label><br>
        <label>Serial / Unique Mark: <input name="serial"></label><br>
      </div>
      <div id="fs-lost-fields">
        <h4>If LOST</h4>
        <label>Lost At: <input name="locationLost"></label><br>
        <label>Date Lost: <input name="dateLost" type="date"></label><br>
        <label>Reporter Name: <input name="reporter"></label><br>
        <label>Contact Info: <input name="contact"></label><br>
      </div>
      <div id="fs-found-fields" style="display:none">
        <h4>If FOUND</h4>
        <label>Found At: <input name="locationFound"></label><br>
        <label>Date Found: <input name="dateFound" type="date"></label><br>
        <label>Found By: <input name="foundBy"></label><br>
        <label>Currently Stored At: <input name="storedAt"></label><br>
      </div>
      <div style="margin-top:.6rem">
        <label>Image (optional): <input type="file" id="fs-file-image"></label><br>
      </div>
      <div style="margin-top:.6rem">
        <label><input type="checkbox" id="fs-confirm-false" required> I understand false or misleading reports may result in suspension.</label><br>
        <label><input type="checkbox" id="fs-confirm-public" required> I consent to my report being reviewed and made public once approved by an administrator.</label>
      </div>
      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Confirm Submission</button>
        <button type="button" id="fs-btn-cancel">Cancel</button>
      </div>
    </form>
  `);

  qa('input[name="reportAs"]').forEach(r => r.addEventListener('change', () => {
    const v = q('input[name="reportAs"]:checked')?.value || 'lost';
    q('#fs-lost-fields').style.display = v === 'lost' ? '' : 'none';
    q('#fs-found-fields').style.display = v === 'found' ? '' : 'none';
  }));

  q('#fs-btn-cancel')?.addEventListener('click', closeModal);

  const form = q('#fs-form-add');
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