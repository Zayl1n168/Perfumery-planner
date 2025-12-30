import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, deleteDoc, doc, updateDoc, getDoc 
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
let inventoryCache = {}; 

const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

// --- 1. UTILITY & CALCULATIONS ---

async function loadInventoryCache() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    inventoryCache = {};
    snap.forEach(d => {
        const item = d.data();
        if (item.price && item.size) inventoryCache[item.name.toLowerCase()] = item.price / item.size;
    });
}

function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

// --- 2. FEED & CARD RENDERING ---

async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center;">Syncing with Vault...</p>';

    try {
        await loadInventoryCache();
        let q = query(collection(db, "formulas"), where("public", "==", true));
        if (type === 'my' && auth.currentUser) {
            q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        }
        
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            const cost = calculateBatchCost(comp);
            const compJson = encodeURIComponent(JSON.stringify(comp));

            const colors = { Citrus: '#fbbf24', Floral: '#f472b6', Woody: '#78350f', Fresh: '#22d3ee', Sweet: '#f59e0b', Spicy: '#ef4444', Gourmand: '#92400e', Animalic: '#4b5563', Ozonic: '#7dd3fc', Green: '#16a34a', Resinous: '#d97706', Fruity: '#fb7185', Earthy: '#451a03' };
            let totalMl = 0;
            const totals = {};
            comp.forEach(c => { const ml = parseFloat(c.ml) || 0; totalMl += ml; totals[c.category] = (totals[c.category] || 0) + ml; });

            let barHtml = '<div style="display:flex; height:10px; border-radius:6px; overflow:hidden; margin:12px 0; background:#eee;">';
            for (const cat in totals) { barHtml += `<div style="width:${(totals[cat]/totalMl)*100}%; background:${colors[cat] || '#888'}"></div>`; }
            barHtml += '</div>';

            const card = `
                <div class="panel">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 style="color:var(--brand-color)">${data.name}</h3>
                        <span style="font-size:0.7rem; background:var(--bg); padding:4px 8px; border-radius:6px;">${data.concentration}</span>
                    </div>
                    ${barHtml}
                    <div style="font-size:0.85rem; margin-bottom:10px;">
                        ${comp.map((c, i) => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #f0f0f0; padding:4px 0;"><span>${c.name}</span><b id="ml-${d.id}-${i}">${c.ml}mL</b></div>`).join('')}
                    </div>
                    <div id="cost-${d.id}" style="font-weight:bold; font-size:0.8rem; color:#16a34a; margin-bottom:10px;">Batch Cost: $${cost}</div>
                    
                    <input type="range" min="1" max="20" value="1" style="width:100%" oninput="updateBatchScale('${d.id}', '${compJson}', this.value)">
                    
                    ${type === 'my' ? `
                    <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                        <button onclick="editFormula('${d.id}')" style="flex:1; background:var(--brand-color); color:white; border:none; padding:8px; border-radius:8px;">EDIT</button>
                        <button onclick="deleteDocById('${d.id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:8px; border-radius:8px;">DELETE</button>
                    </div>` : ''}
                </div>`;
            container.insertAdjacentHTML('beforeend', card);
        });
    } catch (e) { container.innerHTML = '<p>Error loading feed.</p>'; }
}

// --- 3. GLOBAL ACTIONS (WINDOW SCOPE) ---

window.updateBatchScale = (id, baseJson, mult) => {
    const base = JSON.parse(decodeURIComponent(baseJson));
    base.forEach((n, i) => {
        const el = document.getElementById(`ml-${id}-${i}`);
        if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL';
    });
    const newCost = calculateBatchCost(base, mult);
    document.getElementById(`cost-${id}`).innerText = `Batch Cost: $${newCost}`;
};

window.deleteDocById = async (id) => {
    if (confirm("Permanently delete this formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed('my');
    }
};

window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editModeId = id;
        setActivePage('create');
        document.getElementById('form-title').innerText = "EDIT: " + data.name;
        document.getElementById('name').value = data.name;
        document.getElementById('concentration-input').value = data.concentration;
        document.getElementById('public-checkbox').checked = data.public;
        document.getElementById('ingredient-rows-container').innerHTML = '';
        data.composition.forEach(item => createRow(item));
    }
};

window.exportData = async () => {
    const q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    let txt = "FRAGRANCE LAB EXPORT\n\n";
    snap.forEach(d => {
        const f = d.data();
        txt += `${f.name} (${f.concentration})\n`;
        f.composition.forEach(c => txt += `- ${c.name}: ${c.ml}mL\n`);
        txt += "\n";
    });
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my_formulas.txt";
    a.click();
};

window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');
    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
};

// --- 4. FORM & UI HELPERS ---

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style = "display:flex; gap:5px; margin-bottom:8px;";
    div.innerHTML = `
        <select class="ing-type" style="flex:1"><option value="Top" ${data.type==='Top'?'selected':''}>T</option><option value="Heart" ${data.type==='Heart'?'selected':''}>H</option><option value="Base" ${data.type==='Base'?'selected':''}>B</option></select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
        <select class="ing-cat" style="flex:1">${ACCORDS.map(a => `<option value="${a.val}" ${data.category===a.val?'selected':''}>${a.icon}</option>`).join('')}</select>
        <button type="button" class="remove-row" style="background:#ff4d4d; color:white; border:none; border-radius:5px; width:30px;">×</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

// --- 5. EVENT LISTENERS ---

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
        updatedAt: serverTimestamp()
    };

    if (editModeId) {
        await updateDoc(doc(db, "formulas", editModeId), formulaData);
        editModeId = null;
    } else {
        await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
    }
    setActivePage('my');
};

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
