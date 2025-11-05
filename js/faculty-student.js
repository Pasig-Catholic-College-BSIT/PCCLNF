// Minimal user-side client that uses same seed data & localStorage keys as admin.js
const DATA_PATH_CANDIDATES = ['../data/', './data/', 'data/', '/data/'];
const FILES = { lost: 'lostItems.json', found: 'foundItems.json', claimed: 'claimedItems.json', pending: 'pendingList.json' };
let store = { lost: [], found: [], claimed: [], pending: [] };

function q(sel, root = document){ return root ? root.querySelector(sel) : null; }
function qa(sel, root = document){ return root ? Array.from(root.querySelectorAll(sel)) : []; }

function saveToLocal(key, arr){ try { localStorage.setItem(`pcclnf_${key}`, JSON.stringify(arr)); } catch(e){} }
function loadFromLocal(key){ try { const v = localStorage.getItem(`pcclnf_${key}`); return v ? JSON.parse(v) : null; } catch(e){ return null; } }

async function fetchJsonFile(name){
  for (const base of DATA_PATH_CANDIDATES){
    try {
      const url = `${base}${name}`;
      const res = await fetch(url, {cache:"no-store"});
      if (!res.ok) continue;
      return await res.json();
    } catch(e){}
  }
  return null;
}

function ensurePendingPid(item){
  if (!item) return;
  if (!item._pid) item._pid = 'PID-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  return item._pid;
}

async function loadAllData(){
  for (const k of ['lost','found','claimed','pending']){
    const local = loadFromLocal(k);
    if (local && Array.isArray(local) && local.length){
      store[k] = local;
    } else {
      const data = await fetchJsonFile(FILES[k]);
      store[k] = Array.isArray(data) ? data : [];
      saveToLocal(k, store[k]);
    }
  }
  store.pending.forEach(ensurePendingPid);
  saveToLocal('pending', store.pending);
}

