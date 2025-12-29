import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, limit, getDocs, serverTimestamp, deleteDoc, doc, updateDoc, getDoc 
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

/* --- Expanded Accord Categories --- */
const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

/* --- Global State --- */
let editModeId = null; 

/* --- Navigation --- */
function setActivePage(pageId) {
  const pages = ['page-home', 'page-my', 'page-create', 'page-settings'];
  pages.forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('page-' + pageId).style.display = 'block';
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
  
  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') loadFeed('my');
  if (pageId !== 'create') resetForm(); // Clean up if we leave the create page
}

/* --- Form Logic --- */
const rowsContainer = document.getElementById('ingredient-rows-container');

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
  const div = document.createElement('div');
  div.className = 'ingredient-row';
  div.innerHTML = `
    <select class="ing-type" style="flex:1">
        <option value="Top" ${data.type === 'Top' ? 'selected' : ''}>Top</option>
        <option value="Heart" ${data.type === 'Heart' ? 'selected' : ''}>Heart</option>
        <option value="Base" ${data.type === 'Base' ? 'selected' : ''}>Base</option>
    </select>
    <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
    <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:0.8">
    <select class="ing-cat" style="flex:1.2">
      ${ACCORDS.map(a => `<option value="${a.val}" ${data.category === a.val ? 'selected' : ''}>${a.icon} ${a.val}</option>`).join('')}
    </select>
    <button type="button" class="remove-row" style="background:#ff4d4d; color:white">✕</button>`;
  div.querySelector('.remove-row').onclick = () => div.remove();
  rowsContainer.appendChild(div);
}

function resetForm() {
  editModeId = null;
  document.getElementById('formula-form').reset();
  rowsContainer.innerHTML = '';
  createRow();
  document.getElementById('form-title').innerText = "CREATE FORMULA";
}

/* --- Edit Logic --- */
window.editFormula = async (id) => {
  const docRef = doc(db, "formulas", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    editModeId = id;
    setActivePage('create');
    document.getElementById('form-title').innerText = "EDITING: " + data.name;
    document.getElementById('name').value = data.name;
    document.getElementById('concentration-input').value = data.concentration;
    document.getElementById('public-checkbox').checked = data.public;
    rowsContainer.innerHTML = '';
    data.composition.forEach(item => createRow(item));
  }
};

/* --- Export Logic --- */
window.exportData = async () => {
  const q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
  const snap = await getDocs(q);
  let content = "FRAGRANCE LAB EXPORT\n==================\n\n";
  snap.forEach(d => {
    const f = d.data();
    content += `NAME: ${f.name} (${f.concentration})\n`;
    f.composition.forEach(c => content += `- [${c.type}] ${c.name}: ${c.ml}mL (${c.category})\n`);
    content += `\n------------------\n\n`;
  });
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my_fragrance_formulas.txt";
  a.click();
};

/* --- Visualizer --- */
function getVisualizerHtml(comp) {
    if (!Array.isArray(comp) || comp.length === 0) return '';
    const colors = { 
        Citrus: '#FFD700', Floral: '#FF69B4', Woody: '#8B4513', Fresh: '#00FFFF', 
        Sweet: '#FFA500', Spicy: '#FF4500', Gourmand: '#7B3F00', Animalic: '#6E4E37',
        Ozonic: '#A0CFEC', Green: '#228B22', Resinous: '#C19A6B', Fruity: '#E34234', Earthy: '#4B5320'
    };
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

/* --- Card Template --- */
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
      <div class="card-header-brand"><h3>${data.name || 'Untitled'}</h3><span class="badge">${data.concentration || 'EDP'}</span></div>
      <div class="card-body">
        ${getVisualizerHtml(comp)}
        <div class="composition-list">
          ${comp.length > 0 ? (renderSection('Top') + renderSection('Heart') + renderSection('Base')) : '<p>Legacy formula.</p>'}
        </div>
        ${comp.length > 0 ? `
          <div class="scaler-ui">
            <label id="val-${d.id}" style="font-size:0.6rem; font-weight:bold;">1x Batch</label>
            <input type="range" id="scale-${d.id}" min="1" max="50" value="1" oninput="updateScale('${d.id}', '${compJson}')">
          </div>` : ''}
      </div>
      ${isOwner ? `
        <div class="card-actions" style="padding:10px; border-top:1px solid var(--border); display:flex; gap:5px;">
          <button class="btn small" onclick="editFormula('${d.id}')" style="flex:1">EDIT</button>
          <button class="btn small" style="background:#ff4d4d; color:white; flex:1" onclick="deleteFormula('${d.id}')">DELETE</button>
        </div>` : ''}
    </div>`;
}

/* --- Listeners & Core --- */
document.getElementById('formula-form').onsubmit = async (e) => {
  e.preventDefault();
  const rows = rowsContainer.querySelectorAll('.ingredient-row');
  const composition = Array.from(rows).map(r => ({
    type: r.querySelector('.ing-type').value,
    name: r.querySelector('.ing-name').value,
    ml: r.querySelector('.ing-ml').value,
    category: r.querySelector('.ing-cat').value
  }));

  const formulaData = {
    name: document.getElementById('name').value,
    concentration: document.getElementById('concentration-input').value,
    composition, uid: auth.currentUser.uid, author: auth.currentUser.displayName,
    public: document.getElementById('public-checkbox').checked, updatedAt: serverTimestamp()
  };

  if (editModeId) {
    await updateDoc(doc(db, "formulas", editModeId), formulaData);
  } else {
    await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
  }
  setActivePage('my');
};

/* --- Wiring it up --- */
onAuthStateChanged(auth, user => {
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  if (user && document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
  setActivePage('home');
});

document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-close').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => item.onclick = () => setActivePage(item.dataset.page));
document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

window.updateScale = (id, baseJson) => {
  const mult = document.getElementById(`scale-${id}`).value;
  const base = JSON.parse(decodeURIComponent(baseJson));
  base.forEach((n, i) => { const el = document.getElementById(`ml-${id}-${i}`); if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL'; });
  document.getElementById(`val-${id}`).innerText = mult + 'x Batch';
};

window.deleteFormula = async (id) => { if(confirm("Delete formula?")) { await deleteDoc(doc(db, "formulas", id)); loadFeed('my'); } };

async function loadFeed(type) {
  const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
  container.innerHTML = '<p style="padding:20px">Loading...</p>';
  const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true), limit(25)) : query(collection(db, "formulas"), where("uid", "==", auth.currentUser?.uid));
  const snap = await getDocs(q); container.innerHTML = '';
  snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

createRow();
