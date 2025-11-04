// Minimal user-side client: renders cards (lost/found/claimed) and allows Add Listing -> goes to pending list

const DATA_PATH = '../data/';
const FILES = { lost: 'lostItems.json', found: 'foundItems.json', claimed: 'claimedItems.json', pending: 'pendingList.json' };
let store = { lost: [], found: [], claimed: [], pending: [] };

function q(sel, root = document){ return root.querySelector(sel); }
function qa(sel, root = document){ return Array.from(root.querySelectorAll(sel)); }

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
    if (local) store[k] = local;
    else {
      const data = await fetchJsonFile(FILES[k]);
      store[k] = Array.isArray(data) ? data : [];
      saveToLocal(k, store[k]);
    }
  }
  // ensure pending have internal pids (not public)
  store.pending.forEach(ensurePendingPid);
  saveToLocal('pending', store.pending);
}

// card markup helper
function renderCard(item, kind){
  const header = item.category || '—';
  const img = item.image ? `<img src="${item.image.startsWith('data:')?item.image:'../images/'+item.image}" alt="" style="width:100%;height:160px;object-fit:cover;border-radius:4px 4px 0 0">` :
              `<div style="width:100%;height:160px;background:#eee;display:flex;align-items:center;justify-content:center;color:#777;border-radius:4px 4px 0 0">No Image</div>`;

  const dateLabel = kind === 'found' ? (item.dateFound || item.postedAt) : (item.dateLost || item.postedAt);
  const location = item.locationLost || item.locationFound || '—';
  const posted = item.postedAt ? (new Date(item.postedAt)).toLocaleDateString() : '—';
  const status = item.status || (kind === 'found' ? 'Unclaimed' : 'Unclaimed');

  return `
    <div class="card" style="width:240px;border:1px solid #ddd;border-radius:6px;background:#fff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="padding:.5rem;background:#f4f6fb;font-weight:600">${header}</div>
      ${img}
      <div style="padding:.6rem;font-size:.9rem;line-height:1.4">
        <div><strong>${kind === 'found' ? 'Date Found' : 'Date Lost'}:</strong> ${dateLabel ? (new Date(dateLabel)).toLocaleDateString() : '—'}</div>
        <div><strong>${kind === 'found' ? 'Found At' : 'Last Seen At'}:</strong> ${location}</div>
        ${ kind === 'found' ? `<div><strong>Stored At:</strong> ${item.storedAt || '—'}</div>` : '' }
        ${ kind === 'claimed' ? `<div><strong>Claimed By:</strong> ${item.claimedBy || 'Verified'}</div>` : '' }
        <div><strong>Status:</strong> ${status}</div>
        <div><strong>Date Posted:</strong> ${posted}</div>
        <div style="margin-top:.6rem;text-align:right">
          <button data-kind="${kind}" data-id="${item.id || ''}" class="btn-view">View Details</button>
        </div>
      </div>
    </div>
  `;
}

function renderCards(){
  // clear containers
  q('#cards-lost').innerHTML = '';
  q('#cards-found').innerHTML = '';
  q('#cards-claimed').innerHTML = '';

  const search = q('#search-input').value.trim().toLowerCase();
  const reportFilter = q('#filter-reportAs').value;
  const catFilter = q('#filter-category').value;
  const statusFilter = q('#filter-status').value;
  const sortOrder = q('#sort-order').value;

  function applyFilters(list, kind){
    return list.filter(it => {
      if (reportFilter !== 'all' && kind !== reportFilter) return false;
      if (catFilter !== 'all' && catFilter !== '' && it.category !== catFilter) return false;
      if (statusFilter !== 'all' && it.status && it.status !== statusFilter) return false;
      if (search){
        const s = [it.type,it.brand,it.model,it.color,it.accessories,it.serial,it.locationLost,it.locationFound,it.reporter,it.foundBy,it.storedAt,it.status].join(' ').toLowerCase();
        if (!s.includes(search)) return false;
      }
      return true;
    }).sort((a,b) => {
      const da = new Date(a.postedAt || a.submissionDate || 0);
      const db = new Date(b.postedAt || b.submissionDate || 0);
      return sortOrder === 'newest' ? db - da : da - db;
    });
  }

  // show only approved collections (pending not public)
  const lostList = applyFilters(store.lost, 'lost');
  lostList.forEach(it => q('#cards-lost').insertAdjacentHTML('beforeend', renderCard(it,'lost')));

  const foundList = applyFilters(store.found, 'found');
  foundList.forEach(it => q('#cards-found').insertAdjacentHTML('beforeend', renderCard(it,'found')));

  const claimedList = applyFilters(store.claimed, 'claimed');
  claimedList.forEach(it => q('#cards-claimed').insertAdjacentHTML('beforeend', renderCard(it,'claimed')));
}

