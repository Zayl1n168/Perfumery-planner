// script.js — Fixed & Optimized for Fragrance Maker
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, where, orderBy, limit, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

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

/* ---------- DOM Elements with Null Safety ---------- */
const pages = {
  home: document.getElementById('page-home'),
  my: document.getElementById('page-my'),
  create: document.getElementById('page-create'),
  settings: document.getElementById('page-settings')
};

const themeToggle = document.getElementById('theme-toggle');
const form = document.getElementById('formula-form');
const publicCheckbox = document.getElementById('public-checkbox');

/* ---------- Theme Logic (Fixed ClassName) ---------- */
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark-mode', isDark); // Changed 'dark' to 'dark-mode'
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

/* ---------- Drawer & Navigation ---------- */
const menuBtn = document.getElementById('menu-btn');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');

const toggleDrawer = (open) => {
  drawer?.classList.toggle('open', open);
  drawerOverlay?.classList.toggle('show', open);
};

menuBtn?.addEventListener('click', () => toggleDrawer(true));
document.getElementById('drawer-close')?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

function setActivePage(pageId) {
  Object.values(pages).forEach(p => { if(p) p.style.display = 'none'; });
  if (pages[pageId]) {
    pages[pageId].style.display = 'block';
  }
  toggleDrawer(false);
}

document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => setActivePage(item.dataset.page));
});

/* ---------- Auth & State ---------- */
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  const signInBtn = document.getElementById('sign-in-btn');
  const userInfo = document.getElementById('user-info');
  
  if (user) {
    if(signInBtn) signInBtn.style.display = 'none';
    if(userInfo) userInfo.style.display = 'flex';
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-avatar').src = user.photoURL;
    renderMyFormulas();
  } else {
    if(signInBtn) signInBtn.style.display = 'block';
    if(userInfo) userInfo.style.display = 'none';
  }
  loadPublicFeed();
});

document.getElementById('sign-in-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));

/* ---------- Create Formula Logic ---------- */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Please sign in first!");

  const payload = {
    name: document.getElementById('name')?.value || "Unnamed",
    concentration: document.getElementById('concentration')?.value,
    gender: document.getElementById('gender')?.value,
    top_notes: document.getElementById('top_notes')?.value.split(','),
    uid: currentUser.uid,
    public: publicCheckbox?.checked || false,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "formulas"), payload);
    form.reset();
    alert("Formula Saved!");
    setActivePage('home');
  } catch (err) {
    console.error("Save failed", err);
  }
});

// Initial Page Load
setActivePage('home');
