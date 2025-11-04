// Admin dashboard prototype — structure + basic functionality.
// - Uses window.localStorage to persist JSON objects:
//    lostItems, foundItems, claimedItems, pendingListings
// - Provides: renderTable(type), addListing(role,type,data),
//   reviewPendingListings(), viewDetails(id,type), claimItem(id)
// - Minimal UI (no CSS). Console logs for actions not fully implemented.

// ----------------------------
// Sample data (used if no data in localStorage)
// ----------------------------
const SAMPLE_LOST = [
  { id: genId('lost'), title: 'Red Umbrella', description: 'Small red umbrella', category: 'other', location: 'Library', reporter: 'John D', timestamp: Date.now() - 1000 * 60 * 60 * 24, status: 'Unfound' },
  { id: genId('lost'), title: 'Student ID - 2021', description: 'ID card with student number', category: 'documents', location: 'Cafeteria', reporter: 'Mary P', timestamp: Date.now() - 1000 * 60 * 60 * 5, status: 'Unfound' }
];

const SAMPLE_FOUND = [
  { id: genId('found'), title: 'Black Wallet', description: 'Contains some cash', category: 'other', location: 'Main Gate', reporter: 'Security', timestamp: Date.now() - 1000 * 60 * 60 * 72, status: 'Unclaimed', storedAt: 'Main Office' }
];

const SAMPLE_CLAIMED = [
  { id: 'C-' + genId('lost'), title: 'Blue Scarf', description: 'Wool scarf', category: 'clothing', location: 'Gym', reporter: 'Admin', claimedBy: 'Elena', claimedAt: Date.now() - 1000 * 60 * 60 * 200, status: 'Verified' }
];

const SAMPLE_PENDING = [
  // Items posted by faculty/student pending admin approval
  { id: genId('lost'), type: 'lost', title: 'AirPods', description: 'white earbuds', category: 'electronics', location: 'Room 101', reporter: 'Student A', timestamp: Date.now() - 1000 * 60 * 60, status: 'Unfound' }
];

// ----------------------------
// Storage helpers
// ----------------------------
function saveJSON(key, obj) {
  window.localStorage.setItem(key, JSON.stringify(obj || []));
}

function loadJSON(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('JSON load error for', key, e);
    return null;
  }
}

// Initialize storage if empty
function initStorageIfEmpty() {
  if (!loadJSON('lostItems')) saveJSON('lostItems', SAMPLE_LOST);
  if (!loadJSON('foundItems')) saveJSON('foundItems', SAMPLE_FOUND);
  if (!loadJSON('claimedItems')) saveJSON('claimedItems', SAMPLE_CLAIMED);
  if (!loadJSON('pendingListings')) saveJSON('pendingListings', SAMPLE_PENDING);
}

// ----------------------------
// Utility helpers
// ----------------------------
function genId(kind) {
  // kind: 'lost' | 'found' | undefined
  const rand = Math.random().toString(36).slice(2, 9).toUpperCase();
  if (kind === 'lost') return 'L' + rand;
  if (kind === 'found') return 'F' + rand;
  return rand;
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  // return date only (calendar)
  return d.toLocaleDateString();
}

// ----------------------------
// Core functions required
// ----------------------------

