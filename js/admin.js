/*
  Admin UI behaviour for admin.html
  - Loads JSON datasets (falls back to localStorage for persistence)
  - Renders LOST / FOUND / CLAIMED tables
  - Search, category filter, sort
  - Add Listing modal (lost / found)
  - View Details modal
  - Update Listing modal
  - Delete with typed-ID confirmation
  - Pending review modal with Approve / Reject / Edit
*/

const DATA_PATH = '../data/';
const FILES = {
  lost: 'lostItems.json',
  found: 'foundItems.json',
  claimed: 'claimedItems.json',
  pending: 'pendingList.json'
};

let store = {
  lost: [],
  found: [],
  claimed: [],
  pending: []
};

/* ======= Pending helpers (internal PID) ======= */
function ensurePendingPid(item) {
  if (!item) return;
  if (!item._pid) {
    item._pid = 'PID-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
  }
  return item._pid;
}
function findPendingIndexByPid(pid) {
  return store.pending.findIndex(p => p._pid === pid);
}

/* ======= Utilities & Data Layer ======= */

// Normalize date parsing for sorting
function parseDateFlexible(item) {
  const keys = ['dateLost', 'dateFound', 'dateClaimed', 'postedAt', 'datePosted', 'date', 'submissionDate'];
  for (const k of keys) {
    if (item[k]) return new Date(item[k]);
  }
  if (item.createdAt) return new Date(item.createdAt);
  if (item.lastUpdated) return new Date(item.lastUpdated);
  return new Date(0);
}

function formatDateOnly(val) {
  if (!val) return '—';
  const d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString();
}

function genId(kind) {
  const prefix = kind === 'lost' ? 'L-' : kind === 'found' ? 'F-' : 'C-';
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}${ts}`;
}

function saveToLocal(key, arr) {
  try { localStorage.setItem(`pcclnf_${key}`, JSON.stringify(arr)); } catch (e) { /* ignore */ }
}
function loadFromLocal(key) {
  try {
    const v = localStorage.getItem(`pcclnf_${key}`);
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

async function fetchJsonFile(name) {
  try {
    const res = await fetch(`${DATA_PATH}${name}`, {cache: "no-store"});
    if (!res.ok) throw new Error('fetch failed');
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function loadAllData() {
  for (const k of ['lost', 'found', 'claimed', 'pending']) {
    const local = loadFromLocal(k);
    if (local) {
      store[k] = local;
    } else {
      const data = await fetchJsonFile(FILES[k]);
      store[k] = Array.isArray(data) ? data : [];
      saveToLocal(k, store[k]);
    }
  }
  // ensure pending items have stable internal _pid (not a public id)
  store.pending.forEach(ensurePendingPid);
  saveToLocal('pending', store.pending);
}

/* ======= Rendering ======= */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function thumbnailHtml(item) {
  if (item.image) {
    const src = item.image.startsWith('data:') ? item.image : `../images/${item.image}`;
    return `<img src="${src}" alt="img" width="60" style="object-fit:cover">`;
  }
  return '—';
}

function formatDateForColumn(item) {
  const d = parseDateFlexible(item);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString();
}

function getReporterOrStored(item) {
  return item.reporter || item.foundBy || item.claimedBy || item.storedAt || '—';
}

function renderTable(kind) {
  const pane = q(`#pane-${kind}`);
  const tbody = pane.querySelector('tbody');
  tbody.innerHTML = '';

  const filterCategory = q('#filter-category').value;
  const sortOrder = q('#sort-order').value;
  const search = q('#search-input').value.trim().toLowerCase();

  let items = store[kind].slice();

  if (filterCategory && filterCategory !== 'all') {
    items = items.filter(it => (it.category || '').toLowerCase() === filterCategory.toLowerCase());
  }

  if (search) {
    items = items.filter(it => {
      const s = [
        it.id, it.type, it.category, it.brand, it.model, it.color,
        it.accessories, it.condition, it.serial, it.locationLost, it.locationFound,
        it.reporter, it.foundBy, it.storedAt, it.contact, it.status
      ].join(' ').toLowerCase();
      return s.includes(search);
    });
  }

  items.sort((a, b) => {
    const da = parseDateFlexible(a), db = parseDateFlexible(b);
    return (sortOrder === 'newest' ? db - da : da - db);
  });

  for (const it of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.id || '—'}</td>
      <td>${thumbnailHtml(it)}</td>
      <td>${it.category || '—'}</td>
      <td>${formatDateForColumn(it)}</td>
      <td>${it.locationLost || it.locationFound || '—'}</td>
      <td>${getReporterOrStored(it)}</td>
      <td>${it.status || 'Unclaimed'}</td>
      <td>
        <button data-action="view" data-id="${it.id}" data-kind="${kind}">View</button>
      </td>
      <td>
        <button data-action="edit" data-id="${it.id}" data-kind="${kind}">Update</button>
        <button data-action="delete" data-id="${it.id}" data-kind="${kind}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAllTables() {
  ['lost', 'found', 'claimed'].forEach(renderTable);
}

