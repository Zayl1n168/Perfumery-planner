// script.js — Perfumery Planner logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, where, orderBy, limit, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/* ---------- Firebase Configuration ---------- */
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

/* ---------- DOM Element References ---------- */
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

/* ---------- Theme Logic ---------- */
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark-mode', isDark);
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

/* ---------- Navigation Logic ---------- */
const toggleDrawer = (open) => {
  drawer?.classList.toggle('open', open);
  drawerOverlay?.classList.toggle('show', open);
};

function setActivePage(pageId) {
  Object.values(pages).forEach(p => { if(p) p.style.display = 'none'; });
  if (pages[pageId]) pages[pageId].style.display = 'block';
  toggleDrawer(false);
}

menuBtn?.addEventListener('click', () => toggleDrawer(true));
document.getElementById('drawer-close')?.addEventListener('click', () => toggleDrawer(false));
drawerOverlay?.addEventListener('click', () => toggleDrawer(false));

document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => setActivePage(item.dataset.page));
});

/* ---------- Auth State ---------- */
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const authArea = document.getElementById('auth-area');
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
  loadPublicFeed();
});

document.getElementById('sign-in-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));

/* ---------- THE SAVE FUNCTION (FORMULA CREATION) ---------- */
formulaForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("Please sign in with Google to save your formula!");
    return;
  }

  // 1. Gather values from the form
  const name = document.getElementById('name')?.value.trim();
  const concentration = document.getElementById('concentration')?.value;
  const gender = document.getElementById('gender')?.value;
  const topNotesRaw = document.getElementById('top_notes')?.value || "";
  const midNotesRaw = document.getElementById('middle_notes')?.value || "";
  const baseNotesRaw = document.getElementById('base_notes')?.value || "";
  const isPublic = document.getElementById('public-checkbox')?.checked || false;

  // 2. Validation
  if (!name) {
    alert("Please give your fragrance a name.");
    return;
  }

  // 3. Clean up the comma-separated strings into Arrays
  const cleanNotes = (str) => str.split(',').map(n => n.trim()).filter(n => n !== "");

  // 4. Prepare the data package (Payload)
  const payload = {
    name: name,
    concentration: concentration,
    gender: gender,
    top_notes: cleanNotes(topNotesRaw),
    middle_notes: cleanNotes(midNotesRaw),
    base_notes: cleanNotes(baseNotesRaw),
    uid: currentUser.uid,
    author: currentUser.displayName || "Anonymous",
    public: isPublic,
    createdAt: serverTimestamp()
  };

  try {
    // 5. Send to Firebase
    console.log("Saving formula...");
    const docRef = await addDoc(collection(db, "formulas"), payload);
    console.log("Saved with ID:", docRef.id);

    // 6. Success! Reset and Redirect
    alert("Formula saved successfully!");
    formulaForm.reset();
    setActivePage('home'); // Go to home to see the feed
  } catch (error) {
    console.error("Error saving to Firebase:", error);
    alert("Failed to save: " + error.message);
  }
});

/* ---------- Data Loading (Placeholders) ---------- */
async function loadPublicFeed() {
  const feedCards = document.getElementById('cards');
  if (!feedCards) return;
  feedCards.innerHTML = '<p class="muted">Loading formulas...</p>';
  // Feed logic would go here
}

async function renderMyFormulas() {
  // My Formulas logic would go here
}

// Startup
setActivePage('home');
