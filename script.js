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

/* --- Navigation & Theme --- */
const themeToggle = document.getElementById('theme-toggle');

const applyTheme = (isDark) => {
  document.body.classList.toggle('dark', isDark);
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

function setActivePage(pageId) {
  const pages = { home: 'page-home', my: 'page-my', create: 'page-create', settings: 'page-settings' };
  Object.values(pages).forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById(pages[pageId]).style.display = 'block';
  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') loadFeed('my');
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
}

document.querySelectorAll('.drawer-item').forEach(item => item.onclick = () => setActivePage(item.dataset.page));
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-close').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };

/* --- Auth --- */
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  if (user && document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
  setActivePage('home');
});
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

/* --- UI Logic --- */
function createCard(d, isOwner) {
  const data = d.data();
  return `
    <div class="fragrance-card">
      <div class="card-header-brand"><h3>${data.name}</h3></div>
      <div class="card-body">
        <p>Lab Tech: <span>${data.author || 'Anonymous'}</span></p>
        <p>Top: <span>${data.top_notes?.join(', ') || '—'}</span></p>
        <p>Heart: <span>${data.middle_notes?.join(', ') || '—'}</span></p>
        <p>Base: <span>${data.base_notes?.join(', ') || '—'}</span></p>
        <p>Style: <span>${data.concentration} (${data.gender})</span></p>
      </div>
      ${isOwner ? `
        <div class="card-actions">
          <button class="btn small" onclick="openEditModal('${d.id}', '${data.name}', '${data.top_notes?.join(',')}', '${data.middle_notes?.join(',')}', '${data.base_notes?.join(',')}')">EDIT</button>
          <button class="btn danger small" onclick="deleteFormula('${d.id}')">DELETE</button>
        </div>` : ''}
    </div>`;
}

async function loadFeed(type) {
  const container = type === 'home' ? document.getElementById('cards') : document.getElementById('my-cards');
  container.innerHTML = '<p>Syncing lab data...</p>';
  const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true), limit(20)) : query(collection(db, "formulas"), where("uid", "==", currentUser?.uid));
  const snap = await getDocs(q);
  container.innerHTML = '';
  snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

/* --- Edit & Delete --- */
window.openEditModal = (id, name, top, mid, base) => {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-top').value = top;
  document.getElementById('edit-middle').value = mid;
  document.getElementById('edit-base').value = base;
  document.getElementById('edit-modal').style.display = 'flex';
};

document.getElementById('edit-cancel').onclick = () => document.getElementById('edit-modal').style.display = 'none';

document.getElementById('edit-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const update = {
    name: document.getElementById('edit-name').value,
    top_notes: document.getElementById('edit-top').value.split(',').map(n => n.trim()),
    middle_notes: document.getElementById('edit-middle').value.split(',').map(n => n.trim()),
    base_notes: document.getElementById('edit-base').value.split(',').map(n => n.trim())
  };
  await updateDoc(doc(db, "formulas", id), update);
  document.getElementById('edit-modal').style.display = 'none';
  loadFeed('my');
};

window.deleteFormula = async (id) => {
  if(confirm("Permanently wipe this formula?")) {
    await deleteDoc(doc(db, "formulas", id));
    loadFeed('my');
  }
};

/* --- Create --- */
document.getElementById('formula-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Log in to save formulas.");
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
  setActivePage('my');
};
