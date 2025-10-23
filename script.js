/* script.js — modular Firebase, Google sign-in required for saves, preview-only image upload */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/* ---------- Firebase config (your existing project) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8",
  measurementId: "G-94L63VLGMJ"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

/* ---------- DOM refs ---------- */
const form = document.getElementById('formula-form');
const formulaList = document.getElementById('formula-list');
const errorMessage = document.getElementById('error-message');
const saveButton = document.getElementById('save-formula-button');
const updateButton = document.getElementById('update-formula-button');
const cancelButton = document.getElementById('cancel-edit-button');
const formulaIdToEdit = document.getElementById('formula-id-to-edit');
const concentrationFilter = document.getElementById('concentration-filter');
const oilVolumeInput = document.getElementById('oil-volume');
const carrierVolumeInput = document.getElementById('carrier-volume');
const calculateButton = document.getElementById('calculate-concentration-btn');
const resultDisplay = document.getElementById('concentration-result');
const navButtons = document.querySelectorAll('.nav-button');
const pageTracker = document.getElementById('page-tracker');
const pageSettings = document.getElementById('page-settings');
const themeToggle = document.getElementById('theme-toggle');
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userInfo = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const signedHint = document.getElementById('signed-hint');
const imageInput = document.getElementById('image-file');
const imagePreview = document.getElementById('image-preview');

let currentUser = null;
let unsubscribeSnapshot = null;
let previewFile = null;

/* ---------- Theme handling (default = light) ---------- */
const THEME_KEY = 'prefTheme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
document.body.classList.toggle('theme-dark', savedTheme === 'dark');
themeToggle.checked = savedTheme === 'dark';
themeToggle.addEventListener('change', () => {
  const t = themeToggle.checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, t);
  document.body.classList.toggle('theme-dark', t === 'dark');
});

/* ---------- Utilities ---------- */
const parseNotes = (s) => !s ? [] : s.split(',').map(x => x.trim()).filter(Boolean);
const joinNotes = (a) => Array.isArray(a) ? a.join(', ') : '';
const esc = (t) => typeof t === 'string' ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
const showError = (msg, t=3500) => { errorMessage.textContent = msg; errorMessage.style.display = 'block'; setTimeout(()=>errorMessage.style.display='none', t); };

/* ---------- Auth: Google (sign-in button) ---------- */
const provider = new GoogleAuthProvider();
signInBtn.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error('Sign-in failed', e);
    showError('Sign-in failed');
  }
});
signOutBtn.addEventListener('click', async () => {
  try { await signOut(auth); } catch(e){ console.error(e); showError('Sign-out failed'); }
});

/* Auth state changes */
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    signInBtn.style.display = 'none';
    userInfo.style.display = 'inline-block';
    userNameSpan.textContent = user.displayName || user.email;
    signedHint.textContent = 'Viewing your formulas';
    renderAllFormulas();
  } else {
    signInBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    userNameSpan.textContent = '';
    signedHint.textContent = 'Sign in to save formulas.';
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    formulaList.innerHTML = '<p class="muted">Sign in to view your saved formulas (or create one and sign in when saving).</p>';
  }
});

/* ---------- Concentration Calculator ---------- */
calculateButton.addEventListener('click', () => {
  const oil = parseFloat(oilVolumeInput.value), carrier = parseFloat(carrierVolumeInput.value);
  if (isNaN(oil) || isNaN(carrier) || oil < 0 || carrier < 0) { resultDisplay.textContent = 'Enter valid numbers'; return; }
  const tot = oil + carrier; if (tot === 0) { resultDisplay.textContent = 'Total cannot be zero'; return; }
  resultDisplay.textContent = `Concentration: ${((oil/tot)*100).toFixed(2)}%`;
});