function renderTable(type) {
  // type: 'lost' | 'found' | 'claimed'
  const map = { lost: 'lostItems', found: 'foundItems', claimed: 'claimedItems' };
  const key = map[type];
  const data = loadJSON(key) || [];
  const tbody = document.querySelector(`#table-${type} tbody`);
  if (!tbody) return;

  // filters
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const category = document.getElementById('filter-category')?.value || 'all';
  const sortOrder = document.getElementById('sort-order')?.value || 'newest';

  let list = data.slice();

  if (category !== 'all') {
    list = list.filter(i => (i.category || '').toLowerCase() === category.toLowerCase());
  }

  if (search) {
    list = list.filter(i => {
      return (i.title || '').toLowerCase().includes(search) ||
             (i.description || '').toLowerCase().includes(search) ||
             (i.location || '').toLowerCase().includes(search) ||
             (i.reporter || '').toLowerCase().includes(search);
    });
  }

  list.sort((a, b) => sortOrder === 'newest' ? (b.timestamp || 0) - (a.timestamp || 0) : (a.timestamp || 0) - (b.timestamp || 0));

  tbody.innerHTML = '';
  list.forEach(item => {
    // determine columns per table type
    const idCell = escapeHtml(item.id || '');
    const imgSrc = escapeHtml(item.image || '');
    const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="img" width="40" onerror="this.style.display='none'">` : '';
    const categoryCell = escapeHtml(item.category || '');
    const status = escapeHtml(item.status || (type === 'claimed' ? 'Pending' : (type === 'found' ? 'Unclaimed' : 'Unfound')));
    const viewBtn = `<button data-id="${item.id}" data-type="${type}" class="btn-view">View Details</button>`;
    const editBtn = `<button data-id="${item.id}" data-type="${type}" class="btn-edit">Update</button>`;
    const delBtn = `<button data-id="${item.id}" data-type="${type}" class="btn-delete">Delete</button>`;

    let dateCell = fmtDate(item.timestamp || item.claimedAt || Date.now());
    let placeCell = escapeHtml(item.location || item.storedAt || item.claimedFrom || '');
    let reporterOrClaimed = escapeHtml(item.reporter || item.claimedBy || '');

    // For found items the 'Currently Stored At' might be storedAt property
    if (type === 'found') {
      dateCell = fmtDate(item.timestamp || Date.now());
      placeCell = escapeHtml(item.location || item.storedAt || '');
      reporterOrClaimed = escapeHtml(item.reporter || '');
    }

    // For claimed items the claimedAt/claimedBy/claimedFrom fields should be used if present
    if (type === 'claimed') {
      dateCell = fmtDate(item.claimedAt || item.timestamp || Date.now());
      reporterOrClaimed = escapeHtml(item.claimedBy || item.reporter || '');
      placeCell = escapeHtml(item.claimedFrom || item.location || '');
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idCell}</td>
      <td>${imgHtml}</td>
      <td>${categoryCell}</td>
      <td>${dateCell}</td>
      <td>${placeCell}</td>
      <td>${reporterOrClaimed}</td>
      <td>${status}</td>
      <td>${viewBtn}</td>
      <td>${editBtn} ${delBtn}</td>
    `;
    tbody.appendChild(tr);
  });

  // attach simple listeners (no delegation)
  tbody.querySelectorAll('.btn-view').forEach(b => {
    b.addEventListener('click', () => viewDetails(b.dataset.id, b.dataset.type));
  });
  tbody.querySelectorAll('.btn-edit').forEach(b => {
    b.addEventListener('click', () => openAddEditModal('edit', b.dataset.type, b.dataset.id));
  });
  tbody.querySelectorAll('.btn-delete').forEach(b => {
    b.addEventListener('click', () => {
      if (!confirm('Delete this listing?')) return;
      deleteListing(b.dataset.type, b.dataset.id);
      renderTable(b.dataset.type);
    });
  });
}

function addListing(role, type, data) {
  // role: 'admin' | 'faculty' | 'student'
  // type: 'lost' | 'found'
  // data: object with title, description, category, location, reporter, timestamp
  const key = type === 'lost' ? 'lostItems' : 'foundItems';
  const list = loadJSON(key) || [];
  // ID rules: Lost -> starts with L; Found -> starts with F
  data.id = type === 'lost' ? genId('lost') : genId('found');
  // default status
  data.status = (type === 'lost') ? 'Unfound' : 'Unclaimed';
  data.timestamp = data.timestamp || Date.now();
  list.push(data);
  saveJSON(key, list);
  console.log(`${role} added ${type} listing`, data);
  renderTable(type);
}

function updateListing(type, id, newData) {
  const key = type === 'lost' ? 'lostItems' : (type === 'found' ? 'foundItems' : 'claimedItems');
  const list = loadJSON(key) || [];
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) return false;
  list[idx] = Object.assign({}, list[idx], newData);
  saveJSON(key, list);
  console.log('Updated listing', id);
  return true;
}

function deleteListing(type, id) {
  const key = type === 'lost' ? 'lostItems' : (type === 'found' ? 'foundItems' : 'claimedItems');
  let list = loadJSON(key) || [];
  list = list.filter(i => i.id !== id);
  saveJSON(key, list);
  console.log('Deleted listing', id);
}

function reviewPendingListings() {
  const pending = loadJSON('pendingListings') || [];
  openPendingModal(pending);
}

