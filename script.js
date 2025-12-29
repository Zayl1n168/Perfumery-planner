import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, deleteDoc, doc 
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

drawerOverlay?.addEventListener('click', () => {
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
  loadPublicFeed();
});

document.getElementById('sign-in-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));

/* ---------- Public Feed Logic ---------- */
async function loadPublicFeed() {
  const feedCards = document.getElementById('cards');
  if (!feedCards) return;
  feedCards.innerHTML = '<p class="muted">Scanning the fragrance library...</p>';

  try {
    const q = query(collection(db, "formulas"), where("public", "==", true), orderBy("createdAt", "desc"), limit(25));
    const snap = await getDocs(q);
    feedCards.innerHTML = '';
    if (snap.empty) {
        feedCards.innerHTML = '<p class="muted">No public formulas yet.</p>';
        return;
    }
    snap.forEach((doc) => {
      const data = doc.data();
      feedCards.insertAdjacentHTML('beforeend', `
        <div class="card">
          <h3>${data.name}</h3>
          <p class="muted">${data.concentration} | By ${data.author}</p>
        </div>
      `);
    });
  } catch (err) { feedCards.innerHTML = '<p class="error">Error loading feed.</p>'; }
}

/* ---------- Create & My Formulas ---------- */
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
    setActivePage('home');
  } catch (err) { alert("Error: " + err.message); }
});

async function renderMyFormulas() {
  const myCards = document.getElementById('my-cards');
  if (!myCards || !currentUser) return;
  myCards.innerHTML = '<p class="muted">Opening your lab notebook...</p>';

  const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  myCards.innerHTML = '';
  
  snap.forEach(d => {
    const data = d.data();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <h3>${data.name}</h3>
        <p class="muted">${data.public ? '🌍 Public' : '🔒 Private'}</p>
        <button class="btn danger small delete-btn" data-id="${d.id}">Delete</button>
    `;
    card.querySelector('.delete-btn').onclick = () => deleteOne(d.id);
    myCards.appendChild(card);
  });
}

async function deleteOne(id) {
    if(confirm("Delete this formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        renderMyFormulas();
    }
}

/* ---------- Settings: Export & Clear ---------- */
document.getElementById('export-btn')?.addEventListener('click', async () => {
    if (!currentUser) return alert("Sign in to export!");
    const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => d.data());
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my_formulas_${new Date().toLocaleDateString()}.txt`;
    link.click();
});

document.getElementById('delete-all-btn')?.addEventListener('click', async () => {
    if (!currentUser) return alert("Sign in first!");
    if (confirm("DANGER: Wipe ALL your formulas? This cannot be undone.")) {
        const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
        const snap = await getDocs(q);
        const batch = snap.docs.map(d => deleteDoc(doc(db, "formulas", d.id)));
        await Promise.all(batch);
        alert("Lab cleaned!");
        setActivePage('home');
    }
});

setActivePage('home');