function openModal(html){
  q('#modal').innerHTML = html;
  q('#modal-overlay').style.display = '';
}
function closeModal(){ q('#modal-overlay').style.display = 'none'; q('#modal').innerHTML = ''; }

function openViewDetails(kind, id){
  const arr = store[kind];
  const item = arr.find(x => x.id === id);
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
        <p><strong>Status:</strong> ${item.status || 'Unclaimed'}</p>
        <p><strong>Posted:</strong> ${ item.postedAt ? (new Date(item.postedAt)).toLocaleDateString() : '—' }</p>
        <div style="margin-top:1rem;text-align:right">
          ${ kind !== 'claimed' && (item.status === 'Unclaimed' || item.status === 'Unclaimed' ) ? `<button id="btn-claim" data-kind="${kind}" data-id="${item.id}">Claim Item</button>` : '' }
          <button id="btn-close">Close</button>
        </div>
      </div>
    </div>
  `;
  openModal(html);
  q('#btn-close').addEventListener('click', closeModal);
  const claimBtn = q('#btn-claim');
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      // open claim form (user fills)
      openClaimForm(kind, id);
    });
  }
}

function openClaimForm(kind, id){
  const html = `
    <h3>Claim Item</h3>
    <form id="form-claim">
      <div>
        <label>Full Name: <input name="fullName" required></label><br>
        <label>Role: 
          <select name="role">
            <option>Student</option>
            <option>Faculty</option>
          </select>
        </label><br>
        <label>ID Number: <input name="idNumber" required></label><br>
        <label>Contact: <input name="contact" required></label><br>
        <label>Proof / Description of Ownership: <textarea name="evidence" rows="3"></textarea></label><br>
        <label><input type="checkbox" name="declaration" required> I certify that I am the rightful owner.</label><br>
      </div>
      <div style="margin-top:.6rem;text-align:right">
        <button type="submit">Submit Claim Request</button>
        <button type="button" id="btn-cancel-claim">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);
  q('#btn-cancel-claim').addEventListener('click', closeModal);
  q('#form-claim').addEventListener('submit', (ev) => {
    ev.preventDefault();
    // create a claim request => for this simplified implementation we'll add a note to claimed request and set status to 'Claimed' on item (admin still should verify)
    const fd = new FormData(q('#form-claim'));
    const requester = Object.fromEntries(fd.entries());
    // mark item as claimed request (in real app this would notify admin)
    const arr = store[kind];
    const idx = arr.findIndex(x=>x.id===id);
    if (idx === -1){ alert('Item not found'); closeModal(); return; }
    arr[idx].status = 'Claimed';
    arr[idx].claimedBy = requester.fullName;
    arr[idx].lastUpdated = new Date().toISOString();
    saveToLocal(kind, arr);
    renderCards();
    closeModal();
    alert('Claim request submitted. Admin will verify.');
  });
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
        <label><input type="file" id="file-image"> (optional image)</label><br>
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

  // toggle lost/found fields
  qa('input[name="reportAs"]').forEach(r => r.addEventListener('change', () => {
    const v = q('input[name="reportAs"]:checked').value;
    q('#lost-fields').style.display = v === 'lost' ? '' : 'none';
    q('#found-fields').style.display = v === 'found' ? '' : 'none';
  }));

  q('#btn-cancel-add').addEventListener('click', closeModal);

  q('#form-add').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(q('#form-add'));
    const obj = Object.fromEntries(fd.entries());
    // image upload: convert to dataURL (simple)
    const fileInput = q('#file-image');
    if (fileInput && fileInput.files && fileInput.files[0]){
      const f = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e){
        obj.image = e.target.result;
        persistPending(obj);
      };
      reader.readAsDataURL(f);
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
  // remove any public id if present
  if ('id' in pendingItem) delete pendingItem.id;
  ensurePendingPid(pendingItem);
  store.pending.push(pendingItem);
  saveToLocal('pending', store.pending);
  closeModal();
  alert('Submitted. Your report is pending admin review.');
}

function wire(){
  q('#btn-add-listing').addEventListener('click', openAddListingModal);

  ['#search-input','#filter-reportAs','#filter-category','#filter-status','#sort-order'].forEach(sel => {
    q(sel).addEventListener('input', renderCards);
    q(sel).addEventListener('change', renderCards);
  });

  // delegate view button clicks
  document.body.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-view');
    if (!btn) return;
    const kind = btn.dataset.kind;
    const id = btn.dataset.id;
    openViewDetails(kind, id);
  });

  q('#modal-overlay').addEventListener('click', (ev)=>{ if (ev.target.id === 'modal-overlay') closeModal(); });
}

async function init(){
  await loadAllData();
  wire();
  renderCards();
}

document.addEventListener('DOMContentLoaded', init);