/* ---------- Firestore CRUD (per-user) ---------- */
async function createFormula(payload) {
  if (!currentUser) {
    // prompt sign in
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      showError('Sign-in required to save.');
      return;
    }
  }
  try {
    payload.uid = currentUser.uid;
    payload.createdAt = serverTimestamp();
    // store image preview as data URL if present (preview-only behavior)
    if (previewFile) {
      // convert to data URL
      const dataUrl = await fileToDataUrl(previewFile);
      payload.imageDataUrl = dataUrl; // not ideal for production but preview-only per request
    }
    await addDoc(collection(db, 'formulas'), payload);
  } catch (e) {
    console.error('Create failed', e);
    showError('Failed to save formula.');
  }
}

async function updateFormulaInDb(id, payload) {
  try {
    payload.updatedAt = serverTimestamp();
    if (previewFile) {
      const dataUrl = await fileToDataUrl(previewFile);
      payload.imageDataUrl = dataUrl;
    }
    await updateDoc(doc(db, 'formulas', id), payload);
  } catch (e) {
    console.error('Update failed', e);
    showError('Failed to update.');
  }
}

async function deleteFormulaById(id) {
  if (!confirm('Delete this formula permanently?')) return;
  try {
    await deleteDoc(doc(db, 'formulas', id));
  } catch (e) {
    console.error(e);
    showError('Delete failed');
  }
}

/* helper convert file -> data URL */
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const rdr = new FileReader();
    rdr.onload = () => res(rdr.result);
    rdr.onerror = rej;
    rdr.readAsDataURL(file);
  });
}

/* ---------- Render & realtime listener ---------- */
function familyClass(family) {
  if (!family) return 'scent-tag';
  const f = family.toLowerCase();
  if (f.includes('floral')) return 'scent-tag floral';
  if (f.includes('wood')) return 'scent-tag woody';
  if (f.includes('citr')) return 'scent-tag citrus';
  if (f.includes('gourm')) return 'scent-tag gourmand';
  if (f.includes('orient') || f.includes('amber')) return 'scent-tag oriental';
  if (f.includes('arom')) return 'scent-tag aromatic';
  return 'scent-tag';
}

function createCardHtml(formula) {
  const thumbHtml = formula.imageDataUrl
    ? `<div class="card-thumb"><img src="${esc(formula.imageDataUrl)}" alt="thumb"></div>`
    : `<div class="card-thumb"><img src="data:image/svg+xml;utf8,
      <svg xmlns='http://www.w3.org/2000/svg' width='200' height='280'>
      <rect rx='10' width='200' height='280' fill='%23dcdcdc'/>
      <text x='50%' y='50%' fill='%23666' font-size='14' font-family='Arial' text-anchor='middle'>Bottle</text>
      </svg>"></div>`;

  const top = formula.top_notes || [], mid = formula.middle_notes || [], base = formula.base_notes || [];
  const tags = formula.scent_family ? `<span class="${familyClass(formula.scent_family)}">${esc(formula.scent_family)}</span>` : '';
  const meta = `<div class="meta"><strong>${esc(formula.concentration||'—')}</strong> · ${esc(formula.launch_year||'—')}</div>`;
  const review = formula.personal_review ? `<p style="margin-top:8px;color:#777;font-size:0.92rem"><em>${esc(formula.personal_review)}</em></p>` : '';

  const pyramidHtml = `
    <div class="pyramid" data-id="${formula.id}">
      <div class="cat">Top Notes</div><ul>${top.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
      <div class="cat">Middle Notes</div><ul>${mid.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
      <div class="cat">Base Notes</div><ul>${base.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
    </div>`.replace(/\n/g,'');

  return `
    <div class="formula-card" data-id="${formula.id}">
      ${thumbHtml}
      <div class="card-body">
        <div class="card-title">
          <h3>${esc(formula.name || 'Unnamed')}</h3>
          <div style="text-align:right">
            ${tags}
            ${meta}
          </div>
        </div>

        <div class="scent-tags">
          ${(formula.top_notes||[]).slice(0,3).map(n=>`<div class="scent-pill">${esc(n)}</div>`).join('')}
        </div>

        <div class="note-actions">
          <button class="small-btn show-notes">Show Notes</button>
          <button class="small-btn edit-btn">Edit</button>
          <button class="small-btn delete-btn">Delete</button>
        </div>

        ${review}
        <div class="pyramid-wrap">
          <button class="pyramid-toggle">View Pyramid</button>
          ${pyramidHtml}
        </div>
      </div>
    </div>
  `;
}

