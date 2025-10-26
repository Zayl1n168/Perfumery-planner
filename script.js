// script.js (module) — Public feed landing page, My Formulas, Create/Edit, Google sign-in
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, limit, startAfter, onSnapshot, getDocs, serverTimestamp
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
const provider = new GoogleAuthProvider();

/* ---------- DOM refs ---------- */
const tabs = {
  home: document.getElementById('tab-home'),
  my: document.getElementById('tab-my'),
  create: document.getElementById('tab-create'),
  settings: document.getElementById('tab-settings')
};
const pages = {
  home: document.getElementById('page-home'),
  my: document.getElementById('page-my'),
  create: document.getElementById('page-create'),
  settings: document.getElementById('page-settings')
};
const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userInfo = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');

const themeToggle = document.getElementById('theme-toggle');
const uiDarkToggle = document.getElementById('ui-dark-toggle');

const feedCards = document.getElementById('cards');
const feedStatus = document.getElementById('feed-status');
const loadMoreBtn = document.getElementById('load-more-btn');

const filterConcentration = document.getElementById('filter-concentration');
const filterGender = document.getElementById('filter-gender');
const sortBy = document.getElementById('sort-by');

const myCards = document.getElementById('my-cards');
const myStatus = document.getElementById('my-status');

const form = document.getElementById('formula-form');
const errorMessage = document.getElementById('error-message');

const imageInput = document.getElementById('image-file');
const imagePreview = document.getElementById('image-preview');
const publicCheckbox = document.getElementById('public-checkbox');
const saveBtn = document.getElementById('save-formula-button');
const updateBtn = document.getElementById('update-formula-button');
const cancelBtn = document.getElementById('cancel-edit-button');

const oilVolumeInput = document.getElementById('oil-volume');
const carrierVolumeInput = document.getElementById('carrier-volume');
const calcBtn = document.getElementById('calculate-concentration-btn');
const calcResult = document.getElementById('concentration-result');

let currentUser = null;
let lastVisible = null; // for pagination (public feed)
let pageSize = 25;
let previewFile = null;
let publicUnsub = null; // optional onSnapshot for live feed (we use one-time get + loadMore)

/* ---------- Theme (default light) ---------- */
const THEME_KEY = 'prefTheme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
document.body.classList.toggle('theme-dark', savedTheme === 'dark');
themeToggle.checked = savedTheme === 'dark';
uiDarkToggle && (uiDarkToggle.checked = savedTheme === 'dark');

themeToggle.addEventListener('change', () => {
  const t = themeToggle.checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, t);
  document.body.classList.toggle('theme-dark', t === 'dark');
});
uiDarkToggle && uiDarkToggle.addEventListener('change', () => {
  const t = uiDarkToggle.checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, t);
  document.body.classList.toggle('theme-dark', t === 'dark');
});

/* ---------- Nav handling ---------- */
Object.keys(tabs).forEach(k => {
  tabs[k].addEventListener('click', () => {
    setActiveTab(k);
  });
});
function setActiveTab(key) {
  Object.values(tabs).forEach(b => b.classList.remove('active'));
  tabs[key].classList.add('active');
  Object.values(pages).forEach(p => p.style.display = 'none');
  pages[key].style.display = 'block';
  if (key === 'home') loadPublicFeed(true);
  if (key === 'my') renderMyFormulas();
}

/* ---------- Auth ---------- */
signInBtn.addEventListener('click', async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { console.error('Sign-in failed', e); showError('Sign-in failed'); }
});
signOutBtn.addEventListener('click', async () => {
  try { await signOut(auth); } catch(e){ console.error(e); showError('Sign-out failed'); }
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    signInBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userNameSpan.textContent = user.displayName || user.email;
    userAvatar.src = user.photoURL || '';
    signOutBtn.style.display = 'inline-block';
    myStatus.style.display = 'none';
    // ensure "My Formulas" loads after sign in
    if (tabs.my.classList.contains('active')) renderMyFormulas();
  } else {
    signInBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    userNameSpan.textContent = '';
    signOutBtn.style.display = 'none';
    myCards.innerHTML = '';
    myStatus.style.display = 'block';
    myStatus.textContent = 'Sign in to see your formulas.';
  }
  // refresh feed to show displayName where needed
  if (tabs.home.classList.contains('active')) loadPublicFeed(true);
});

/* ---------- Utilities ---------- */
const esc = (s) => (typeof s === 'string') ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
const parseNotes = s => (!s ? [] : s.split(',').map(x => x.trim()).filter(Boolean));
const joinNotes = a => Array.isArray(a) ? a.join(', ') : '';