function genId(kind){
  const prefix = kind === 'lost' ? 'L-' : kind === 'found' ? 'F-' : 'C-';
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

function formatDate(val){
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString();
}

function cardHtml(item, kind){
  const header = item.category || '—';
  const img = item.image ? `<img src="${item.image.startsWith('data:')?item.image:'../images/'+item.image}" class="img">` : `<div class="img">No Image</div>`;
  const dateLabel = kind === 'found' ? (item.dateFound || item.postedAt) : (item.dateLost || item.postedAt);
  const location = item.locationLost || item.locationFound || '—';
  const posted = item.postedAt ? formatDate(item.postedAt) : (item.submissionDate ? formatDate(item.submissionDate) : '—');
  const status = item.status || (kind === 'found' ? 'Unclaimed' : 'Unclaimed');

  return `
    <div class="card" data-kind="${kind}" data-id="${item.id || ''}">
      <div class="head">${header}</div>
      ${img}
      <div class="body">
        <div><strong>${kind === 'found' ? 'Date Found' : 'Date Lost'}:</strong> ${dateLabel ? formatDate(dateLabel) : '—'}</div>
        <div><strong>${kind === 'found' ? 'Found At' : 'Last Seen At'}:</strong> ${location}</div>
        ${ kind === 'found' ? `<div><strong>Stored At:</strong> ${item.storedAt || '—'}</div>` : '' }
        ${ kind === 'claimed' ? `<div><strong>Claimed By:</strong> ${item.claimedBy || 'Verified'}</div>` : '' }
        <div><strong>Status:</strong> ${status}</div>
        <div><strong>Date Posted:</strong> ${posted}</div>
        <div class="actions"><button class="btn-view" data-kind="${kind}" data-id="${item.id || ''}">View Details</button></div>
      </div>
    </div>
  `;
}

function applyFilters(list, kind){
  const searchEl = q('#search-input');
  const search = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const catEl = q('#filter-category');
  const cat = catEl ? catEl.value : 'all';
  const statusEl = q('#filter-status');
  const status = statusEl ? statusEl.value : 'all';
  const sortEl = q('#sort-order');
  const sort = sortEl ? sortEl.value : 'newest';

  return list.filter(it=>{
    if (cat !== 'all' && it.category !== cat) return false;
    if (status !== 'all' && it.status && it.status !== status) return false;
    if (search){
      const s = [it.id,it.type,it.brand,it.model,it.category,it.locationLost,it.locationFound,it.reporter,it.foundBy,it.serial,it.status].join(' ').toLowerCase();
      if (!s.includes(search)) return false;
    }
    return true;
  }).sort((a,b)=>{
    const da = new Date(a.postedAt || a.submissionDate || 0);
    const db = new Date(b.postedAt || b.submissionDate || 0);
    return sort === 'newest' ? db - da : da - db;
  });
}

function renderCards(){
  const cardsLost = q('#cards-lost');
  const cardsFound = q('#cards-found');
  const cardsClaimed = q('#cards-claimed');
  if (cardsLost) cardsLost.innerHTML = '';
  if (cardsFound) cardsFound.innerHTML = '';
  if (cardsClaimed) cardsClaimed.innerHTML = '';

  const losts = applyFilters(store.lost,'lost');
  const founds = applyFilters(store.found,'found');
  const claimed = applyFilters(store.claimed,'claimed');

  if (cardsLost) losts.forEach(it => cardsLost.insertAdjacentHTML('beforeend', cardHtml(it,'lost')));
  if (cardsFound) founds.forEach(it => cardsFound.insertAdjacentHTML('beforeend', cardHtml(it,'found')));
  if (cardsClaimed) claimed.forEach(it => cardsClaimed.insertAdjacentHTML('beforeend', cardHtml(it,'claimed')));
}

function openModal(html){
  const modal = q('#modal');
  const overlay = q('#modal-overlay');
  if (!overlay) return;
  if (modal) modal.innerHTML = html;
  overlay.style.display = '';
}
function closeModal(){ const overlay = q('#modal-overlay'); const modal = q('#modal'); if (overlay) overlay.style.display = 'none'; if (modal) modal.innerHTML = ''; }

function openViewDetails(kind, id){
  const arr = store[kind] || [];
  const item = arr.find(x=>x.id === id);
  if (!item) { alert('Item not found'); return; }
  const html = `
    <h3>Details</h3>
    <div style="display:flex;gap:1rem">
      <div style="flex:1">
        ${ item.image ? `<img src="${item.image.startsWith('data:')?item.image:'../images/'+item.image}" style="width:100%;max-height:360px;object-fit:cover">` : '<div style="width:100%;height:220px;background:#eee;display:flex;align-items:center;justify-content:center">No Image</div>' }
      </div>
      <div style="flex:1;text-align:left">
        <p><strong>Category:</strong> ${item.category || '—'}</p>
        <p><strong>Type:</strong> ${item.type || '—'}</p>
        <p><strong>Brand/Model:</strong> ${item.brand || '—'}</p>
        <p><strong>Color:</strong> ${item.color || '—'}</p>
        <p><strong>Accessories/Contents:</strong> ${item.accessories || '—'}</p>
        <p><strong>Condition:</strong> ${item.condition || '—'}</p>
        <p><strong>Serial/Unique Mark:</strong> ${item.serial || '—'}</p>
        <p><strong>${kind === 'found' ? 'Found At' : 'Lost/Last Seen At'}:</strong> ${item.locationFound || item.locationLost || '—'}</p>
        <p><strong>Date ${kind === 'found' ? 'Found' : 'Lost'}:</strong> ${item.dateFound || item.dateLost || '—'}</p>
        <p><strong>Status:</strong> ${item.status || (kind==='found'?'Unclaimed':'Unclaimed')}</p>
        <p><strong>Posted:</strong> ${ item.postedAt ? formatDate(item.postedAt) : (item.submissionDate ? formatDate(item.submissionDate) : '—') }</p>
        <div style="margin-top:1rem;text-align:right">
          <button id="btn-close">Close</button>
        </div>
      </div>
    </div>
  `;
  openModal(html);
  const closeBtn = q('#btn-close');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
}

function openAddListingModal(){
  const html = `
    <h3>Add Listing</h3>
    <form id="form-add">
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
      <div id="lost-fields">
        <h4>If LOST</h4>
        <label>Lost At: <input name="locationLost"></label><br>
        <label>Date Lost: <input name="dateLost" type="date"></label><br>
        <label>Reporter Name: <input name="reporter"></label><br>
        <label>Contact Info: <input name="contact"></label><br>
      </div>
      <div id="found-fields" style="display:none">
        <h4>If FOUND</h4>
        <label>Found At: <input name="locationFound"></label><br>
        <label>Date Found: <input name="dateFound" type="date"></label><br>
        <label>Found By: <input name="foundBy"></label><br>
        <label>Currently Stored At: <input name="storedAt"></label><br>
      </div>

      <div style="margin-top:.6rem">
        <label>Image (optional): <input type="file" id="file-image"></label><br>
      </div>

      <div style="margin-top:.6rem">
        <label><input type="checkbox" id="confirm-false" required> I understand that false or misleading reports may result in suspension.</label><br>
        <label><input type="checkbox" id="confirm-public" required> I consent to my report being reviewed and made public once approved by an administrator.</label>
      </div>

      <div style="text-align:right;margin-top:.6rem">
        <button type="submit">Confirm Submission</button>
        <button type="button" id="btn-cancel-add">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);

  qa('input[name="reportAs"]').forEach(r => r.addEventListener('change', ()=>{
    const v = q('input[name="reportAs"]:checked') ? q('input[name="reportAs"]:checked').value : 'lost';
    const lf = q('#lost-fields'), ff = q('#found-fields');
    if (lf) lf.style.display = v === 'lost' ? '' : 'none';
    if (ff) ff.style.display = v === 'found' ? '' : 'none';
  }));

  const cancelBtn = q('#btn-cancel-add');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const form = q('#form-add');
  if (form){
    form.addEventListener('submit', (ev)=>{
      ev.preventDefault();
      const fd = new FormData(form);
      const obj = Object.fromEntries(fd.entries());
      const fileInput = q('#file-image');
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
  closeModal();
  alert('Submitted. Your report is pending admin review.');
  try { localStorage.setItem('pcclnf_sync', Date.now().toString()); } catch(e){}
  renderCards();
}

function wire(){
  // robust global delegation: catches clicks even if elements are re-rendered
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!t) return;

    // Add Listing button (matches by id anywhere in DOM)
    const addBtn = t.closest ? t.closest('#btn-add-listing') : null;
    if (addBtn) {
      ev.preventDefault();
      openAddListingModal();
      return;
    }

    // View Details buttons (delegated)
    const viewBtn = t.closest ? t.closest('.btn-view') : null;
    if (viewBtn) {
      ev.preventDefault();
      const kind = viewBtn.dataset.kind;
      const id = viewBtn.dataset.id;
      if (kind && id) openViewDetails(kind, id);
      else alert('Item id missing or invalid');
      return;
    }

    // modal overlay background click -> close
    if (t.id === 'modal-overlay') {
      closeModal();
      return;
    }
  });

  // Inputs that trigger re-render
  ['#search-input','#filter-category','#filter-status','#sort-order'].forEach(sel=>{
    const el = q(sel);
    if (!el) return;
    el.addEventListener('input', renderCards);
    el.addEventListener('change', renderCards);
  });

  // close modal on Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeModal();
  });

  // reload when admin updates localStorage in other tab
  window.addEventListener('storage', (ev)=>{
    if (!ev.key) return;
    if (ev.key && ev.key.startsWith('pcclnf_')) {
      const k = ev.key.replace('pcclnf_','');
      try { store[k] = JSON.parse(ev.newValue || '[]'); } catch(e){ store[k] = []; }
      renderCards();
    } else if (ev.key === 'pcclnf_sync') {
      loadAllData().then(renderCards);
    }
  });
}

async function init(){
  await loadAllData();
  wire();
  renderCards();
}

// auto-run
document.addEventListener('DOMContentLoaded', init);

// Expose API to window so inline handlers and other scripts can call them reliably.
// This avoids "function not available" when code runs from different listeners or tabs.
window.openAddListingModal = openAddListingModal;
window.openViewDetails = openViewDetails;
window.loadAllData = loadAllData;
window.renderCards = renderCards;
window.persistPending = persistPending;