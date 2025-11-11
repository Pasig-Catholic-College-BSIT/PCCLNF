/* Admin UI behaviour for admin.html
   - Loads JSON datasets (falls back to localStorage for persistence)
   - Renders LOST / FOUND / CLAIMED tables
   - Search, category filter, sort
   - Add Listing modal (lost / found)
   - View Details modal
   - Update Listing modal
   - Delete with typed-ID confirmation
   - Pending review modal with Approve / Reject / Edit

   Improvements:
   - show images for pending, view and tables
   - support data: URLs and ../images/filename
   - read file as dataURL when admin uploads and preserve image
   - compress large dataURLs before saving to localStorage
   - safer localStorage save with fallback to strip images if quota exceeded
   - removed alert() calls (console warnings instead)
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
  try { localStorage.setItem(`pcclnf_${key}`, JSON.stringify(arr)); return true; } catch (e) { return false; }
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
  store.pending.forEach(ensurePendingPid);
  saveToLocal('pending', store.pending);
}

/* ======= Image helpers ======= */

// compress dataURL to a maximum width/height (returns Promise<string:dataURL>)
function shrinkDataUrl(dataUrl, maxWidth = 1200, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return resolve(dataUrl);
    const img = new Image();
    img.onload = function() {
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight) return resolve(dataUrl);
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      } catch (e) {
        console.warn('shrinkDataUrl failed', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// safe save to localStorage with fallback (try stripping images on failure)
function safeSaveCollection(key, arr) {
  if (saveToLocal(key, arr)) return true;
  console.warn('localStorage quota exceeded, attempting to strip images from older entries for', key);
  // try strip images from all but most recent 1 item
  try {
    const copy = JSON.parse(JSON.stringify(arr));
    for (let i = 0; i < copy.length - 1; i++) {
      if (copy[i] && copy[i].image && typeof copy[i].image === 'string' && copy[i].image.startsWith('data:')) {
        delete copy[i].image;
      }
    }
    if (saveToLocal(key, copy)) {
      // update in-memory collection to reflect images stripped
      store[key] = copy;
      return true;
    }
  } catch (e) {
    console.warn('safeSaveCollection fallback failed', e);
  }
  // final fallback: remove image from newest item and try again
  try {
    const arr2 = JSON.parse(JSON.stringify(arr));
    for (const it of arr2) if (it && it.image) delete it.image;
    if (saveToLocal(key, arr2)) {
      store[key] = arr2;
      return true;
    }
  } catch (e) { /* nothing else */ }
  console.error('Unable to save collection to localStorage for', key);
  return false;
}

/* ======= Rendering ======= */

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function thumbnailHtml(item) {
  if (item && item.image) {
    const src = (typeof item.image === 'string' && item.image.startsWith('data:')) ? item.image : `../images/${item.image}`;
    // use onerror to show placeholder
    return `<img src="${src}" alt="img" width="60" style="object-fit:cover" onerror="this.style.display='none'">`;
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

  let items = (store[kind] || []).slice();

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
      <td>${it.locationLost || it.locationFound || '—' }</td>
      <td>${getReporterOrStored(it)}</td>
      <td>${it.status || 'Unclaimed'}</td>
      <td>
        <button data-action="view" data-id="${it.id}" data-kind="${kind}">View Details</button>
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

  // new modal structure:
  // 1) header row with centered logo + title
  // 2) middle row: left attach image, right main form fields
  // 3) bottom row: full-width LOST / FOUND fieldset(s)
  // footer: action buttons
  const title = prefill ? 'Update Listing' : 'Add Listing';
  const html = `
    <div class="add-listing-modal">
      <div class="modal-header modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo" /><h2 class="modal-title">${title}</h2>
      </div>

      <form id="form-add" enctype="multipart/form-data" class="add-form">

        <div class="add-modal-middle">
          <aside class="add-left">
            <label class="img-dropzone" id="img-dropzone" tabindex="0" aria-label="Drop image here or click to choose">
              <input type="file" id="image-file" name="imageFile" accept="image/*" style="display:none">
              <div class="img-placeholder" id="img-placeholder">
                <div class="img-instructions">
                  <div style="font-weight:700;margin-bottom:6px">${prefill ? 'Replace image' : 'Attach image'}</div>
                  <div style="font-size:0.9rem;color:var(--medium-gray)">${prefill ? 'Click / drop to replace the image.' : 'Click or drop an image here. Optional but recommended.'}</div>
                </div>
              </div>

              <div class="img-preview-wrap" id="img-preview-wrap" style="display:none">
                <img id="image-preview" class="img-preview" alt="Preview">
                <div class="img-actions">
                  <button type="button" id="img-remove" class="btn-secondary">Remove</button>
                </div>
              </div>
            </label>
          </aside>

          <section class="add-right">
            <div class="right-top">
              <div style="display:flex;gap:125px;margin-bottom:8px;align-items:center;justify-content:center;">
                <label style="font-weight:700;display:flex;gap:6px;align-items:center">
                  <input type="radio" name="reportAs" value="lost" ${initialKind==='lost' ? 'checked' : ''}> REPORT AS LOST
                </label>
                <label style="font-weight:700;display:flex;gap:6px;align-items:center">
                  <input type="radio" name="reportAs" value="found" ${initialKind==='found' ? 'checked' : ''}> REPORT AS FOUND
                </label>
              </div>

              <div class="category-status-row">
                <label>
                  <select name="category" required>
                    <option value="" disabled selected>Select Category</option>
                    ${categoryOptionsHtml(prefill?.category || '')}
                  </select>
                </label>

                <!-- show status only when editing (prefill present) -->
                <label ${prefill ? '' : 'style="display:none"'} >
                  <select name="status" aria-label="Status">
                    ${ statusOptionsHtml(initialKind, prefill?.status || 'Pending') }
                  </select>
                </label>
              </div>

              <div style="display:flex;">
                <label style="flex:1">Type: <input name="type" value="${prefill?.type || ''}"></label>
                <label style="flex:1">Brand / Model: <input name="brand" value="${prefill?.brand || ''}"></label>
              </div>

              <div style="display:flex;">
                <label style="flex:1">Color: <input name="color" value="${prefill?.color || ''}"></label>
                <label style="flex:1">Contents: <input name="accessories" value="${prefill?.accessories || ''}"></label>
              </div>

              <div style="display:flex;">
                <label style="flex:1">Condition:
                  <select name="condition">
                    <option value="" disabled selected>-- select condition --</option>
                    ${conditionOptionsHtml(prefill?.condition || '')}
                  </select>
                </label>

                <label style="flex:1">Unique Mark: <input name="serial" value="${prefill?.serial || ''}"></label>
              </div>
            </div>
          </section>
        </div>

        <div class="add-modal-bottom">
        <fieldset id="lost-fields" class="bottom-fieldset">
          <legend>LOST REPORTER FORM</legend>

          <div class="fieldset-row">
            <label>Lost At:
              <input name="locationLost" value="${prefill?.locationLost || ''}">
            </label>
            <label>Date Lost:
              <input name="dateLost" type="date" value="${prefill?.dateLost || ''}">
            </label>
          </div>

          <div class="fieldset-row">
            <label>Owner / Reporter Name:
              <input name="reporter" value="${prefill?.reporter || ''}">
            </label>
            <label>Contact Info:
              <input name="contact" value="${prefill?.contact || ''}">
            </label>
          </div>
        </fieldset>

          <fieldset id="found-fields" class="bottom-fieldset" style="display:none;">
            <legend>FOUND REPORTER FORM</legend>

            <div class="fieldset-row">
              <label>Found At:
                <input name="locationFound" value="${prefill?.locationFound || ''}">
              </label>
              <label>Date Found:
                <input name="dateFound" type="date" value="${prefill?.dateFound || ''}">
              </label>
            </div>

            <div class="fieldset-row">
              <label>Found By:
                <input name="foundBy" value="${prefill?.foundBy || ''}">
              </label>
              <label>Currently Stored At:
                <input name="storedAt" value="${prefill?.storedAt || ''}">
              </label>
            </div>
          </fieldset>
        </div>

        <input type="hidden" id="existing-image" name="existingImage" value="${prefill?.image ? prefill.image : ''}">

        <div class="modal-footer">
          <button type="submit" class="btn-primary">${prefill ? 'Save Changes' : 'Submit Listing'}</button>
          <button type="button" id="cancel" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;
  showModal(html);

  // wire image preview + drag/drop + file input
  const fileInput = q('#image-file');
  const existingEl = q('#existing-image');
  const previewWrap = q('#img-preview-wrap');
  const previewImg = q('#image-preview');
  const placeholder = q('#img-placeholder');
  const dropzone = q('#img-dropzone');
  const removeBtn = q('#img-remove');

  // populate existing image if any
  if (prefill && prefill.image) {
    existingEl.value = prefill.image;
    const src = (typeof prefill.image === 'string' && prefill.image.startsWith('data:')) ? prefill.image : `../images/${prefill.image}`;
    previewImg.src = src;
    previewWrap.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
  }

  // open file picker when dropzone clicked
  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

    // drag/drop handlers
    dropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (ev) => {
      ev.preventDefault(); dropzone.classList.remove('dragover');
      const f = ev.dataTransfer?.files?.[0];
      if (f) { fileInput.files = ev.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); }
    });
  }

  // file change -> preview
  if (fileInput) {
    fileInput.addEventListener('change', (ev) => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        const dataUrl = evt.target.result;
        previewImg.src = dataUrl;
        previewWrap.style.display = '';
        if (placeholder) placeholder.style.display = 'none';
        existingEl.value = ''; // clear existing string, we'll set obj.image from file in submit flow
      };
      reader.readAsDataURL(f);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (previewImg) previewImg.src = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
      if (existingEl) existingEl.value = '';
    });
  }

  const frm = q('#form-add');
  function toggleFields() {
    if (!frm) return;
    const val = frm.reportAs.value;
    q('#lost-fields').style.display = val === 'lost' ? '' : 'none';
    q('#found-fields').style.display = val === 'found' ? '' : 'none';
    const statusSelect = q('select[name="status"]');
    if (statusSelect) {
      const cur = statusSelect.value || 'Pending';
      statusSelect.innerHTML = statusOptionsHtml(val, cur);
    }
  }
  if (frm) {
    toggleFields();
    qa('input[name="reportAs"]', frm).forEach(r => r.addEventListener('change', toggleFields));
  }

  // submit handler preserved from previous logic (uses fileInput & existing-image)
  if (frm) {
    frm.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      const fd = new FormData(frm);
      const obj = {};
      for (const [k, v] of fd.entries()) obj[k] = v;

      const existingImage = q('#existing-image')?.value || '';

      async function continueProcessing(withImage) {
        if (withImage) obj.image = withImage;
        else if (existingImage) obj.image = existingImage;
        const newKind = obj.reportAs;

        if (prefill) {
          const originalKind = prefill._kind || detectKindFromId(prefill.id) || 'pending';

          if (originalKind === 'pending') {
            const pid = prefill._pid;
            const pidx = findPendingIndexByPid(pid);
            if (pidx === -1) {
              console.warn('pending not found for edit', pid);
              return;
            }

            const pendingItem = Object.assign({}, store.pending[pidx], obj);
            if (!obj.status || obj.status === 'Pending') {
              pendingItem.status = 'Pending';
              pendingItem.lastUpdated = new Date().toISOString();
              store.pending[pidx] = pendingItem;
              safeSaveCollection('pending', store.pending);
            } else {
              const destKind = (obj.reportAs === 'found') ? 'found' : 'lost';
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
                delete claimedItem._pid;
                // compress image if present
                if (claimedItem.image && claimedItem.image.startsWith && claimedItem.image.startsWith('data:')) {
                  claimedItem.image = await shrinkDataUrl(claimedItem.image, 1200, 800, 0.7);
                }
                store.pending.splice(pidx, 1);
                store.claimed.push(claimedItem);
                safeSaveCollection('claimed', store.claimed);
                safeSaveCollection('pending', store.pending);
              } else {
                const assignedId = genId(destKind);
                const approvedStatus = destKind === 'lost' ? 'Lost' : 'Unclaimed';
                const approved = Object.assign({}, pendingItem, {
                  id: assignedId,
                  status: approvedStatus,
                  postedAt: new Date().toISOString(),
                  lastUpdated: new Date().toISOString(),
                  _kind: destKind
                });
                delete approved._pid;
                if (approved.image && approved.image.startsWith && approved.image.startsWith('data:')) {
                  approved.image = await shrinkDataUrl(approved.image, 1200, 800, 0.7);
                }
                store.pending.splice(pidx, 1);
                store[destKind].push(approved);
                safeSaveCollection(destKind, store[destKind]);
                safeSaveCollection('pending', store.pending);
              }
            }
          }
          else if (originalKind === 'lost' || originalKind === 'found') {
            const arr = store[originalKind];
            const idx = arr.findIndex(x => x.id === prefill.id);
            if (idx === -1) { console.warn('Item not found for update', prefill.id); return; }

            const originalId = arr[idx].id;
            const updated = Object.assign({}, arr[idx], obj, {
              category: obj.category || arr[idx].category,
              lastUpdated: new Date().toISOString(),
              status: obj.status || arr[idx].status
            });

            const newStatus = updated.status;

            if (updated.image && updated.image.startsWith && updated.image.startsWith('data:')) {
              updated.image = await shrinkDataUrl(updated.image, 1200, 800, 0.7);
            }

            if (newStatus === 'Pending') {
              arr.splice(idx, 1);
              safeSaveCollection(originalKind, arr);

              const pendingItem = Object.assign({}, updated);
              delete pendingItem.id;
              pendingItem.status = 'Pending';
              pendingItem.submissionDate = new Date().toISOString();
              pendingItem._kind = 'pending';
              ensurePendingPid(pendingItem);
              store.pending.push(pendingItem);
              safeSaveCollection('pending', store.pending);
            } else if (newStatus === 'Claimed' || newStatus === 'Returned') {
              arr.splice(idx, 1);
              safeSaveCollection(originalKind, arr);

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
              safeSaveCollection('claimed', store.claimed);
            } else {
              if (newKind && newKind !== originalKind) {
                arr.splice(idx, 1);
                safeSaveCollection(originalKind, arr);
                const newId = genId(newKind);
                const moved = Object.assign({}, updated, {
                  id: newId,
                  _kind: newKind
                });
                store[newKind].push(moved);
                safeSaveCollection(newKind, store[newKind]);
              } else {
                arr[idx] = updated;
                safeSaveCollection(originalKind, arr);
              }
            }
          }
          else if (originalKind === 'claimed') {
            const carr = store.claimed;
            const cidx = carr.findIndex(x => x.id === prefill.id);
            if (cidx === -1) { console.warn('Claimed item not found', prefill.id); return; }
            const claimed = Object.assign({}, carr[cidx], obj, {
              lastUpdated: new Date().toISOString(),
              status: obj.status || carr[cidx].status
            });

            if (claimed.image && claimed.image.startsWith && claimed.image.startsWith('data:')) {
              claimed.image = await shrinkDataUrl(claimed.image, 1200, 800, 0.7);
            }

            if (claimed.status === 'Pending') {
              carr.splice(cidx, 1);
              safeSaveCollection('claimed', carr);

              const pendingItem = Object.assign({}, claimed);
              delete pendingItem.id;
              delete pendingItem.originalId;
              delete pendingItem.dateClaimed;
              delete pendingItem.claimedFrom;
              pendingItem.status = 'Pending';
              pendingItem.submissionDate = new Date().toISOString();
              pendingItem._kind = 'pending';
              ensurePendingPid(pendingItem);
              store.pending.push(pendingItem);
              safeSaveCollection('pending', store.pending);
            }
            else if (claimed.status === 'Unclaimed') {
              carr.splice(cidx, 1);
              safeSaveCollection('claimed', carr);

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
              safeSaveCollection(destKind, store[destKind]);
            } else {
              carr[cidx] = claimed;
              safeSaveCollection('claimed', store.claimed);
            }
          }

        } else {
          // new listing -> push to pending list
          const item = Object.assign({}, obj, {
            status: 'Pending',
            submissionDate: new Date().toISOString(),
            _kind: 'pending'
          });
          if ('id' in item) delete item.id;
          ensurePendingPid(item);
          if (item.image && item.image.startsWith && item.image.startsWith('data:')) {
            item.image = await shrinkDataUrl(item.image, 1200, 800, 0.7);
          }
          store.pending.push(item);
          safeSaveCollection('pending', store.pending);
        }

        renderAllTables();
        closeModal();
      }

      if (fileInput && fileInput.files && fileInput.files[0]) {
        const f = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(evt) {
          const dataUrl = evt.target.result;
          continueProcessing(dataUrl);
        };
        reader.onerror = function() {
          continueProcessing(existingImage || '');
        };
        reader.readAsDataURL(f);
      } else {
        continueProcessing(existingImage || '');
      }
    });
  }

  q('#cancel')?.addEventListener('click', () => closeModal());
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
  const arr = store[kind] || [];
  const item = arr.find(x => x.id === id);
  if (!item) {
    console.warn('openViewModal: item not found', kind, id);
    return;
  }

  const imgSrc = item.image
    ? (typeof item.image === 'string' && item.image.startsWith('data:') ? item.image : `../images/${item.image}`)
    : '';

  const html = `
    <div class="add-listing-modal view-modal">
      <div class="modal-header modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo" />
        <h2 class="modal-title">Details of ITEM — ${item.id || ''}</h2>
      </div>

      <div class="view-form">
        <div class="add-modal-middle">
          <aside class="add-left" style="padding:8px;">
            ${ imgSrc ? `<div class="img-preview-wrap"><img id="view-image" class="img-preview" src="${imgSrc}" alt="item image"></div>` : `<div class="img-placeholder" style="padding:18px;color:var(--medium-gray)">No image available</div>` }
          <div class="modal-body2">
              <hr style="border:0;border-top:1px solid var(--light-gray)">

              <!-- 🟥 STATUS INFO -->
              <h3 style="margin:10px 0 6px;color:var(--primary)">Status Info</h3>
              <p><strong>Status:</strong> ${ item.status || '—' }</p>
              <p><strong>Posted:</strong> ${ formatDateOnly(item.postedAt || item.createdAt) }</p>
              <p><strong>Last Updated:</strong> ${ formatDateOnly(item.lastUpdated) }</p>
            </div>
            </aside>

          <section class="view-right">
            <div class="modal-body">
              <!-- 🟩 ITEM DETAILS -->
              <h3 style="color:var(--primary)">Item Details</h3>
              <p><strong> Category:</strong> ${ item.category || '—' }</p>
              <p><strong> Type:</strong> ${ item.type || '—' }</p>
              <p><strong> Brand / Model:</strong> ${ item.brand || '—' }</p>
              <p><strong> Color:</strong> ${ item.color || '—' }</p>
              <p><strong> Accessories / Contents:</strong> ${ item.accessories || '—' }</p>
              <p><strong> Condition:</strong> ${ item.condition || '—' }</p>
              <p><strong> Serial / Unique Mark:</strong> ${ item.serial || '—' }</p>

              <hr style="border:0;border-top:1px solid var(--light-gray)">

              <!-- 🟦 DISCOVERY INFO -->
              <h3 style="margin:10px 0 6px;color:var(--primary)">Discovery Info</h3>
              <p><strong>Report Type:</strong> ${ (item.reportAs || kind || '').toUpperCase() }</p>
              <p><strong>Reported By:</strong> ${ item.reporter || item.foundBy || '—' }</p>
              <p><strong>Contact:</strong> ${ item.contact || '—' }</p>
              <p><strong>Location Found / Lost:</strong> ${ item.locationFound || item.locationLost || '—' }</p>
              <p><strong>Date Found / Lost:</strong> ${ formatDateForColumn(item) }</p>

              <hr style="border:0;border-top:1px solid var(--light-gray)">

              <!-- 🟨 CLAIM INFORMATION -->
              <h3 style=;color:var(--primary)">Claim Information</h3>
              <p><strong>Claimed By:</strong> ${ item.claimedBy || '—' }</p>
              <p><strong>Claimed Date:</strong> ${ item.claimedAt ? formatDateOnly(item.claimedAt) : '—' }</p>
              </div>
          </section>
        </div>



        <div class="modal-close" style="margin-top:10px">
          <button id="close-details" class="btn-viewclose">Close</button>
        </div>
      </div>
    </div>s
  `;
  showModal(html);

  q('#close-details').addEventListener('click', closeModal);
}

/* ======= Update Listing (open pre-filled Add form) ======= */

function openUpdateModal(kind, id) {
  const arr = store[kind] || [];
  const item = arr.find(x => x.id === id);
  if (!item) {
    console.warn('openUpdateModal: item not found', kind, id);
    return;
  }
  const copy = Object.assign({}, item, {_kind: kind});
  openAddListingModal(copy);
}

/* ======= Delete with confirmation ======= */

function openDeleteConfirm(kind, id) {
  const html = `
    <div class="confirm-delete-modal">
      <div class="modal-header modal-header-centered" style="gap:8px;padding-bottom:8px;">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo" />
        <h2 class="modal-title">Delete Listing</h2>
      </div>

      <div class="modal-body" style="text-align:center">
        <p>To confirm deletion, type the Item ID exactly.</p>
        <p style="font-weight:700; letter-spacing:1px; font-size:2rem; margin:0">${id}</p>

        <label for="confirm-id" style="margin-top:8px;font-weight:700">Confirm Item ID</label>
        <input id="confirm-id" type="text" style="text-align:center" placeholder="${id}" aria-label="Type Item ID to confirm" />

        <div id="confirm-error" class="confirm-error" role="status" aria-live="polite" style="display:none;margin-top:8px">
          ID does not match. Deletion cancelled.
        </div>
      </div>

      <div class="modal-footer">
        <button id="do-delete" class="btn-danger">Delete</button>
        <button id="cancel-delete" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;
  showModal(html);

  const input = q('#confirm-id');
  const err = q('#confirm-error');
  const doDeleteBtn = q('#do-delete');
  const cancelBtn = q('#cancel-delete');

  // autofocus safely
  setTimeout(() => { if (input) input.focus(); }, 40);

  function clearError() {
    if (err) { err.style.display = 'none'; err.textContent = ''; }
  }

  function showError(msg) {
    if (err) { err.style.display = ''; err.textContent = msg || 'ID does not match.'; }
  }

  cancelBtn?.addEventListener('click', () => closeModal());

  // allow Enter to confirm
  input?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      doDeleteBtn?.click();
    }
    if (err && err.style.display !== 'none') clearError();
  });

  doDeleteBtn?.addEventListener('click', () => {
    const v = input ? input.value.trim() : '';
    if (v !== id) {
      showError('Typed ID does not match. Please type the exact Item ID.');
      return;
    }

    const arr = store[kind] || [];
    const idx = arr.findIndex(x => x.id === id);
    if (idx >= 0) {
      arr.splice(idx, 1);
      safeSaveCollection(kind, arr);
      renderAllTables();
    }
    closeModal();
  });
}