function showError(msg, seconds = 4000) {
  errorMessage.textContent = msg;
  errorMessage.style.display = 'block';
  setTimeout(()=> errorMessage.style.display='none', seconds);
}

/* ---------- Image preview (preview-only stored as data URL) ---------- */
imageInput.addEventListener('change', () => {
  const f = imageInput.files && imageInput.files[0];
  previewFile = f || null;
  if (f) {
    const url = URL.createObjectURL(f);
    imagePreview.style.display = 'block';
    imagePreview.innerHTML = `<img src="${url}" style="max-width:160px;border-radius:8px">`;
  } else {
    imagePreview.style.display = 'none';
    imagePreview.innerHTML = '';
  }
});

/* ---------- Concentration calculator ---------- */
calcBtn.addEventListener('click', () => {
  const oil = parseFloat(oilVolumeInput.value), carrier = parseFloat(carrierVolumeInput.value);
  if (isNaN(oil) || isNaN(carrier) || oil < 0 || carrier < 0) { calcResult.textContent = 'Enter valid numbers'; return; }
  const tot = oil + carrier; if (tot === 0) { calcResult.textContent = 'Total cannot be zero'; return; }
  calcResult.textContent = `Concentration: ${((oil/tot)*100).toFixed(2)}%`;
});

/* ---------- Public feed (landing page) ---------- */
async function loadPublicFeed(reset = false) {
  feedCards.innerHTML = '';
  feedStatus.style.display = 'block';
  feedStatus.textContent = 'Loading public formulas…';
  loadMoreBtn.style.display = 'none';
  if (reset) lastVisible = null;

  try {
    // build query
    const whereClauses = [ where('public', '==', true) ];
    const conc = filterConcentration.value;
    if (conc && conc !== 'all') whereClauses.push(where('concentration', '==', conc));
    const gender = filterGender.value;
    if (gender && gender !== 'all') whereClauses.push(where('gender', '==', gender));

    const direction = sortBy.value === 'oldest' ? 'asc' : 'desc';
    let q;
    if (!lastVisible) {
      q = query(collection(db,'formulas'), ...whereClauses, orderBy('createdAt', direction), limit(pageSize));
    } else {
      q = query(collection(db,'formulas'), ...whereClauses, orderBy('createdAt', direction), startAfter(lastVisible), limit(pageSize));
    }

    const snap = await getDocs(q);
    if (snap.empty && !lastVisible) {
      feedStatus.textContent = 'No public formulas yet.';
      return;
    }

    // append cards
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.forEach(d => feedCards.insertAdjacentHTML('beforeend', createCardHtml(d)));
    feedStatus.style.display = 'none';

    // pagination state
    if (snap.docs.length === pageSize) {
      lastVisible = snap.docs[snap.docs.length - 1];
      loadMoreBtn.style.display = 'inline-block';
    } else {
      loadMoreBtn.style.display = 'none';
    }

    // wire up card actions
    wireCardActions();
  } catch (e) {
    console.error('Public feed load failed', e);
    feedStatus.textContent = 'Error loading formulas.';
  }
}

loadMoreBtn.addEventListener('click', () => loadPublicFeed(false));
[filterConcentration, filterGender, sortBy].forEach(el => el.addEventListener('change', () => loadPublicFeed(true)));

/* ---------- Create / Update / Delete ---------- */
async function createFormula(payload) {
  try {
    payload.uid = currentUser.uid;
    payload.displayName = currentUser.displayName || currentUser.email;
    payload.public = !!payload.public;
    payload.createdAt = serverTimestamp();
    // attach image as data url for now (preview-only)
    if (previewFile) payload.imageDataUrl = await fileToDataUrl(previewFile);
    await addDoc(collection(db,'formulas'), payload);
  } catch (e) {
    console.error('Create failed', e);
    showError('Failed to save formula.');
  }
}

async function updateFormulaInDb(id, payload) {
  try {
    payload.updatedAt = serverTimestamp();
    if (previewFile) payload.imageDataUrl = await fileToDataUrl(previewFile);
    await updateDoc(doc(db,'formulas', id), payload);
  } catch (e) {
    console.error('Update failed', e);
    showError('Failed to update formula');
  }
}

async function deleteFormulaById(id) {
  if (!confirm('Delete this formula permanently?')) return;
  try {
    await deleteDoc(doc(db,'formulas', id));
    // refresh views
    loadPublicFeed(true);
    if (currentUser) renderMyFormulas();
  } catch (e) {
    console.error(e); showError('Delete failed');
  }
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const rdr = new FileReader();
    rdr.onload = () => res(rdr.result);
    rdr.onerror = rej;
    rdr.readAsDataURL(file);
  });
}