/* ======= Tab & Controls wiring ======= */

function showPane(kind) {
  ['lost','found','claimed'].forEach(k => {
    q(`#pane-${k}`).style.display = k === kind ? '' : 'none';
  });
}

function wireControls() {
  q('#tab-lost').addEventListener('click', () => showPane('lost'));
  q('#tab-found').addEventListener('click', () => showPane('found'));
  q('#tab-claimed').addEventListener('click', () => showPane('claimed'));

  // Go back / role selection button
  const goBackBtn = q('#btn-go-back');
  if (goBackBtn) {
    goBackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // navigate back in history; fallback to index if none
      if (window.history.length > 1) window.history.back();
      else window.location.href = '../index.html';
    });
  }

  q('#search-input').addEventListener('input', () => renderAllTables());
  q('#filter-category').addEventListener('change', () => renderAllTables());
  q('#sort-order').addEventListener('change', () => renderAllTables());

  q('#btn-add-listing').addEventListener('click', () => openAddListingModal());
  q('#btn-review-pending').addEventListener('click', () => openReviewPendingModal());

  qa('#tables table').forEach(tbl => {
    tbl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const kind = btn.dataset.kind;
      if (action === 'view') openViewModal(kind, id);
      if (action === 'edit') openUpdateModal(kind, id);
      if (action === 'delete') openDeleteConfirm(kind, id);
    });
  });
}

/* ======= Status options helper ======= */
function statusOptionsHtml(kind, selected) {
  // kind: 'lost' | 'found' | 'claimed' | 'pending'
  // For lost reports approved state should be "Lost"
  // For found reports approved state should be "Unclaimed"
  const listLost = [
    {v: 'Pending', t: 'Pending'},
    {v: 'Lost', t: 'Lost'},
    {v: 'Claimed', t: 'Claimed'},
    {v: 'Returned', t: 'Returned'},
    {v: 'Rejected', t: 'Rejected'}
  ];
  const listFound = [
    {v: 'Pending', t: 'Pending'},
    {v: 'Unclaimed', t: 'Unclaimed'},
    {v: 'Claimed', t: 'Claimed'},
    {v: 'Returned', t: 'Returned'},
    {v: 'Rejected', t: 'Rejected'}
  ];
  const listClaimed = [
    {v: 'Pending', t: 'Pending'},
    {v: 'Unclaimed', t: 'Unclaimed'},
    {v: 'Claimed', t: 'Claimed'},
    {v: 'Returned', t: 'Returned'}
  ];
  let list = listFound;
  if (kind === 'lost') list = listLost;
  else if (kind === 'claimed') list = listClaimed;
  return list.map(o => `<option value="${o.v}" ${o.v === selected ? 'selected' : ''}>${o.t}</option>`).join('');
}

/* ======= Modals ======= */