/* ======= Pending Review (fixed: use _pid, show images) ======= */

function openReviewPendingModal() {
  const list = store.pending || [];
  const sorted = list.slice().sort((a,b)=> parseDateFlexible(b)-parseDateFlexible(a));
  const count = sorted.length;

  let html = `
    <div class="pending-modal">
      <div class="modal-header modal-header-centered" style="gap:8px;padding-bottom:8px;">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo" />
        <h2 class="modal-title">Pending Listings</h2>
      </div>

      <div class="modal-body">
        <div class="pending-controls">
          <div class="left">
            <input id="pending-search" type="search" placeholder="Search pending..." />
            <select id="pending-filter">
              <option value="all">All categories</option>
              <option value="Personal Items">Personal Items</option>
              <option value="Electronics">Electronics</option>
              <option value="Documents">Documents</option>
              <option value="School / Office Supplies">School / Office Supplies</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
          <div class="right">
            <button id="pending-refresh" class="btn-secondary">Refresh</button>
          </div>
        </div>

        <div class="pending-list" id="pending-list">
          <div class="list-head">
            <div>Image</div><div>Details</div><div style="text-align:center">Actions</div>
          </div>
          ${ sorted.length === 0 ? `<div class="pending-empty">No pending listings</div>` : sorted.map(it => {
            const thumb = it.image ? (it.image.startsWith('data:') ? `<img src="${it.image}" alt="" />` : `<img src="../images/${it.image}" alt="" onerror="this.style.display='none'">`) : '';
            return `
              <div class="pending-item" data-pid="${it._pid}">
                <div class="thumb">${ thumb || '—' }</div>
                <div class="details">
                  <strong>${it.type || 'Item'} ${it.category ? `— ${it.category}` : ''}</strong>
                  <div class="meta">Reported by: ${it.reporter || it.foundBy || '—'} · ${formatDateForColumn(it)} · Status: ${it.status || 'Pending'}</div>
                </div>
                <div class="actions">
                  <button class="btn-view" data-paction="view" data-pid="${it._pid}">View</button>
                  <button class="btn-edit" data-paction="edit" data-pid="${it._pid}">Edit</button>
                  <button class="btn-approve" data-paction="approve" data-pid="${it._pid}">Approve</button>
                  <button class="btn-reject" data-paction="reject" data-pid="${it._pid}">Reject</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="modal-footer">
        <button id="pending-close-footer" class="btn-secondary">Close</button>
      </div>
    </div>
  `;
  showModal(html);

  const modal = q('#modal');

  // delegated click handling for pending item actions
  modal.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const pa = btn.dataset.paction;
    const pid = btn.dataset.pid;
    if (!pa) {
      // handle other controls
      if (btn.id === 'pending-refresh') {
        // reload content
        openReviewPendingModal();
      }
      if (btn.id === 'pending-close' || btn.id === 'pending-close-footer') closeModal();
      return;
    }
    const pidx = findPendingIndexByPid(pid);
    const item = pidx >= 0 ? store.pending[pidx] : null;
    if (!item) return;

    if (pa === 'view') {
      openPendingDetailModal(pid);
      return;
    }
    if (pa === 'edit') {
      // open edit modal prefilled (openAddListingModal handles editing)
      const copy = Object.assign({}, item, {_kind: item.reportAs || 'lost', _pid: item._pid});
      openAddListingModal(copy);
      return;
    }
    if (pa === 'approve') {
      handlePendingApproveByPid(pid);
      return;
    }
    if (pa === 'reject') {
      handlePendingRejectByPid(pid);
      return;
    }
  }, {once:false});

  // search/filter wiring
  q('#pending-search')?.addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    Array.from(q('#pending-list').querySelectorAll('.pending-item')).forEach(row => {
      const txt = row.querySelector('.details').innerText.toLowerCase();
      row.style.display = term && !txt.includes(term) ? 'none' : '';
    });
  });
  q('#pending-filter')?.addEventListener('change', (e) => {
    const val = e.target.value;
    Array.from(q('#pending-list').querySelectorAll('.pending-item')).forEach(row => {
      const pid = row.dataset.pid;
      const it = store.pending.find(x => x._pid === pid) || {};
      row.style.display = (val === 'all' || it.category === val) ? '' : 'none';
    });
  });

  q('#pending-close')?.addEventListener('click', closeModal);
  q('#pending-close-footer')?.addEventListener('click', closeModal);
}

function openPendingDetailModal(pidOrItem) {
  // accept either pid string or the item object
  const item = (typeof pidOrItem === 'string') ? (store.pending.find(p => p._pid === pidOrItem)) : pidOrItem;
  if (!item) {
    console.warn('openPendingDetailModal: pending item not found', pidOrItem);
    return;
  }

  const imgSrc = item.image
    ? (typeof item.image === 'string' && item.image.startsWith('data:') ? item.image : `../images/${item.image}`)
    : '';

  const html = `
    <div class="add-listing-modal view-modal pending-detail-modal">
      <div class="modal-header modal-header-centered">
        <img class="modal-logo" src="../images/pcclogo.png" alt="logo" />
        <h2 class="modal-title">Details ${item._pid ? `— ${item._pid}` : ''}</h2>
      </div>

      <div class="view-form">
        <div class="add-modal-middle">
          <aside class="add-left" style="padding:8px;">
            ${ imgSrc
              ? `<div class="img-preview-wrap"><img id="view-image" class="img-preview" src="${imgSrc}" alt="item image"></div>`
              : `<div class="img-placeholder" style="padding:18px;color:var(--medium-gray)">No image available</div>` }
            <div class="modal-body2">
              <hr style="border:0;border-top:1px solid var(--light-gray)">
              <h3 style="margin:10px 0 6px;color:var(--primary)">Status Info</h3>
              <p><strong>Status:</strong> ${ item.status || 'Pending' }</p>
              <p><strong>Submitted:</strong> ${ formatDateOnly(item.submissionDate || item.postedAt || item.createdAt) }</p>
              <p><strong>Last Updated:</strong> ${ formatDateOnly(item.lastUpdated) }</p>
            </div>
          </aside>

          <section class="view-right">
            <div class="modal-body">
              <h3 style="color:var(--primary)">Item Details</h3>
              <p><strong> Category:</strong> ${ item.category || '—' }</p>
              <p><strong> Type:</strong> ${ item.type || '—' }</p>
              <p><strong> Brand / Model:</strong> ${ item.brand || '—' }</p>
              <p><strong> Color:</strong> ${ item.color || '—' }</p>
              <p><strong> Accessories / Contents:</strong> ${ item.accessories || '—' }</p>
              <p><strong> Condition:</strong> ${ item.condition || '—' }</p>
              <p><strong> Serial / Unique Mark:</strong> ${ item.serial || '—' }</p>

              <hr style="border:0;border-top:1px solid var(--light-gray)">

              <h3 style="margin:10px 0 6px;color:var(--primary)">Discovery Info</h3>
              <p><strong>Report Type:</strong> ${ (item.reportAs || '—').toUpperCase() }</p>
              <p><strong>Reporter / Finder:</strong> ${ item.reporter || item.foundBy || '—' }</p>
              <p><strong>Contact:</strong> ${ item.contact || '—' }</p>
              <p><strong>Location Found / Lost:</strong> ${ item.locationFound || item.locationLost || '—' }</p>
              <p><strong>Date Found / Lost:</strong> ${ formatDateForColumn(item) }</p>

              <hr style="border:0;border-top:1px solid var(--light-gray)">

              <h3 style="color:var(--primary)">Additional Notes</h3>
              <div style="color:var(--medium-gray); margin-top:6px;">${ item.notes || item.description || '—' }</div>
            </div>
          </section>
        </div>

        <div class="modal-close" style="margin-top:10px">
          <button id="close-details" class="btn-viewclose">Close</button>
        </div>
      </div>
    </div>
  `;
  showModal(html);

  // wire action buttons
  q('#close-details')?.addEventListener('click', closeModal)
}

/* ======= Approve / Reject handlers ======= */

async function handlePendingApproveByPid(pid) {
  const idx = findPendingIndexByPid(pid);
  if (idx === -1) { console.warn('approve: pending not found', pid); return; }
  const item = store.pending[idx];
  const destKind = (item.reportAs && (item.reportAs === 'found' ? 'found' : 'lost')) || 'lost';
  const assignedId = genId(destKind);
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

  // compress image if it's a data URL to avoid huge localStorage usage
  if (approved.image && approved.image.startsWith && approved.image.startsWith('data:')) {
    approved.image = await shrinkDataUrl(approved.image, 1200, 800, 0.7);
  }

  store[destKind].push(approved);
  store.pending.splice(idx,1);

  // attempt safe saves
  safeSaveCollection(destKind, store[destKind]);
  safeSaveCollection('pending', store.pending);

  renderAllTables();
  closeModal();
}

function handlePendingRejectByPid(pid) {
  const idx = findPendingIndexByPid(pid);
  if (idx === -1) { console.warn('reject: pending not found', pid); return; }
  // reject simply remove from pending (or mark rejected)
  store.pending.splice(idx, 1);
  safeSaveCollection('pending', store.pending);
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

// Auto-sync when user side updates localStorage (so admin sees pending without reload)
window.addEventListener('storage', (ev) => {
  if (!ev.key) return;
  try {
    if (ev.key.startsWith('pcclnf_')) {
      const key = ev.key.replace('pcclnf_', '');
      store[key] = ev.newValue ? JSON.parse(ev.newValue) : [];
      console.info('admin sync: updated', key, store[key]?.length);
      renderAllTables();
    }
    if (ev.key === 'pcclnf_sync') {
      loadAllData().then(() => renderAllTables());
    }
  } catch (err) {
    console.error('admin storage sync error', err);
  }
});

document.addEventListener('DOMContentLoaded', initAdmin);

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = Array.from(document.querySelectorAll('button[id^="tab-"]'));
  if (!tabButtons.length) return;

  function setActiveTab(btn) {
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    btn.setAttribute('aria-pressed', 'true');

    // persist last active tab
    try { localStorage.setItem('pcclnf_activeTab', btn.id); } catch (e) {}

    // try to call existing pane switcher if present
    const kind = btn.id.replace(/^tab-/, '');
    if (typeof window.showPane === 'function') {
      try { window.showPane(kind); } catch (e) { /* noop */ }
    }

    // emit event for other scripts
    window.dispatchEvent(new CustomEvent('pcclnf:tabchange', { detail: { id: btn.id, kind } }));
  }

  // restore saved tab or pick first
  const saved = (function(){
    try { return localStorage.getItem('pcclnf_activeTab'); } catch(e){ return null; }
  })();
  const initial = tabButtons.find(b => b.id === saved) || tabButtons[0];
  if (initial) setActiveTab(initial);

  // wire clicks + keyboard (Enter/Space)
  tabButtons.forEach(btn => {
    btn.setAttribute('role', 'tab');
    btn.setAttribute('tabindex', '0');
    btn.addEventListener('click', () => setActiveTab(btn));
    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        setActiveTab(btn);
      }
    });
  });
});