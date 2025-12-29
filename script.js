import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, limit, getDocs, 
    serverTimestamp, deleteDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// --- Firebase Configuration ---
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

// --- Global Constants & State ---
const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

let editModeId = null; 

// --- Theme & Dark Mode Logic ---
const themeToggle = document.getElementById('theme-toggle');

const applyTheme = (isDark) => {
    if (isDark) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
    localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

if (themeToggle) {
    themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));
}

// Check saved preference or system preference on load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('prefTheme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        applyTheme(true);
        if (themeToggle) themeToggle.checked = true;
    }
});

// --- Navigation & UI ---
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');
const rowsContainer = document.getElementById('ingredient-rows-container');

const openMenu = () => { drawer.classList.add('open'); overlay.classList.add('show'); };
const closeMenu = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };

function setActivePage(pageId) {
    const pages = ['page-home', 'page-my', 'page-create', 'page-settings'];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    
    closeMenu();
    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
    if (pageId !== 'create' && editModeId) resetForm(); // Clean form if we exit edit mode
}

// --- Formulation Form Logic ---
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
        <button type="button" class="remove-row" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:0 10px; cursor:pointer;">✕</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    rowsContainer.appendChild(div);
}

function resetForm() {
    editModeId = null;
    document.getElementById('formula-form').reset();
    document.getElementById('form-title').innerText = "CREATE FORMULA";
    rowsContainer.innerHTML = '';
    createRow();
}

// --- Card Rendering & Visuals ---
function getVisualizerHtml(comp) {
    if (!Array.isArray(comp) || comp.length === 0) return '';
    const colors = { 
        Citrus: '#fbbf24', Floral: '#f472b6', Woody: '#78350f', Fresh: '#22d3ee', 
        Sweet: '#f59e0b', Spicy: '#ef4444', Gourmand: '#92400e', Animalic: '#4b5563',
        Ozonic: '#7dd3fc', Green: '#16a34a', Resinous: '#d97706', Fruity: '#fb7185', Earthy: '#451a03'
    };
    const totals = {}; let totalMl = 0;
    comp.forEach(c => { 
        const val = parseFloat(c.ml) || 0; 
        totals[c.category] = (totals[c.category] || 0) + val; 
        totalMl += val; 
    });
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
                    ${comp.length > 0 ? (renderSection('Top') + renderSection('Heart') + renderSection('Base')) : '<p>Legacy formula format.</p>'}
                </div>
                ${comp.length > 0 ? `
                    <div class="scaler-ui">
                        <label id="val-${d.id}" style="font-size:0.65rem; font-weight:800; color:var(--muted);">BATCH SIZE: 1x</label>
                        <input type="range" id="scale-${d.id}" min="1" max="50" value="1" oninput="updateScale('${d.id}', '${compJson}')" style="margin-top:5px;">
                    </div>` : ''}
            </div>
            ${isOwner ? `
                <div class="card-actions" style="padding:15px; display:flex; gap:10px; border-top:1px solid var(--border)">
                    <button class="btn small" onclick="editFormula('${d.id}')" style="flex:1; background:var(--brand-color)">EDIT</button>
                    <button class="btn small" onclick="deleteFormula('${d.id}')" style="flex:1; background:#ef4444; color:white">DELETE</button>
                </div>` : ''}
        </div>`;
}

// --- Data Operations (CRUD) ---
async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center; color:var(--muted)">Opening the vault...</p>';
    
    const q = type === 'home' 
        ? query(collection(db, "formulas"), where("public", "==", true), limit(30)) 
        : query(collection(db, "formulas"), where("uid", "==", auth.currentUser?.uid));
    
    const snap = await getDocs(q);
    container.innerHTML = '';
    if (snap.empty) container.innerHTML = '<p style="padding:40px; text-align:center; color:var(--muted)">No formulas found here yet.</p>';
    snap.forEach(doc => container.insertAdjacentHTML('beforeend', createCard(doc, type === 'my')));
}

window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
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
        window.scrollTo(0, 0);
    }
};

window.deleteFormula = async (id) => {
    if (confirm("Permanently delete this formula from your notebook?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed('my');
    }
};

window.exportData = async () => {
    if (!auth.currentUser) return alert("Sign in to export formulas.");
    const q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    let content = "FRAGRANCE LAB - MASTER EXPORT\nGenerated: " + new Date().toLocaleString() + "\n\n";
    snap.forEach(d => {
        const f = d.data();
        content += `[${f.name}] - ${f.concentration}\n`;
        f.composition.forEach(c => content += `  • ${c.type}: ${c.name} - ${c.ml}mL (${c.category})\n`);
        content += `\n----------------------------------\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fragrance_backup.txt";
    a.click();
};

window.updateScale = (id, baseJson) => {
    const mult = document.getElementById(`scale-${id}`).value;
    const base = JSON.parse(decodeURIComponent(baseJson));
    base.forEach((n, i) => { 
        const el = document.getElementById(`ml-${id}-${i}`); 
        if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL'; 
    });
    document.getElementById(`val-${id}`).innerText = `BATCH SIZE: ${mult}x`;
};

// --- Form Submission ---
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
        composition,
        uid: auth.currentUser.uid,
        author: auth.currentUser.displayName,
        public: document.getElementById('public-checkbox').checked,
        updatedAt: serverTimestamp()
    };

    try {
        if (editModeId) {
            await updateDoc(doc(db, "formulas", editModeId), formulaData);
        } else {
            await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
        }
        setActivePage('my');
    } catch (err) {
        alert("Error saving: " + err.message);
    }
};

// --- Auth & Startup ---
onAuthStateChanged(auth, user => {
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    if (user && document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
    setActivePage('home');
});

document.getElementById('menu-btn').onclick = openMenu;
document.getElementById('drawer-close').onclick = closeMenu;
document.getElementById('drawer-overlay').onclick = closeMenu;
document.querySelectorAll('.drawer-item').forEach(item => {
    item.onclick = () => setActivePage(item.dataset.page);
});
document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

// Initial row
createRow();