function renderAllFormulas() {
  const filterVal = concentrationFilter.value || 'all';
  if (!currentUser) return;
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  formulaList.innerHTML = '<p class="muted">Loading formulas...</p>';

  const q = query(collection(db, 'formulas'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
  unsubscribeSnapshot = onSnapshot(q, snapshot => {
    const arr = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        top_notes: Array.isArray(data.top_notes) ? data.top_notes : parseNotes(data.top_notes || ''),
        middle_notes: Array.isArray(data.middle_notes) ? data.middle_notes : parseNotes(data.middle_notes || ''),
        base_notes: Array.isArray(data.base_notes) ? data.base_notes : parseNotes(data.base_notes || '')
      };
    });

    const filtered = filterVal === 'all' ? arr : arr.filter(i => i.concentration === filterVal);
    formulaList.innerHTML = filtered.length ? filtered.map(f => createCardHtml(f)).join('') : '<p class="muted">No formulas found.</p>';

    document.querySelectorAll('.formula-card').forEach(card => {
      const id = card.dataset.id;
      const editBtn = card.querySelector('.edit-btn');
      const delBtn = card.querySelector('.delete-btn');
      const showNotesBtn = card.querySelector('.show-notes');
      const pyramidToggle = card.querySelector('.pyramid-toggle');
      const pyramid = card.querySelector('.pyramid');

      const docData = filtered.find(x => x.id === id);

      editBtn && editBtn.addEventListener('click', () => {
        if (!docData) return;
        document.getElementById('name').value = docData.name || '';
        document.getElementById('launch_year').value = docData.launch_year || '';
        document.getElementById('concentration').value = docData.concentration || '';
        document.getElementById('scent_family').value = docData.scent_family || '';
        document.getElementById('sillage').value = docData.sillage || '';
        document.getElementById('longevity').value = docData.longevity || '';
        document.getElementById('gender').value = docData.gender || '';
        document.getElementById('top_notes').value = joinNotes(docData.top_notes || []);
        document.getElementById('middle_notes').value = joinNotes(docData.middle_notes || []);
        document.getElementById('base_notes').value = joinNotes(docData.base_notes || []);
        document.getElementById('personal_review').value = docData.personal_review || '';
        formulaIdToEdit.value = docData.id;
        if (docData.imageDataUrl) {
          imagePreview.style.display = 'block';
          imagePreview.innerHTML = `<img src="${esc(docData.imageDataUrl)}" style="max-width:120px;border-radius:8px">`;
        } else {
          imagePreview.style.display = 'none'; imagePreview.innerHTML = '';
        }
        saveButton.style.display = 'none';
        updateButton.style.display = 'inline-block';
        cancelButton.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      delBtn && delBtn.addEventListener('click', () => {
        if (!docData) return;
        deleteFormulaById(docData.id);
      });

      showNotesBtn && showNotesBtn.addEventListener('click', () => {
        if (!pyramid) return;
        const visible = pyramid.style.display === 'block';
        pyramid.style.display = visible ? 'none' : 'block';
        if (!visible) pyramid.classList.add('pyramid-enter');
      });

      pyramidToggle && pyramidToggle.addEventListener('click', () => {
        if (!pyramid) return;
        const isOn = pyramid.style.display === 'block';
        pyramid.style.display = isOn ? 'none' : 'block';
        if (!isOn) pyramid.classList.add('pyramid-enter');
      });
    });
  }, err => {
    console.error(err);
    formulaList.innerHTML = '<p style="color:#ffaaaa">Error loading formulas.</p>';
  });
}

/* ---------- Form handling (image preview, save & update) ---------- */
imageInput.addEventListener('change', () => {
  const f = imageInput.files && imageInput.files[0];
  previewFile = f || null;
  if (f) {
    const url = URL.createObjectURL(f);
    imagePreview.style.display = 'block';
    imagePreview.innerHTML = `<img src="${url}" style="max-width:120px;border-radius:8px">`;
  } else {
    imagePreview.style.display = 'none';
    imagePreview.innerHTML = '';
  }
});

const validateForm = () => {
  const name = document.getElementById('name').value.trim();
  if (!name) { showError('Please name the formula'); return false; }
  const t = parseNotes(document.getElementById('top_notes').value);
  const m = parseNotes(document.getElementById('middle_notes').value);
  const b = parseNotes(document.getElementById('base_notes').value);
  if (t.length + m.length + b.length === 0) { showError('Add at least one note'); return false; }
  return true;
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  // require sign-in (prompt)
  if (!currentUser) {
    try { await signInWithPopup(getAuth(), provider); }
    catch (err) { showError('Sign-in required to save.'); return; }
  }

  const payload = {
    name: document.getElementById('name').value.trim(),
    launch_year: document.getElementById('launch_year').value,
    concentration: document.getElementById('concentration').value,
    scent_family: document.getElementById('scent_family').value,
    sillage: document.getElementById('sillage').value,
    longevity: document.getElementById('longevity').value,
    gender: document.getElementById('gender').value,
    top_notes: parseNotes(document.getElementById('top_notes').value),
    middle_notes: parseNotes(document.getElementById('middle_notes').value),
    base_notes: parseNotes(document.getElementById('base_notes').value),
    personal_review: document.getElementById('personal_review').value.trim()
  };

  saveButton.disabled = true; saveButton.textContent = 'Saving...';
  await createFormula(payload);
  saveButton.disabled = false; saveButton.textContent = 'Save New Formula';
  form.reset(); imagePreview.style.display = 'none'; previewFile = null;
});