function showModal(htmlContent) {
  const overlay = q('#modal-overlay');
  const modal = q('#modal');
  modal.innerHTML = htmlContent;
  overlay.style.display = '';
}
function closeModal() {
  q('#modal-overlay').style.display = 'none';
  q('#modal').innerHTML = '';
}

/* ======= Add / Update Listing ======= */

function openAddListingModal(prefill = null) {
  const initialKind = prefill ? prefill._kind || (prefill.id && prefill.id.startsWith('F-')? 'found' : 'lost') : 'lost';

  const categories = [
    'Personal Items',
    'Electronics',
    'Documents',
    'School / Office Supplies',
    'Miscellaneous'
  ];
  const conditionOptions = [
    'Brand New',
    'Used',
    'Slightly Used',
    'Damaged'
  ];
  function categoryOptionsHtml(selected) {
    return categories.map(c => `<option value="${c}" ${selected === c ? 'selected' : ''}>${c}</option>`).join('');
  }
  function conditionOptionsHtml(selected) {
    return conditionOptions.map(c => `<option value="${c}" ${selected === c ? 'selected' : ''}>${c}</option>`).join('');
  }

  const html = `
    <h2>${prefill ? 'Update Listing' : 'Add Listing'}</h2>
    <form id="form-add">
      <div>
        <label>Report as:
          <label><input type="radio" name="reportAs" value="lost" ${initialKind==='lost' ? 'checked' : ''}> LOST</label>
          <label><input type="radio" name="reportAs" value="found" ${initialKind==='found' ? 'checked' : ''}> FOUND</label>
        </label>
      </div>

      <fieldset id="common-fields">
        <label>Category:
          <select name="category" required>
            <option value="">-- select category --</option>
            ${categoryOptionsHtml(prefill?.category || '')}
          </select>
        </label><br>
        <label>Type: <input name="type" value="${prefill?.type || ''}"></label><br>
        <label>Brand / Model: <input name="brand" value="${prefill?.brand || ''}"></label><br>
        <label>Color: <input name="color" value="${prefill?.color || ''}"></label><br>
        <label>Accessories / Contents: <input name="accessories" value="${prefill?.accessories || ''}"></label><br>
        <label>Condition:
          <select name="condition">
            <option value="">-- select condition --</option>
            ${conditionOptionsHtml(prefill?.condition || '')}
          </select>
        </label><br>
        <label>Serial / Unique Mark: <input name="serial" value="${prefill?.serial || ''}"></label><br>
        <label>Image (data URL or filename): <input name="image" value="${prefill?.image || ''}"></label><br>
      </fieldset>

      <fieldset id="lost-fields">
        <h4>If LOST</h4>
        <label>Lost At: <input name="locationLost" value="${prefill?.locationLost || ''}"></label><br>
        <label>Date Lost: <input name="dateLost" type="date" value="${prefill?.dateLost || ''}"></label><br>
        <label>Owner / Reporter Name: <input name="reporter" value="${prefill?.reporter || ''}"></label><br>
        <label>Contact Info: <input name="contact" value="${prefill?.contact || ''}"></label><br>
      </fieldset>

      <fieldset id="found-fields" style="display:none">
        <h4>If FOUND</h4>
        <label>Found At: <input name="locationFound" value="${prefill?.locationFound || ''}"></label><br>
        <label>Date Found: <input name="dateFound" type="date" value="${prefill?.dateFound || ''}"></label><br>
        <label>Found By: <input name="foundBy" value="${prefill?.foundBy || ''}"></label><br>
        <label>Currently Stored At: <input name="storedAt" value="${prefill?.storedAt || ''}"></label><br>
      </fieldset>

      <div id="status-row" style="${prefill ? '' : 'display:none'}">
        <label>Status:
          <select name="status">
            ${ statusOptionsHtml(initialKind, prefill?.status || 'Pending') }
          </select>
        </label>
      </div>

      <div style="margin-top:1rem">
        <button type="submit">${prefill ? 'Save Changes' : 'Submit Listing'}</button>
        <button type="button" id="cancel">Cancel</button>
      </div>
    </form>
  `;
  showModal(html);

  const frm = q('#form-add');

  function toggleFields() {
    const val = frm.reportAs.value;
    q('#lost-fields').style.display = val === 'lost' ? '' : 'none';
    q('#found-fields').style.display = val === 'found' ? '' : 'none';
    // update status options dynamically when switching reportAs (only if status select visible)
    const statusSelect = q('select[name="status"]');
    if (statusSelect) {
      // preserve current selection if possible
      const cur = statusSelect.value || 'Pending';
      statusSelect.innerHTML = statusOptionsHtml(val, cur);
    }
  }
  toggleFields();
  qa('input[name="reportAs"]', frm).forEach(r => r.addEventListener('change', toggleFields));

  if (prefill && prefill.status) {
    const statusSelect = q('select[name="status"]');
    if (statusSelect) statusSelect.value = prefill.status;
  }

  frm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(frm);
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = v;
    const newKind = obj.reportAs;

    if (prefill) {
      const originalKind = prefill._kind || detectKindFromId(prefill.id) || 'pending';

      // updating a pending listing: locate by _pid
      if (originalKind === 'pending') {
        const pid = prefill._pid;
        const pidx = findPendingIndexByPid(pid);
        if (pidx === -1) return;

        const pendingItem = Object.assign({}, store.pending[pidx], obj);
        if (!obj.status || obj.status === 'Pending') {
          pendingItem.status = 'Pending';
          pendingItem.lastUpdated = new Date().toISOString();
          store.pending[pidx] = pendingItem;
          saveToLocal('pending', store.pending);
        } else {
          const destKind = (obj.reportAs === 'found') ? 'found' : 'lost';
          // Claim/Return -> claimed
          if (obj.status === 'Claimed' || obj.status === 'Returned') {
            const assignedId = genId(destKind);
            const claimedId = `C-${assignedId}`;
            const claimedItem = Object.assign({}, pendingItem, {
              id: claimedId,
              originalId: assignedId,
              status: obj.status,
              claimedBy: pendingItem.reporter || pendingItem.foundBy || 'Admin',
              claimedFrom: pendingItem.storedAt || pendingItem.locationFound || pendingItem.locationLost || 'Security Office',
              dateClaimed: new Date().toISOString(),
              postedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              _kind: 'claimed'
            });
            // remove pending
            store.pending.splice(pidx, 1);
            store.claimed.push(claimedItem);
            saveToLocal('claimed', store.claimed);
            saveToLocal('pending', store.pending);
          } else {
            // approve -> assign ID and appropriate approved status based on destKind
            const assignedId = genId(destKind);
            const approvedStatus = destKind === 'lost' ? 'Lost' : 'Unclaimed';
            const approved = Object.assign({}, pendingItem, {
              id: assignedId,
              status: approvedStatus,
              postedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              _kind: destKind
            });
            store.pending.splice(pidx, 1);
            store[destKind].push(approved);
            saveToLocal(destKind, store[destKind]);
            saveToLocal('pending', store.pending);
          }
        }
      }
      // updating a lost/found item
      else if (originalKind === 'lost' || originalKind === 'found') {
        const arr = store[originalKind];
        const idx = arr.findIndex(x => x.id === prefill.id);
        if (idx === -1) return alert('Item not found');

        const originalId = arr[idx].id;
        const updated = Object.assign({}, arr[idx], obj, {
          category: obj.category || arr[idx].category,
          lastUpdated: new Date().toISOString(),
          status: obj.status || arr[idx].status
        });

        const newStatus = updated.status;

        if (newStatus === 'Pending') {
          arr.splice(idx, 1);
          saveToLocal(originalKind, arr);

          const pendingItem = Object.assign({}, updated);
          delete pendingItem.id;
          pendingItem.status = 'Pending';
          pendingItem.submissionDate = new Date().toISOString();
          pendingItem._kind = 'pending';
          ensurePendingPid(pendingItem);
          store.pending.push(pendingItem);
          saveToLocal('pending', store.pending);
        } else if (newStatus === 'Claimed' || newStatus === 'Returned') {
          arr.splice(idx, 1);
          saveToLocal(originalKind, arr);

          const claimedId = originalId && originalId.startsWith('C-') ? originalId : `C-${originalId || genId(originalKind)}`;
          const claimedItem = Object.assign({}, updated, {
            id: claimedId,
            originalId: originalId,
            status: newStatus,
            claimedBy: updated.reporter || updated.foundBy || 'Admin',
            claimedFrom: updated.storedAt || updated.locationFound || updated.locationLost || 'Security Office',
            dateClaimed: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            _kind: 'claimed'
          });
          store.claimed.push(claimedItem);
          saveToLocal('claimed', store.claimed);
        } else {
          if (newKind && newKind !== originalKind) {
            arr.splice(idx, 1);
            saveToLocal(originalKind, arr);
            const newId = genId(newKind);
            const moved = Object.assign({}, updated, {
              id: newId,
              _kind: newKind
            });
            store[newKind].push(moved);
            saveToLocal(newKind, store[newKind]);
          } else {
            arr[idx] = updated;
            saveToLocal(originalKind, arr);
          }
        }
      }
      // updating a claimed item
      else if (originalKind === 'claimed') {
        const carr = store.claimed;
        const cidx = carr.findIndex(x => x.id === prefill.id);
        if (cidx === -1) return alert('Claimed item not found');
        const claimed = Object.assign({}, carr[cidx], obj, {
          lastUpdated: new Date().toISOString(),
          status: obj.status || carr[cidx].status
        });

        // NEW: if admin sets Pending on a claimed item -> move to pending review
        if (claimed.status === 'Pending') {
          // remove from claimed
          carr.splice(cidx, 1);
          saveToLocal('claimed', carr);

          // prepare pending record (no public id)
          const pendingItem = Object.assign({}, claimed);
          delete pendingItem.id;
          // drop claimed-only fields that don't belong in pending
          delete pendingItem.originalId;
          delete pendingItem.dateClaimed;
          delete pendingItem.claimedFrom;
          // mark as pending
          pendingItem.status = 'Pending';
          pendingItem.submissionDate = new Date().toISOString();
          pendingItem._kind = 'pending';
          ensurePendingPid(pendingItem);
          store.pending.push(pendingItem);
          saveToLocal('pending', store.pending);
        }
        // if admin sets Unclaimed -> revert to lost/found (existing behavior)
        else if (claimed.status === 'Unclaimed') {
          carr.splice(cidx, 1);
          saveToLocal('claimed', carr);

          const destKind = detectKindFromId(claimed.originalId) || (claimed.reportAs === 'found' ? 'found' : 'lost');
          const restoredId = claimed.originalId || genId(destKind);
          const restored = Object.assign({}, claimed, {
            id: restoredId,
            status: 'Unclaimed',
            _kind: destKind,
            lastUpdated: new Date().toISOString()
          });
          delete restored.originalId;
          store[destKind].push(restored);
          saveToLocal(destKind, store[destKind]);
        } else {
          // otherwise update claimed item in-place (keep on claimed tab)
          carr[cidx] = claimed;
          saveToLocal('claimed', carr);
        }
      }

    } else {
      // new listing -> push to pending list (default pending) WITHOUT a public id
      const item = Object.assign({}, obj, {
        status: 'Pending',
        submissionDate: new Date().toISOString(),
        _kind: 'pending'
      });
      if ('id' in item) delete item.id;
      ensurePendingPid(item);
      store.pending.push(item);
      saveToLocal('pending', store.pending);
    }

    renderAllTables();
    closeModal();
  });

  q('#cancel').addEventListener('click', () => closeModal());
}

