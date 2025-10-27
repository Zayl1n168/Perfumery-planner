// script.js — Perfumery Planner logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, limit, startAfter, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/* ---------- Firebase config ---------- */
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
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ---------- DOM Refs ---------- */
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
const publicCheckbox = document.getElementById('public-checkbox');
const saveBtn = document.getElementById('save-formula-button');
const updateBtn = document.getElementById('update-formula-button');
const cancelBtn = document.getElementById('cancel-edit-button');
const imageInput = document.getElementById('image-file');
const imagePreview = document.getElementById('image-preview');

/* ---------- Drawer ---------- */
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const menuBtn = document.getElementById('menu-btn');
const drawerClose = document.getElementById('drawer-close');
const drawerItems = document.querySelectorAll('.drawer-item');

/* ---------- Theme ---------- */
const THEME_KEY = 'prefTheme';
const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
document.body.classList.toggle('dark', savedTheme === 'dark');
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) themeToggle.checked = savedTheme === 'dark';
themeToggle?.addEventListener('change', () => {
  const t = themeToggle.checked ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, t);
  document.body.classList.toggle('dark', t === 'dark');
});

/* ---------- Auth ---------- */
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    signInBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userNameSpan.textContent = user.displayName || user.email;
    userAvatar.src = user.photoURL || '';
    signOutBtn.style.display = 'inline-block';
    if (pages.my.style.display === 'block') renderMyFormulas();
  } else {
    signInBtn.style.display = 'inline-block';
    userInfo.style.display = 'none';
    userNameSpan.textContent = '';
    userAvatar.src = '';
    signOutBtn.style.display = 'none';
    myCards.innerHTML = '';
    myStatus.style.display = 'block';
    myStatus.textContent = 'Sign in to see your formulas.';
  }
  loadPublicFeed(true);
});

signInBtn.addEventListener('click', async () => {
  try { await signInWithPopup(auth, provider); }
  catch (e) { showError('Sign-in failed'); console.error(e); }
});
signOutBtn.addEventListener('click', async () => {
  try { await signOut(auth); }
  catch (e) { showError('Sign-out failed'); console.error(e); }
});

/* ---------- Drawer Nav ---------- */
function openDrawer() {
  drawer.classList.add('open');
  drawerOverlay.classList.add('show');
}
function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('show');
}
menuBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

drawerItems.forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    setActivePage(page);
    closeDrawer();
  });
});

/* ---------- Page Navigation ---------- */
function setActivePage(page) {
  Object.values(pages).forEach(p => p.style.display = 'none');
  pages[page].style.display = 'block';

  if (page === 'home') loadPublicFeed(true);
  if (page === 'my') renderMyFormulas();
}

/* ---------- Feed ---------- */
let lastVisible = null;
const pageSize = 25;

async function loadPublicFeed(reset = false) {
  feedCards.innerHTML = '';
  feedStatus.textContent = 'Loading public formulas…';
  loadMoreBtn.style.display = 'none';
  if (reset) lastVisible = null;

  try {
    const filters = [where('public', '==', true)];
    if (filterConcentration?.value && filterConcentration.value !== 'all')
      filters.push(where('concentration', '==', filterConcentration.value));
    if (filterGender?.value && filterGender.value !== 'all')
      filters.push(where('gender', '==', filterGender.value));

    const direction = sortBy?.value === 'oldest' ? 'asc' : 'desc';
    const baseQuery = query(
      collection(db, 'formulas'),
      ...filters,
      orderBy('createdAt', direction),
      ...(lastVisible ? [startAfter(lastVisible)] : []),
      limit(pageSize)
    );

    const snap = await getDocs(baseQuery);
    if (snap.empty && !lastVisible) {
      feedStatus.textContent = 'No public formulas yet.';
      return;
    }

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.forEach(d => feedCards.insertAdjacentHTML('beforeend', createCardHtml(d)));
    feedStatus.textContent = '';

    if (snap.docs.length === pageSize) {
      lastVisible = snap.docs[snap.docs.length - 1];
      loadMoreBtn.style.display = 'inline-block';
    } else loadMoreBtn.style.display = 'none';

    wireCardActions();
  } catch (e) {
    console.error(e);
    feedStatus.textContent = 'Error loading formulas.';
  }
}
loadMoreBtn.addEventListener('click', () => loadPublicFeed(false));
[filterConcentration, filterGender, sortBy].forEach(el => el?.addEventListener('change', () => loadPublicFeed(true)));