updateButton.addEventListener('click', async () => {
  const id = formulaIdToEdit.value;
  if (!id) return showError('No formula selected');
  if (!validateForm()) return;

  const payload = {
    name: document.getElementById('name').value.trim(),
    launch_year: document.getElementById('launch_year').value,
    concentration: document.getElementById('concentration').value,
    scent_family: document.getElementById('scent_family').value,
    sillage: document.getElementById('sillage').value,
    longevity: document.getElementById('longevity').value,
    gender: document.getElementById('gender').value,
    top_notes: parseNotes(document.getElementById('top_notes').value),
    middle_notes: parseNotes(document.getElementById('middle_notes').value),
    base_notes: parseNotes(document.getElementById('base_notes').value),
    personal_review: document.getElementById('personal_review').value.trim()
  };

  updateButton.disabled = true; updateButton.textContent = 'Updating...';
  await updateFormulaInDb(id, payload);
  updateButton.disabled = false; updateButton.textContent = 'Update Formula';
  form.reset(); formulaIdToEdit.value = ''; saveButton.style.display = 'inline-block'; updateButton.style.display = 'none'; cancelButton.style.display = 'none';
  imagePreview.style.display = 'none'; previewFile = null;
});

cancelButton.addEventListener('click', () => {
  form.reset(); formulaIdToEdit.value=''; saveButton.style.display='inline-block'; updateButton.style.display='none'; cancelButton.style.display='none';
  imagePreview.style.display = 'none'; previewFile = null;
});

/* ---------- Other listeners ---------- */
concentrationFilter.addEventListener('change', () => { if (currentUser) renderAllFormulas(); });

/* initialize page state */
document.addEventListener('DOMContentLoaded', () => {
  // keep current auth state listener active (already set above)
  // default content is shown until auth changes
});
