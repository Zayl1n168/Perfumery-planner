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

/* --- Dynamic Entry --- */
const rowsContainer = document.getElementById('ingredient-rows-container');
const addRowBtn = document.getElementById('add-row-btn');

function createRow(container) {
  const div = document.createElement('div');
  div.className = 'ingredient-row';
  div.innerHTML = `
    <input type="text" placeholder="Material" class="ing-name" required style="flex:2">
    <input type="number" step="0.01" placeholder="mL" class="ing-ml" required style="flex:1">
    <select class="ing-cat" style="flex:1.2">
      <option value="Citrus">🍋 Citrus</option>
      <option value="Floral">🌸 Floral</option>
      <option value="Woody">🪵 Woody</option>
      <option value="Fresh">🌊 Fresh</option>
      <option value="Sweet">🍯 Sweet</option>
      <option value="Spicy">🌶️ Spicy</option>
    </select>
    <button type="button" class="remove-row">✕</button>`;
  div.querySelector('.remove-row').onclick = () => div.remove();
  container.appendChild(div);
}
if(addRowBtn) addRowBtn.onclick = () => createRow(rowsContainer);

/* --- Scent Profile Visualizer --- */
function getVisualizerHtml(comp) {
  if (!Array.isArray(comp) || comp.length === 0) return '<div class="scent-profile-bar"></div>';
  const colors = { Citrus: '#FFD700', Floral: '#FF69B4', Woody: '#8B4513', Fresh: '#00FFFF', Sweet: '#FFA500', Spicy: '#FF4500' };
  const totals = {};
  let totalMl = 0;
  comp.forEach(c => { 
    const val = parseFloat(c.ml) || 0;
    totals[c.category] = (totals[c.category] || 0) + val; 
    totalMl += val; 
  });
  if (totalMl === 0) return '<div class="scent-profile-bar"></div>';
  let html = '<div class="scent-profile-bar">';
  for (const cat in totals) {
    const width = (totals[cat] / totalMl) * 100;
    if (width > 0) html += `<div class="bar-segment" style="width:${width}%; background:${colors[cat] || '#888'}"></div>`;
  }
  return html + '</div>';
}

/* --- Scaling Logic --- */
window.updateScale = (id, baseJson) => {
  const multiplier = document.getElementById(`scale-${id}`).value;
  const base = JSON.parse(decodeURIComponent(baseJson));
  base.forEach((ing, i) => {
    const el = document.getElementById(`ml-${id}-${i}`);
    if (el) el.innerText = (parseFloat(ing.ml) * multiplier).toFixed(2) + 'mL';
  });
  document.getElementById(`val-${id}`).innerText = multiplier + 'x Batch';
};

/* --- Card Template --- */
function createCard(d, isOwner) {
  const data = d.data();
  const comp = Array.isArray(data.composition) ? data.composition : [];
  const compJson = encodeURIComponent(JSON.stringify(comp));

  return `
    <div class="fragrance-card">
      <div class="card-header-brand"><h3>${data.name || 'New Scent'}</h3></div>
      <div class="card-body">
        ${getVisualizerHtml(comp)}
        <div class="composition-list">
          ${comp.length > 0 ? comp.map((c, i) => `
            <div class="ing-item">
              <span>${c.name}</span>
              <b id="ml-${d.id}-${i}">${c.ml}mL</b>
            </div>`).join('') : '<p style="font-size:0.75rem; color:var(--muted)">Legacy formula: Edit to add mL data.</p>'}
        </div>
        ${comp.length > 0 ? `
          <div class="scaler-ui">
            <label id="val-${d.id}">1x Batch</label>
            <input type="range" id="scale-${d.id}" min="1" max="50" value="1" oninput="updateScale('${d.id}', '${compJson}')">
          </div>` : ''}
      </div>
      ${isOwner ? `<div class="card-actions" style="padding:10px; border-top:1px solid var(--border)"><button class="btn danger small" onclick="deleteFormula('${d.id}')">Delete</button></div>` : ''}
    </div>`;
}

/* --- Navigation & Menu --- */
function setActivePage(pageId) {
  const pages = { home: 'page-home', my: 'page-my', create: 'page-create', settings: 'page-settings' };
  Object.values(pages).forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  const activePage = document.getElementById(pages[pageId]);
  if(activePage) activePage.style.display = 'block';
  
  closeMenu();
  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') loadFeed('my');
}

function openMenu() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('show');
}

function closeMenu() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
}

/* --- Theme --- */
const themeToggle = document.getElementById('theme-toggle');
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark', isDark);
  if(themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};
themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

/* --- Firebase Logic --- */
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  if (user && document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
  setActivePage('home');
});

document.getElementById('formula-form').onsubmit = async (e) => {
  e.preventDefault();
  const rows = rowsContainer.querySelectorAll('.ingredient-row');
  const composition = Array.from(rows).map(r => ({
    name: r.querySelector('.ing-name').value,
    ml: r.querySelector('.ing-ml').value,
    category: r.querySelector('.ing-cat').value
  }));
  await addDoc(collection(db, "formulas"), {
    name: document.getElementById('name').value,
    composition,
    uid: currentUser.uid,
    author: currentUser.displayName,
    public: document.getElementById('public-checkbox').checked,
    createdAt: serverTimestamp()
  });
  setActivePage('my');
};

async function loadFeed(type) {
  const container = type === 'home' ? document.getElementById('cards') : document.getElementById('my-cards');
  if(!container) return;
  container.innerHTML = '<p style="padding:20px">Loading Lab...</p>';
  const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true), limit(25)) : query(collection(db, "formulas"), where("uid", "==", currentUser?.uid));
  const snap = await getDocs(q);
  container.innerHTML = '';
  snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

window.deleteFormula = async (id) => {
  if(confirm("Permanently wipe this formula?")) {
    await deleteDoc(doc(db, "formulas", id));
    loadFeed('my');
  }
};

/* --- Global Listeners --- */
document.getElementById('menu-btn').onclick = openMenu;
document.getElementById('drawer-close').onclick = closeMenu;
document.getElementById('drawer-overlay').onclick = closeMenu;
document.querySelectorAll('.drawer-item').forEach(item => {
  item.onclick = () => setActivePage(item.dataset.page);
});
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

if(rowsContainer && rowsContainer.children.length === 0) createRow(rowsContainer);
