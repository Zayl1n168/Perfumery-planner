import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, limit, getDocs, serverTimestamp, deleteDoc, doc 
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

/* --- UI Controls --- */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');
const rowsContainer = document.getElementById('ingredient-rows-container');

function openMenu() { drawer.classList.add('open'); overlay.classList.add('show'); }
function closeMenu() { drawer.classList.remove('open'); overlay.classList.remove('show'); }

function setActivePage(pageId) {
  const pages = ['page-home', 'page-my', 'page-create', 'page-settings'];
  pages.forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('page-' + pageId).style.display = 'block';
  closeMenu();
  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') loadFeed('my');
}

/* --- Formulation Logic --- */
function createRow() {
  const div = document.createElement('div');
  div.className = 'ingredient-row';
  div.innerHTML = `
    <select class="ing-type" style="flex:1"><option value="Top">Top</option><option value="Heart">Heart</option><option value="Base">Base</option></select>
    <input type="text" placeholder="Material" class="ing-name" required style="flex:2">
    <input type="number" step="0.01" placeholder="mL" class="ing-ml" required style="flex:0.8">
    <select class="ing-cat" style="flex:1">
      <option value="Citrus">🍋 Citrus</option><option value="Floral">🌸 Floral</option>
      <option value="Woody">🪵 Woody</option><option value="Fresh">🌊 Fresh</option>
      <option value="Sweet">🍯 Sweet</option><option value="Spicy">🌶️ Spicy</option>
    </select>
    <button type="button" class="remove-row" style="background:#ff4d4d; color:white">✕</button>`;
  div.querySelector('.remove-row').onclick = () => div.remove();
  rowsContainer.appendChild(div);
}

/* --- Rendering --- */
function getVisualizerHtml(comp) {
  if (!Array.isArray(comp) || comp.length === 0) return '';
  const colors = { Citrus: '#FFD700', Floral: '#FF69B4', Woody: '#8B4513', Fresh: '#00FFFF', Sweet: '#FFA500', Spicy: '#FF4500' };
  const totals = {}; let totalMl = 0;
  comp.forEach(c => { const val = parseFloat(c.ml) || 0; totals[c.category] = (totals[c.category] || 0) + val; totalMl += val; });
  if (totalMl === 0) return '';
  let html = '<div class="scent-profile-bar">';
  for (const cat in totals) {
    const width = (totals[cat] / totalMl) * 100;
    if (width > 0) html += `<div class="bar-segment" style="width:${width}%; background:${colors[cat] || '#888'}"></div>`;
  }
  return html + '</div>';
}

function createCard(d, isOwner) {
  const data = d.data();
  const comp = Array.isArray(data.composition) ? data.composition : [];
  const compJson = encodeURIComponent(JSON.stringify(comp));

  const renderSection = (type) => {
    const notes = comp.filter(n => n.type === type);
    if (notes.length === 0) return '';
    return `<div class="note-section-title">${type} Notes</div>` + 
      notes.map(n => `<div class="ing-item"><span>${n.name}</span><b id="ml-${d.id}-${comp.indexOf(n)}">${n.ml}mL</b></div>`).join('');
  };

  return `
    <div class="fragrance-card">
      <div class="card-header-brand">
        <h3>${data.name || 'Untitled'}</h3>
        <span class="badge">${data.concentration || 'EDP'}</span>
      </div>
      <div class="card-body">
        ${getVisualizerHtml(comp)}
        <div class="composition-list">
          ${comp.length > 0 ? (renderSection('Top') + renderSection('Heart') + renderSection('Base')) : '<p style="font-size:0.7rem; color:var(--muted)">Legacy formula.</p>'}
        </div>
        ${comp.length > 0 ? `
          <div class="scaler-ui">
            <label id="val-${d.id}" style="font-size:0.6rem; font-weight:bold;">1x Batch</label>
            <input type="range" id="scale-${d.id}" min="1" max="50" value="1" oninput="updateScale('${d.id}', '${compJson}')">
          </div>` : ''}
      </div>
      ${isOwner ? `<div class="card-actions" style="padding:10px; border-top:1px solid var(--border)"><button class="btn small" style="background:#ff4d4d;color:white" onclick="deleteFormula('${d.id}')">Delete</button></div>` : ''}
    </div>`;
}

/* --- Data & Events --- */
window.updateScale = (id, baseJson) => {
  const mult = document.getElementById(`scale-${id}`).value;
  const base = JSON.parse(decodeURIComponent(baseJson));
  base.forEach((n, i) => { const el = document.getElementById(`ml-${id}-${i}`); if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL'; });
  document.getElementById(`val-${id}`).innerText = mult + 'x Batch';
};

document.getElementById('formula-form').onsubmit = async (e) => {
  e.preventDefault();
  const rows = rowsContainer.querySelectorAll('.ingredient-row');
  const composition = Array.from(rows).map(r => ({
    type: r.querySelector('.ing-type').value,
    name: r.querySelector('.ing-name').value,
    ml: r.querySelector('.ing-ml').value,
    category: r.querySelector('.ing-cat').value
  }));
  await addDoc(collection(db, "formulas"), {
    name: document.getElementById('name').value,
    concentration: document.getElementById('concentration-input').value,
    composition, uid: auth.currentUser.uid, author: auth.currentUser.displayName,
    public: document.getElementById('public-checkbox').checked, createdAt: serverTimestamp()
  });
  setActivePage('my');
};

async function loadFeed(type) {
  const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
  container.innerHTML = '<p style="padding:20px">Loading...</p>';
  const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true), limit(25)) : query(collection(db, "formulas"), where("uid", "==", auth.currentUser?.uid));
  const snap = await getDocs(q);
  container.innerHTML = '';
  snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

/* --- Listeners --- */
onAuthStateChanged(auth, user => {
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  if (user && document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
  setActivePage('home');
});

document.getElementById('menu-btn').onclick = openMenu;
document.getElementById('drawer-close').onclick = closeMenu;
document.getElementById('drawer-overlay').onclick = closeMenu;
document.querySelectorAll('.drawer-item').forEach(item => item.onclick = () => setActivePage(item.dataset.page));
document.getElementById('add-row-btn').onclick = createRow;
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

const themeToggle = document.getElementById('theme-toggle');
themeToggle?.addEventListener('change', () => { document.body.classList.toggle('dark', themeToggle.checked); localStorage.setItem('prefTheme', themeToggle.checked ? 'dark' : 'light'); });
if(localStorage.getItem('prefTheme') === 'dark') { document.body.classList.add('dark'); if(themeToggle) themeToggle.checked = true; }

window.deleteFormula = async (id) => { if(confirm("Delete?")) { await deleteDoc(doc(db, "formulas", id)); loadFeed('my'); } };
createRow();