/* ---------- My Formulas ---------- */
async function renderMyFormulas() {
  myCards.innerHTML = '';
  if (!currentUser) {
    myStatus.style.display = 'block';
    myStatus.textContent = 'Sign in to see your formulas.';
    return;
  }
  myStatus.style.display = 'none';
  try {
    const q = query(
      collection(db, 'formulas'),
      where('uid', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      myCards.innerHTML = '<p class="muted">You have no formulas yet.</p>';
      return;
    }
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    myCards.innerHTML = docs.map(d => createCardHtml(d)).join('');
    wireCardActions();
  } catch (e) {
    console.error(e);
    myCards.innerHTML = '<p class="muted">Error loading your formulas.</p>';
  }
}

/* ---------- Create / Update ---------- */
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) {
    try { await signInWithPopup(auth, provider); }
    catch { return showError('Sign-in required'); }
  }

  const name = document.getElementById('name').value.trim();
  if (!name) return showError('Please name the formula');

  const payload = {
    name,
    launch_year: document.getElementById('launch_year').value,
    concentration: document.getElementById('concentration').value,
    scent_family: document.getElementById('scent_family').value,
    gender: document.getElementById('gender').value,
    top_notes: parseNotes(document.getElementById('top_notes').value),
    middle_notes: parseNotes(document.getElementById('middle_notes').value),
    base_notes: parseNotes(document.getElementById('base_notes').value),
    personal_review: document.getElementById('personal_review').value.trim(),
    public: !!publicCheckbox.checked,
    uid: currentUser.uid,
    displayName: currentUser.displayName || currentUser.email,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'formulas'), payload);
    form.reset();
    showError('Formula saved!', 2500);
    loadPublicFeed(true);
    renderMyFormulas();
  } catch (e) {
    console.error(e);
    showError('Failed to save formula');
  }
});

/* ---------- Helpers ---------- */
function esc(s) {
  return typeof s === 'string'
    ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    : '';
}
function parseNotes(s) {
  return (!s ? [] : s.split(',').map(x => x.trim()).filter(Boolean));
}
function showError(msg, time = 3000) {
  errorMessage.textContent = msg;
  errorMessage.style.display = 'block';
  setTimeout(() => errorMessage.style.display = 'none', time);
}

/* ---------- Card Rendering ---------- */
function createCardHtml(f) {
  const img = f.imageDataUrl
    ? `<img src="${esc(f.imageDataUrl)}" alt="bottle" style="width:100%;border-radius:6px;">`
    : `<div style="width:100%;height:180px;background:#ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#555;">No Image</div>`;
  const date = f.createdAt?.seconds ? new Date(f.createdAt.seconds * 1000).toLocaleDateString() : '';
  const owner = currentUser && f.uid === currentUser.uid;
  return `
    <div class="card" data-id="${esc(f.id)}">
      ${img}
      <h3>${esc(f.name || 'Unnamed')}</h3>
      <p>${esc(f.concentration || '')} • ${esc(f.gender || '')}</p>
      <p>By ${esc(f.displayName || 'Anon')}</p>
      <small>${date}</small>
      <div style="margin-top:8px;">
        ${owner ? `<button class="small-btn delete-btn" data-id="${f.id}">Delete</button>` : ''}
      </div>
    </div>
  `;
}

function wireCardActions() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      if (!confirm('Delete this formula?')) return;
      await deleteDoc(doc(db, 'formulas', id));
      loadPublicFeed(true);
      renderMyFormulas();
    });
  });
}

/* ---------- Start ---------- */
setActivePage('home');