/* ======= Helper: detect kind from id ======= */
function detectKindFromId(id) {
  if (!id) return null;
  if (id.startsWith('L-')) return 'lost';
  if (id.startsWith('F-')) return 'found';
  if (id.startsWith('C-')) return 'claimed';
  return null;
}

/* ======= View Details ======= */

function openViewModal(kind, id) {
  const arr = store[kind];
  const item = arr.find(x => x.id === id);
  if (!item) return alert('Item not found');
  const html = `
    <h3>Details — ${item.id}</h3>
    <div style="text-align:left">
      <div>${item.image ? `<img src="${item.image.startsWith('data:')?item.image:'../images/'+item.image}" width="200">` : ''}</div>
      <p><strong>Report Type:</strong> ${kind.toUpperCase()}</p>
      <p><strong>Category:</strong> ${item.category || '—'}</p>
      <p><strong>Type:</strong> ${item.type || '—'}</p>
      <p><strong>Brand/Model:</strong> ${item.brand || '—'}</p>
      <p><strong>Color:</strong> ${item.color || '—'}</p>
      <p><strong>Accessories/Contents:</strong> ${item.accessories || '—'}</p>
      <p><strong>Condition:</strong> ${item.condition || '—'}</p>
      <p><strong>Serial/Unique Mark:</strong> ${item.serial || '—'}</p>
      <p><strong>Lost/Found At:</strong> ${item.locationLost || item.locationFound || '—'}</p>
      <p><strong>Date Lost/Found:</strong> ${formatDateForColumn(item)}</p>
      <p><strong>Reporter/Finder:</strong> ${item.reporter || item.foundBy || '—'}</p>
      <p><strong>Contact Info:</strong> ${item.contact || '—'}</p>
      <p><strong>Currently Stored At / Claimed From:</strong> ${item.storedAt || item.claimedFrom || '—'}</p>
      <p><strong>Status:</strong> ${item.status || 'Unclaimed'}</p>
      <p><strong>Posted:</strong> ${formatDateOnly(item.postedAt || item.createdAt)}</p>
      <p><strong>Last Updated:</strong> ${formatDateOnly(item.lastUpdated)}</p>
    </div>
    <div style="margin-top:1rem">
      <button id="close-details">Close</button>
    </div>
  `;
  showModal(html);
  q('#close-details').addEventListener('click', closeModal);
}

