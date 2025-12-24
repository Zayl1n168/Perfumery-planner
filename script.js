// script.js — Full Fragrance Maker Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/* ---------- Firebase Setup ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ---------- DOM Elements ---------- */
const pages = {
  home: document.getElementById('page-home'),
  my: document.getElementById('page-my'),
  create: document.getElementById('page-create'),
  settings: document.getElementById('page-settings')
};

const formulaForm = document.getElementById('formula-form');
const themeToggle = document.getElementById('theme-toggle');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const menuBtn = document.getElementById('menu-btn');

/* ---------- Navigation & Theme ---------- */
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark-mode', isDark);
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

function setActivePage(pageId) {
  Object.values(pages).forEach(p => { if(p) p.style.display = 'none'; });
  if (pages[pageId]) pages[pageId].style.display = 'block';
  
  if (pageId === 'home') loadPublicFeed();
  if (pageId === 'my') renderMyFormulas();
  
  drawer?.classList.remove('open');
  drawerOverlay?.classList.remove('show');
}

menuBtn?.addEventListener('click', () => {
  drawer?.classList.add('open');
  drawerOverlay?.classList.add('show');
});

document.getElementById('drawer-close')?.addEventListener('click', () => {
  drawer?.classList.remove('open');
  drawerOverlay?.classList.remove('show');
});

document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => setActivePage(item.dataset.page));
});

/* ---------- Authentication ---------- */
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const userInfo = document.getElementById('user-info');
  const signInBtn = document.getElementById('sign-in-btn');

  if (user) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-avatar').src = user.photoURL;
  } else {
    if (signInBtn) signInBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }
  loadPublicFeed(); // Always try to load feed regardless of auth
});

document.getElementById('sign-in-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));

/* ---------- Public Feed Logic ---------- */
async function loadPublicFeed() {
  const feedCards = document.getElementById('cards');
  if (!feedCards) return;

  feedCards.innerHTML = '<p class="muted">Scanning the fragrance library...</p>';

  try {
    const q = query(
      collection(db, "formulas"),
      where("public", "==", true),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const snap = await getDocs(q);
    feedCards.innerHTML = '';

    if (snap.empty) {
      feedCards.innerHTML = '<p class="muted">No public formulas yet. Create one to share!</p>';
      return;
    }

    snap.forEach((doc) => {
      const data = doc.data();
      const cardHtml = `
        <div class="card">
          <div class="card-header">
            <h3>${data.name}</h3>
            <span class="badge">${data.concentration}</span>
          </div>
          <div class="card-content">
            <p><strong>Top:</strong> ${data.top_notes?.join(', ') || 'N/A'}</p>
            <p><strong>Heart:</strong> ${data.middle_notes?.join(', ') || 'N/A'}</p>
            <p><strong>Base:</strong> ${data.base_notes?.join(', ') || 'N/A'}</p>
          </div>
          <div class="card-footer">
            <small>By ${data.author}</small>
            <small>${data.gender}</small>
          </div>
        </div>
      `;
      feedCards.insertAdjacentHTML('beforeend', cardHtml);
    });
  } catch (err) {
    console.error("Feed Error:", err);
    feedCards.innerHTML = '<p class="error">Unable to load formulas. Check your Firebase Rules or Browser Console.</p>';
  }
}

/* ---------- Create Formula Logic ---------- */
formulaForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Sign in first!");

  const cleanNotes = (id) => document.getElementById(id).value.split(',').map(n => n.trim()).filter(n => n !== "");

  const payload = {
    name: document.getElementById('name').value.trim(),
    concentration: document.getElementById('concentration').value,
    gender: document.getElementById('gender').value,
    top_notes: cleanNotes('top_notes'),
    middle_notes: cleanNotes('middle_notes'),
    base_notes: cleanNotes('base_notes'),
    uid: currentUser.uid,
    author: currentUser.displayName,
    public: document.getElementById('public-checkbox').checked,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "formulas"), payload);
    formulaForm.reset();
    alert("Formula Shared!");
    setActivePage('home');
  } catch (err) {
    alert("Save Error: " + err.message);
  }
});

/* ---------- My Formulas Logic ---------- */
async function renderMyFormulas() {
  const myCards = document.getElementById('my-cards');
  if (!myCards || !currentUser) return;
  myCards.innerHTML = '<p class="muted">Fetching your lab notebook...</p>';

  const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  myCards.innerHTML = '';
  
  snap.forEach(doc => {
    const data = doc.data();
    myCards.insertAdjacentHTML('beforeend', `<div class="card"><h3>${data.name}</h3><p>${data.public ? '🌍 Public' : '🔒 Private'}</p></div>`);
  });
}

// Start on Home
setActivePage('home');