/* ---------- Render card HTML ---------- */
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
  const thumb = formula.imageDataUrl ? `<div class="card-thumb"><img src="${esc(formula.imageDataUrl)}" alt="thumb"></div>` :
    `<div class="card-thumb"><svg width="200" height="280" xmlns="http://www.w3.org/2000/svg"><rect rx="10" width="200" height="280" fill="#dcdcdc"/><text x="50%" y="50%" fill="#666" font-size="14" font-family="Arial" text-anchor="middle">Bottle</text></svg></div>`;

  const tagsHtml = formula.scent_family ? `<span class="${familyClass(formula.scent_family)}">${esc(formula.scent_family)}</span>` : '';
  const topPills = (formula.top_notes||[]).slice(0,3).map(n => `<div class="scent-pill">${esc(n)}</div>`).join('');
  const created = formula.createdAt && formula.createdAt.seconds ? new Date(formula.createdAt.seconds * 1000).toLocaleDateString() : '';

  // show owner badge if owner viewing
  const ownerControls = (currentUser && formula.uid === currentUser.uid) ? `
    <button class="small-btn edit-btn" data-id="${formula.id}">Edit</button>
    <button class="small-btn delete-btn" data-id="${formula.id}">Delete</button>
  ` : '';

  return `
    <article class="formula-card" data-id="${esc(formula.id)}">
      ${thumb}
      <div class="card-body">
        <div class="card-title">
          <h3>${esc(formula.name||'Unnamed')}</h3>
          <div style="text-align:right">
            ${tagsHtml}
            <div class="meta">${esc(formula.concentration||'—')} · ${esc(formula.launch_year||'—')}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;flex-direction:column">
            <div class="scent-tags">${topPills}</div>
            <div class="meta" style="margin-top:8px">By <strong>${esc(formula.displayName||'Anon')}</strong></div>
          </div>
          <div style="text-align:right">
            <div class="note-actions">
              <button class="small-btn view-btn" data-id="${formula.id}">View</button>
              ${ownerControls}
            </div>
            <div class="meta" style="margin-top:10px">${created}</div>
          </div>
        </div>

        <div class="pyramid" aria-hidden="true">
          <div class="cat">Top Notes</div><ul>${(formula.top_notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
          <div class="cat">Middle Notes</div><ul>${(formula.middle_notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
          <div class="cat">Base Notes</div><ul>${(formula.base_notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
        </div>
      </div>
    </article>
  `;
}

/* Attach event listeners to newly created cards */
function wireCardActions() {
  document.querySelectorAll('.formula-card').forEach(card => {
    const id = card.dataset.id;
    const viewBtn = card.querySelector('.view-btn');
    const editBtn = card.querySelector('.edit-btn');
    const delBtn = card.querySelector('.delete-btn');
    const pyramid = card.querySelector('.pyramid');

    viewBtn && viewBtn.addEventListener('click', async () => {
      // open modal-like read-only detail by expanding pyramid (simple)
      if (!pyramid) return;
      const isShown = pyramid.style.display === 'block';
      pyramid.style.display = isShown ? 'none' : 'block';
    });

    editBtn && editBtn.addEventListener('click', async () => {
      // populate create form for edit
      try {
        const d = (await getDocs(query(collection(db,'formulas'), where('__name__','==', id)))).docs[0];
        if (!d) { showError('Document not found'); return; }
        const data = d.data();
        populateFormForEdit(d.id, data);
        setActiveTab('create');
      } catch (e) { console.error(e); showError('Failed to load formula for edit'); }
    });

    delBtn && delBtn.addEventListener('click', () => {
      deleteFormulaById(id);
    });
  });
}

/* ---------- My Formulas (user's private) ---------- */
async function renderMyFormulas() {
  myCards.innerHTML = '';
  if (!currentUser) {
    myStatus.style.display = 'block';
    myStatus.textContent = 'Sign in to see your formulas.';
    return;
  }
  myStatus.style.display = 'none';
  try {
    const q = query(collection(db,'formulas'), where('uid','==', currentUser.uid), orderBy('createdAt','desc'), limit(pageSize));
    const snap = await getDocs(q);
    if (snap.empty) { myCards.innerHTML = '<p class="muted">You have no formulas yet.</p>'; return; }
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myCards.innerHTML = docs.map(d => createCardHtml(d)).join('');
    wireCardActions();
  } catch (e) {
    console.error('My formulas load failed', e); myCards.innerHTML = '<p class="muted">Error loading your formulas.</p>';
  }
}