/* ======= Update Listing (open pre-filled Add form) ======= */

function openUpdateModal(kind, id) {
  const arr = store[kind];
  const item = arr.find(x => x.id === id);
  if (!item) return alert('Item not found');
  const copy = Object.assign({}, item, {_kind: kind});
  openAddListingModal(copy);
}

/* ======= Delete with confirmation ======= */

function openDeleteConfirm(kind, id) {
  const html = `
    <h3>Delete Item</h3>
    <p>To confirm deletion, type the Item ID exactly:</p>
    <p><strong>${id}</strong></p>
    <input id="confirm-id" placeholder="Type ID to confirm">
    <div style="margin-top:1rem">
      <button id="do-delete">Delete</button>
      <button id="cancel-delete">Cancel</button>
    </div>
  `;
  showModal(html);
  q('#cancel-delete').addEventListener('click', closeModal);
  q('#do-delete').addEventListener('click', () => {
    const v = q('#confirm-id').value.trim();
    if (v !== id) return alert('ID mismatch. Deletion cancelled.');
    const arr = store[kind];
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) {
      arr.splice(idx, 1);
      saveToLocal(kind, arr);
      renderAllTables();
    }
    closeModal();
  });
}

/* ======= Pending Review (fixed: use _pid) ======= */

function openReviewPendingModal() {
  const list = store.pending || [];
  const sorted = list.slice().sort((a,b)=> parseDateFlexible(b)-parseDateFlexible(a));
  let html = `<h3>Pending Listings (${sorted.length})</h3><div style="text-align:left">`;
  if (sorted.length === 0) html += '<p>No pending listings</p>';
  for (const it of sorted) {
    ensurePendingPid(it);
    html += `
      <div style="border:1px solid #ddd;padding:8px;margin:6px;">
        <strong>[ ${it.type||'Item'} ] ${it.category || ''} – ${it.brand || ''}</strong><br>
        Reported by: ${it.reporter || it.foundBy || '—'}<br>
        Date: ${formatDateForColumn(it)}<br>
        Status: ${it.status || 'Pending'}<br>
        <div style="margin-top:6px">
          <button data-paction="view" data-pid="${it._pid}">View Details</button>
          <button data-paction="approve" data-pid="${it._pid}">Approve</button>
          <button data-paction="reject" data-pid="${it._pid}">Reject</button>
          <button data-paction="edit" data-pid="${it._pid}">Edit Before Approving</button>
        </div>
      </div>
    `;
  }
  html += `</div><div style="margin-top:1rem"><button id="close-pending">Close</button></div>`;
  showModal(html);

  const modal = q('#modal');
  modal.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const pa = btn.dataset.paction;
    const pid = btn.dataset.pid;
    if (!pa) return;
    const pidx = findPendingIndexByPid(pid);
    const item = pidx >= 0 ? store.pending[pidx] : null;
    if (pa === 'view') {
      if (item) openPendingDetailModal(item);
      else return;
    }
    if (pa === 'approve') {
      if (item) handlePendingApproveByPid(pid);
      else return;
    }
    if (pa === 'reject') {
      if (item) handlePendingRejectByPid(pid);
      else return;
    }
    if (pa === 'edit') {
      if (item) {
        const copy = Object.assign({}, item, {_kind: item.reportAs || 'lost', _pid: item._pid});
        openAddListingModal(copy);
      } else return;
    }
  }, {once:false});

  q('#close-pending').addEventListener('click', closeModal);
}