function approvePending(id) {
  let pending = loadJSON('pendingListings') || [];
  const idx = pending.findIndex(p => p.id === id);
  if (idx === -1) return;
  const item = pending[idx];
  // Move to appropriate list
  const key = item.type === 'lost' ? 'lostItems' : 'foundItems';
  const list = loadJSON(key) || [];
  // ensure ID follows rules for approved items
  const newId = item.type === 'lost' ? genId('lost') : genId('found');
  const savedCopy = Object.assign({}, item, { id: newId, timestamp: Date.now(), status: (item.type === 'lost' ? 'Unfound' : 'Unclaimed') });
  list.push(savedCopy);
  saveJSON(key, list);
  // remove pending
  pending = pending.filter(p => p.id !== id);
  saveJSON('pendingListings', pending);
  console.log('Approved pending item', id);
  closeModal();
  renderActivePane();
}

function rejectPending(id) {
  let pending = loadJSON('pendingListings') || [];
  pending = pending.filter(p => p.id !== id);
  saveJSON('pendingListings', pending);
  console.log('Rejected pending item', id);
  closeModal();
  renderActivePane();
}

function viewDetails(id, type) {
  // show full details modal
  const key = type === 'claimed' ? 'claimedItems' : (type === 'lost' ? 'lostItems' : 'foundItems');
  const list = loadJSON(key) || [];
  const item = list.find(i => i.id === id);
  if (!item) {
    alert('Item not found');
    return;
  }

  let html = `<h3 style="text-align:center">${escapeHtml(item.title)}</h3>
    <p><strong>Description:</strong> ${escapeHtml(item.description)}</p>
    <p><strong>Category:</strong> ${escapeHtml(item.category || '')}</p>
    <p><strong>Location:</strong> ${escapeHtml(item.location || '')}</p>
    <p><strong>Reporter:</strong> ${escapeHtml(item.reporter || '')}</p>
    <p><strong>Date:</strong> ${fmtDate(item.timestamp || item.claimedAt)}</p>
  `;

  if (type !== 'claimed') {
    html += `<div>
      <button id="btn-claim-now" data-id="${id}" data-type="${type}">Mark as Claimed</button>
      <button id="btn-close-modal">Close</button>
    </div>`;
  } else {
    html += `<div><button id="btn-close-modal">Close</button></div>`;
  }

  openModal(html);

  if (type !== 'claimed') {
    document.getElementById('btn-claim-now').addEventListener('click', () => {
      claimItem(id, type);
      closeModal();
      renderActivePane();
    });
  }
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
}

function claimItem(id, type) {
  // Move item from lost/found to claimedItems
  const srcKey = type === 'lost' ? 'lostItems' : 'foundItems';
  let list = loadJSON(srcKey) || [];
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) {
    console.warn('Item to claim not found', id);
    return;
  }
  const item = list.splice(idx, 1)[0];
  saveJSON(srcKey, list);
  const claimed = loadJSON('claimedItems') || [];
  // claimed ID should be "C-" + original id (L... or F...)
  const claimedId = 'C-' + item.id;
  const claimedCopy = Object.assign({}, item, { id: claimedId, claimedBy: 'Claimant (pending admin confirm)', claimedAt: Date.now(), status: 'Pending', claimedFrom: item.location || '' });
  claimed.push(claimedCopy);
  saveJSON('claimedItems', claimed);
  console.log('Item moved to claimedItems', claimedId);
}

// ----------------------------
// Modal helpers (simple)
// ----------------------------
function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  modal.innerHTML = html;
  overlay.style.display = 'block';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  modal.innerHTML = '';
  overlay.style.display = 'none';
}