/* ---------- Form handling ---------- */
function populateFormForEdit(id, data) {
  document.getElementById('name').value = data.name || '';
  document.getElementById('launch_year').value = data.launch_year || '';
  document.getElementById('concentration').value = data.concentration || '';
  document.getElementById('scent_family').value = data.scent_family || '';
  document.getElementById('sillage').value = data.sillage || '';
  document.getElementById('longevity').value = data.longevity || '';
  document.getElementById('gender').value = data.gender || '';
  document.getElementById('top_notes').value = joinNotes(data.top_notes || []);
  document.getElementById('middle_notes').value = joinNotes(data.middle_notes || []);
  document.getElementById('base_notes').value = joinNotes(data.base_notes || []);
  document.getElementById('personal_review').value = data.personal_review || '';
  publicCheckbox.checked = !!data.public;
  document.getElementById('formula-id-to-edit').value = id;

  if (data.imageDataUrl) {
    imagePreview.style.display = 'block';
    imagePreview.innerHTML = `<img src="${data.imageDataUrl}" style="max-width:160px;border-radius:8px">`;
  } else {
    imagePreview.style.display = 'none';
    imagePreview.innerHTML = '';
  }

  saveBtn.style.display = 'none';
  updateBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
}

cancelBtn.addEventListener('click', () => {
  form.reset(); document.getElementById('formula-id-to-edit').value = '';
  saveBtn.style.display = 'inline-block'; updateBtn.style.display = 'none'; cancelBtn.style.display = 'none';
  imagePreview.style.display = 'none'; previewFile = null;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  if (!name) { showError('Please name the formula'); return; }
  const top = parseNotes(document.getElementById('top_notes').value);
  const mid = parseNotes(document.getElementById('middle_notes').value);
  const base = parseNotes(document.getElementById('base_notes').value);
  if (top.length + mid.length + base.length === 0) { showError('Add at least one note'); return; }

  // require sign-in to save
  if (!currentUser) {
    try { await signInWithPopup(auth, provider); }
    catch (err) { showError('Sign-in required to save.'); return; }
  }

  const payload = {
    name,
    launch_year: document.getElementById('launch_year').value,
    concentration: document.getElementById('concentration').value,
    scent_family: document.getElementById('scent_family').value,
    sillage: document.getElementById('sillage').value,
    longevity: document.getElementById('longevity').value,
    gender: document.getElementById('gender').value,
    top_notes: top,
    middle_notes: mid,
    base_notes: base,
    personal_review: document.getElementById('personal_review').value.trim(),
    public: !!publicCheckbox.checked
  };

  saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
  await createFormula(payload);
  saveBtn.disabled = false; saveBtn.textContent = 'Save New Formula';
  form.reset(); imagePreview.style.display = 'none'; previewFile = null;
  // refresh views
  loadPublicFeed(true);
  if (currentUser) renderMyFormulas();
});

/* Update existing */
updateBtn.addEventListener('click', async () => {
  const id = document.getElementById('formula-id-to-edit').value;
  if (!id) return showError('No formula selected to update');
  const name = document.getElementById('name').value.trim();
  if (!name) { showError('Please name the formula'); return; }

  const payload = {
    name,
    launch_year: document.getElementById('launch_year').value,
    concentration: document.getElementById('concentration').value,
    scent_family: document.getElementById('scent_family').value,
    sillage: document.getElementById('sillage').value,
    longevity: document.getElementById('longevity').value,
    gender: document.getElementById('gender').value,
    top_notes: parseNotes(document.getElementById('top_notes').value),
    middle_notes: parseNotes(document.getElementById('middle_notes').value),
    base_notes: parseNotes(document.getElementById('base_notes').value),
    personal_review: document.getElementById('personal_review').value.trim(),
    public: !!publicCheckbox.checked
  };

  updateBtn.disabled = true; updateBtn.textContent = 'Updating...';
  await updateFormulaInDb(id, payload);
  updateBtn.disabled = false; updateBtn.textContent = 'Update';
  form.reset(); document.getElementById('formula-id-to-edit').value = '';
  saveBtn.style.display = 'inline-block'; updateBtn.style.display = 'none'; cancelBtn.style.display = 'none';
  imagePreview.style.display = 'none'; previewFile = null;
  loadPublicFeed(true); renderMyFormulas();
});

/* ---------- Boot / initial load ---------- */
setActiveTab('home');
loadPublicFeed(true);