function openPendingDetailModal(item) {
  const html = `
    <h3>Pending — (no public id)</h3>
    <div style="text-align:left">
      <p><strong>Report Type:</strong> ${item.reportAs || '—'}</p>
      <p><strong>Category:</strong> ${item.category || '—'}</p>
      <p><strong>Type:</strong> ${item.type || '—'}</p>
      <p><strong>Brand/Model:</strong> ${item.brand || '—'}</p>
      <p><strong>Reporter/Finder:</strong> ${item.reporter || item.foundBy || '—'}</p>
      <p><strong>Contact:</strong> ${item.contact || '—'}</p>
      <p><strong>Submitted:</strong> ${formatDateOnly(item.submissionDate || item.postedAt || item.createdAt)}</p>
      <p><strong>Notes:</strong> ${item.notes || '—'}</p>
    </div>
    <div style="margin-top:1rem">
      <button id="pending-approve">Approve</button>
      <button id="pending-reject">Reject</button>
      <button id="pending-close">Close</button>
    </div>
  `;
  showModal(html);
  q('#pending-close').addEventListener('click', closeModal);
  q('#pending-approve').addEventListener('click', () => {
    handlePendingApproveByPid(item._pid);
  });
  q('#pending-reject').addEventListener('click', () => {
    handlePendingRejectByPid(item._pid);
  });
}

function handlePendingApproveByPid(pid) {
  const idx = findPendingIndexByPid(pid);
  if (idx === -1) return;
  const item = store.pending[idx];
  const destKind = (item.reportAs && (item.reportAs === 'found' ? 'found' : 'lost')) || 'lost';
  const assignedId = genId(destKind);
  // set approved status depending on destKind
  const approvedStatus = destKind === 'lost' ? 'Lost' : 'Unclaimed';
  const approved = Object.assign({}, item, {
    id: assignedId,
    status: approvedStatus,
    postedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    _kind: destKind
  });
  // remove internal pid before saving to collections
  delete approved._pid;
  store[destKind].push(approved);
  store.pending.splice(idx,1);
  saveToLocal(destKind, store[destKind]);
  saveToLocal('pending', store.pending);
  renderAllTables();
  closeModal();
}

/* ======= Init ======= */

async function initAdmin() {
  await loadAllData();
  wireControls();
  renderAllTables();

  q('#modal-overlay').addEventListener('click', (ev) => {
    if (ev.target.id === 'modal-overlay') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', initAdmin);