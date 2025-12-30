import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
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

let editModeId = null;

const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

// --- Navigation ---
window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');

    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
};

// --- Visualizer Logic ---
function getVisualizerHtml(comp) {
    const colors = { 
        Citrus: '#fbbf24', Floral: '#f472b6', Woody: '#78350f', Fresh: '#22d3ee', 
        Sweet: '#f59e0b', Spicy: '#ef4444', Gourmand: '#92400e', Animalic: '#4b5563',
        Ozonic: '#7dd3fc', Green: '#16a34a', Resinous: '#d97706', Fruity: '#fb7185', Earthy: '#451a03'
    };
    let totalMl = 0;
    const totals = {};
    comp.forEach(c => {
        const ml = parseFloat(c.ml) || 0;
        totalMl += ml;
        totals[c.category] = (totals[c.category] || 0) + ml;
    });
    if (totalMl === 0) return '';
    let html = '<div class="scent-profile-bar" style="display:flex; height:10px; border-radius:5px; overflow:hidden; margin:10px 0; background:#eee;">';
    for (const cat in totals) {
        const width = (totals[cat] / totalMl) * 100;
        html += `<div style="width:${width}%; background:${colors[cat] || '#888'}"></div>`;
    }
    return html + '</div>';
}

// --- Card Rendering ---
function createCard(d) {
    const data = d.data();
    const comp = data.composition || [];
    return `
        <div class="panel">
            <h3 style="color:var(--brand-color)">${data.name}</h3>
            <p style="font-size:0.8rem; font-weight:bold;">${data.concentration}</p>
            ${getVisualizerHtml(comp)}
            <div style="font-size:0.9rem; margin-top:10px;">
                ${comp.map(c => `<div>${c.name}: ${c.ml}mL</div>`).join('')}
            </div>
        </div>`;
}

// --- Feed Loading ---
async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;">Updating Lab...</p>';

    try {
        let q = query(collection(db, "formulas"), where("public", "==", true));
        if (type === 'my' && auth.currentUser) {
            q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        }
        const snap = await getDocs(q);
        container.innerHTML = '';
        snap.forEach(doc => {
            container.insertAdjacentHTML('beforeend', createCard(doc));
        });
    } catch (e) {
        container.innerHTML = '<p style="color:red; padding:20px;">Sync Error. Sign in again.</p>';
    }
}

// --- Form & Rows ---
function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style.display = "flex"; div.style.gap = "8px"; div.style.marginBottom = "10px";
    div.innerHTML = `
        <select class="ing-type" style="flex:1"><option value="Top">Top</option><option value="Heart">Heart</option><option value="Base">Base</option></select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
        <select class="ing-cat" style="flex:1.5">${ACCORDS.map(a => `<option value="${a.val}">${a.icon} ${a.val}</option>`).join('')}</select>
        <button type="button" class="remove-row" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:0 10px;">✕</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

function resetForm() {
    document.getElementById('formula-form').reset();
    document.getElementById('ingredient-rows-container').innerHTML = '';
    createRow();
}

// --- Global Actions ---
document.getElementById('formula-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('.ingredient-row');
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
        public: document.getElementById('public-checkbox').checked,
        createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "formulas"), formulaData);
    setActivePage('my');
};

// --- Listeners ---
onAuthStateChanged(auth, user => {
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    setActivePage('home');
});
document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

createRow();
