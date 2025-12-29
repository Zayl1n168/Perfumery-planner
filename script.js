import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, deleteDoc, doc, updateDoc 
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

/* --- UI State & Navigation --- */
const pages = { home: document.getElementById('page-home'), my: document.getElementById('page-my'), create: document.getElementById('page-create'), settings: document.getElementById('page-settings') };
const themeToggle = document.getElementById('theme-toggle');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');

const applyTheme = (isDark) => {
  document.body.classList.toggle('dark', isDark);
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

function setActivePage(pageId) {
  Object.values(pages).forEach(p => p.style.display = 'none');
  pages[pageId].style.display = 'block';
  if (pageId === 'home') loadPublicFeed();
  if (pageId === 'my') renderMyFormulas();
  drawer.classList.remove('open');
  overlay.classList.remove('show');
}

document.getElementById('menu-btn').onclick = () => { drawer.classList.add('open'); overlay.classList.add('show'); };
document.getElementById('drawer-close').onclick = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };
overlay.onclick = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => item.onclick = () => setActivePage(item.dataset.page));

/* --- Auth --- */
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  if (user) {
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-avatar').src = user.photoURL;
  }
  loadPublicFeed();
});

document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

/* --- Feed Logic --- */
async function loadPublicFeed() {
  const cards = document.getElementById('cards');
  cards.innerHTML = '<p class="muted">Loading...</p>';
  const q = query(collection(db, "formulas"), where("public", "==", true), orderBy("createdAt", "desc"), limit(25));
  const snap = await getDocs(q);
  cards.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    cards.insertAdjacentHTML('beforeend', `<div class="card"><h3>${data.name}</h3><small>By ${data.author}</small><p>Top: ${data.top_notes?.join(', ')}</p></div>`);
  });
}

/* --- Create & Edit Logic --- */
const formulaForm = document.getElementById('formula-form');
formulaForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Sign in first");
  const payload = {
    name: document.getElementById('name').value,
    top_notes: document.getElementById('top_notes').value.split(',').map(n => n.trim()),
    middle_notes: document.getElementById('middle_notes').value.split(',').map(n => n.trim()),
    base_notes: document.getElementById('base_notes').value.split(',').map(n => n.trim()),
    concentration: document.getElementById('concentration').value,
    gender: document.getElementById('gender').value,
    uid: currentUser.uid, author: currentUser.displayName, public: document.getElementById('public-checkbox').checked, createdAt: serverTimestamp()
  };
  await addDoc(collection(db, "formulas"), payload);
  formulaForm.reset();
  setActivePage('home');
};

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');

window.openEdit = (id, name, top, mid, base) => {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-top').value = top;
  document.getElementById('edit-middle').value = mid;
  document.getElementById('edit-base').value = base;
  editModal.style.display = 'flex';
};

document.getElementById('edit-cancel').onclick = () => editModal.style.display = 'none';

editForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const update = {
    name: document.getElementById('edit-name').value,
    top_notes: document.getElementById('edit-top').value.split(','),
    middle_notes: document.getElementById('edit-middle').value.split(','),
    base_notes: document.getElementById('edit-base').value.split(',')
  };
  await updateDoc(doc(db, "formulas", id), update);
  editModal.style.display = 'none';
  renderMyFormulas();
};

/* --- My Formulas & Settings --- */
async function renderMyFormulas() {
  const container = document.getElementById('my-cards');
  if (!currentUser) return;
  const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
  const snap = await getDocs(q);
  container.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${data.name}</h3><button class="btn small edit-btn">Edit</button> <button class="btn danger small delete-btn">Delete</button>`;
    card.querySelector('.edit-btn').onclick = () => window.openEdit(d.id, data.name, data.top_notes?.join(','), data.middle_notes?.join(','), data.base_notes?.join(','));
    card.querySelector('.delete-btn').onclick = async () => { if(confirm("Delete?")) { await deleteDoc(doc(db, "formulas", d.id)); renderMyFormulas(); }};
    container.appendChild(card);
  });
}

document.getElementById('export-btn').onclick = async () => {
  const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => d.data());
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'backup.txt'; a.click();
};

document.getElementById('delete-all-btn').onclick = async () => {
  if(confirm("Wipe ALL data?")) {
    const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "formulas", d.id))));
    renderMyFormulas();
  }
};

setActivePage('home');