// Add / Edit modal
function openAddEditModal(mode = 'add', type = 'lost', id = null) {
  // mode: 'add' | 'edit'
  const isEdit = mode === 'edit';
  const item = isEdit ? (loadJSON(type === 'lost' ? 'lostItems' : 'foundItems') || []).find(i => i.id === id) : {};
  const title = isEdit ? 'Edit Listing' : 'Add Listing';
  const html = `
    <h3>${title} (${type.toUpperCase()})</h3>
    <form id="form-listing">
      <label>Title: <input name="title" required value="${escapeHtml(item.title || '')}"></label><br>
      <label>Description:<br><textarea name="description" required>${escapeHtml(item.description || '')}</textarea></label><br>
      <label>Category:
        <select name="category">
          <option value="other" ${item.category === 'other' ? 'selected' : ''}>Other</option>
          <option value="electronics" ${item.category === 'electronics' ? 'selected' : ''}>Electronics</option>
          <option value="documents" ${item.category === 'documents' ? 'selected' : ''}>Documents</option>
          <option value="clothing" ${item.category === 'clothing' ? 'selected' : ''}>Clothing</option>
        </select>
      </label><br>
      <label>Location: <input name="location" value="${escapeHtml(item.location || '')}"></label><br>
      <label>Reporter: <input name="reporter" value="${escapeHtml(item.reporter || '')}"></label><br>
      <div>
        <button type="submit">${isEdit ? 'Update' : 'Post'}</button>
        <button type="button" id="btn-cancel">Cancel</button>
      </div>
    </form>
  `;
  openModal(html);

  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('form-listing').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title') || '',
      description: fd.get('description') || '',
      category: fd.get('category') || 'other',
      location: fd.get('location') || '',
      reporter: fd.get('reporter') || '',
      timestamp: Date.now()
    };
    if (isEdit && id) {
      updateListing(type, id, data);
    } else {
      // admin posts directly to list
      addListing('admin', type, data);
    }
    closeModal();
    renderActivePane();
  });
}

// Pending modal
function openPendingModal(pending) {
  if (!pending || !pending.length) {
    alert('No pending listings');
    return;
  }
  let html = '<h3>Pending Submissions</h3><div>';
  pending.forEach(p => {
    html += `<div style="border:1px solid #ccc; margin:0.5rem; padding:0.5rem;">
      <strong>[${escapeHtml(p.type)}]</strong> ${escapeHtml(p.title)} — ${escapeHtml(p.reporter)}<br>
      ${escapeHtml(p.description)}<br>
      <button data-id="${p.id}" class="pending-approve">Approve</button>
      <button data-id="${p.id}" class="pending-reject">Reject</button>
    </div>`;
  });
  html += `<div><button id="btn-close-pending">Close</button></div></div>`;
  openModal(html);

  document.querySelectorAll('.pending-approve').forEach(b => {
    b.addEventListener('click', () => approvePending(b.dataset.id));
  });
  document.querySelectorAll('.pending-reject').forEach(b => {
    b.addEventListener('click', () => rejectPending(b.dataset.id));
  });
  document.getElementById('btn-close-pending').addEventListener('click', closeModal);
}

// ----------------------------
// Helpers & wiring to UI
// ----------------------------
function escapeHtml(str) {
  return ('' + (str || '')).replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}

function renderActivePane() {
  const panes = ['lost', 'found', 'claimed'];
  panes.forEach(p => {
    const paneEl = document.getElementById(`pane-${p}`);
    if (!paneEl) return;
    paneEl.style.display = (activePane === p) ? '' : 'none';
    renderTable(p);
  });
}

// initial active pane
let activePane = 'lost';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initStorageIfEmpty();

  // Tab buttons
  document.getElementById('tab-lost').addEventListener('click', () => { activePane = 'lost'; renderActivePane(); });
  document.getElementById('tab-found').addEventListener('click', () => { activePane = 'found'; renderActivePane(); });
  document.getElementById('tab-claimed').addEventListener('click', () => { activePane = 'claimed'; renderActivePane(); });

  // Search, filters, sort -> re-render current pane
  document.getElementById('search-input').addEventListener('input', () => renderTable(activePane));
  document.getElementById('filter-category').addEventListener('change', () => renderTable(activePane));
  document.getElementById('sort-order').addEventListener('change', () => renderTable(activePane));

  // Add listing (Admin)
  document.getElementById('btn-add-listing').addEventListener('click', () => {
    // ask admin whether lost or found (simple prompt)
    const type = prompt('Add listing type: "lost" or "found"', 'lost');
    if (type !== 'lost' && type !== 'found') {
      alert('Cancelled: please enter "lost" or "found"');
      return;
    }
    openAddEditModal('add', type);
  });

  // Review pending
  document.getElementById('btn-review-pending').addEventListener('click', () => reviewPendingListings());

  // Modal overlay click -> close (not when clicking modal)
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Render initial
  renderActivePane();
});