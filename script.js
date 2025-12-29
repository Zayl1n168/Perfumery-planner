import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, limit, getDocs, serverTimestamp, deleteDoc, doc, updateDoc 
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

/* --- Dynamic Entry Logic --- */
const rowsContainer = document.getElementById('ingredient-rows-container');
const addRowBtn = document.getElementById('add-row-btn');

function createRow(container, data = { name: '', ml: '', cat: 'Floral' }) {
  const div = document.createElement('div');
  div.className = 'ingredient-row';
  div.innerHTML = `
    <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
    <input type="number" step="0.1" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
    <select class="ing-cat" style="flex:1">
      <option value="Citrus" ${data.cat === 'Citrus' ? 'selected' : ''}>🍋 Citrus</option>
      <option value="Floral" ${data.cat === 'Floral' ? 'selected' : ''}>🌸 Floral</option>
      <option value="Woody" ${data.cat === 'Woody' ? 'selected' : ''}>🪵 Woody</option>
      <option value="Fresh" ${data.cat === 'Fresh' ? 'selected' : ''}>🌊 Fresh</option>
      <option value="Sweet" ${data.cat === 'Sweet' ? 'selected' : ''}>🍯 Sweet</option>
    </select>
    <button type="button" class="remove-row">✕</button>`;
  div.querySelector('.remove-row').onclick = () => div.remove();
  container.appendChild(div);
}
addRowBtn.onclick = () => createRow(rowsContainer);

/* --- Scent Map Visualizer --- */
function getVisualizerHtml(comp) {
  const colors = { Citrus: '#FFD700', Floral: '#FF69B4', Woody: '#8B4513', Fresh: '#00FFFF', Sweet: '#FFA500' };
  const totals = {};
  let totalMl = 0;
  comp.forEach(c => { totals[c.category] = (totals[c.category] || 0) + Number(c.ml); totalMl += Number(c.ml); });
  
  let html = '<div class="scent-profile-bar">';
  for (const cat in totals) {
    const width = (totals[cat] / totalMl) * 100;
    html += `<div class="bar-segment" style="width:${width}%; background:${colors[cat]}"></div>`;
  }
  return html + '</div>';
}

/* --- Scaling Logic --- */
window.updateScale = (id, baseValuesJson) => {
  const multiplier = document.getElementById(`scale-${id}`).value;
  const baseValues = JSON.parse(decodeURIComponent(baseValuesJson));
  baseValues.forEach((ing, index) => {
    const el = document.getElementById(`ml-${id}-${index}`);
    if (el) el.innerText = (ing.ml * multiplier).toFixed(1) + 'mL';
  });
};

/* --- UI Card --- */
function createCard(d, isOwner) {
  const data = d.data();
  const comp = data.composition || [];
  const compJson = encodeURIComponent(JSON.stringify(comp));

  return `
    <div class="fragrance-card">
      <div class="card-header-brand"><h3>${data.name}</h3></div>
      <div class="card-body">
        ${getVisualizerHtml(comp)}
        <div class="composition-list">
          ${comp.map((c, i) => `
            <div class="ing-item">
              <span>${c.name}</span>
              <b id="ml-${d.id}-${i}">${c.ml}mL</b>
            </div>`).join('')}
        </div>
        <div class="scaler-ui">
          <label>Batch Size: </label>
          <input type="range" id="scale-${d.id}" min="1" max="20" value="1" oninput="updateScale('${d.id}', '${compJson}')">
        </div>
      </div>
      ${isOwner ? `<div class="card-actions"><button class="btn danger small" onclick="deleteFormula('${d.id}')">Delete</button></div>` : ''}
    </div>`;
}

/* --- Theme & Core --- */
const themeToggle = document.getElementById('theme-toggle');
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};
themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

/* --- Firebase Operations --- */
let currentUser = null;
onAuthStateChanged(auth, user => {
  currentUser = user;
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  if (user) document.getElementById('user-avatar').src = user.photoURL;
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
  container.innerHTML = 'Loading Lab Data...';
  const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true), limit(20)) : query(collection(db, "formulas"), where("uid", "==", currentUser?.uid));
  const snap = await getDocs(q);
  container.innerHTML = '';
  snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

function setActivePage(pageId) {
  const pages = { home: 'page-home', my: 'page-my', create: 'page-create', settings: 'page-settings' };
  Object.values(pages).forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById(pages[pageId]).style.display = 'block';
  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') loadFeed('my');
  document.getElementById('drawer').classList.remove('open');
}

document.querySelectorAll('.drawer-item').forEach(item => item.onclick = () => setActivePage(item.dataset.page));
document.getElementById('menu-btn').onclick = () => document.getElementById('drawer').classList.add('open');
document.getElementById('drawer-close').onclick = () => document.getElementById('drawer').classList.remove('open');
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);
createRow(rowsContainer); // Start with one row
