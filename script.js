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

let inventoryCache = {}; 
let editFormulaId = null; 
let editInventoryId = null; 

const ACCORDS = [
  'Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 
  'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'
];

// --- 1. CORE CALCULATIONS ---

async function loadInventoryCache() {
    if (!auth.currentUser) return;
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        inventoryCache = {};
        snap.forEach(d => {
            const item = d.data();
            if (item.price && item.size) {
                inventoryCache[item.name.toLowerCase().trim()] = parseFloat(item.price) / parseFloat(item.size);
            }
        });
        renderInventoryList(snap);
    } catch (e) { console.warn("Syncing inventory..."); }
}

function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase().trim()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

function getScentProfile(comp) {
    const total = comp.reduce((sum, ing) => sum + parseFloat(ing.ml || 0), 0) || 1;
    const top = comp.filter(i => i.type === 'Top').reduce((s, i) => s + parseFloat(i.ml), 0);
    const heart = comp.filter(i => i.type === 'Heart').reduce((s, i) => s + parseFloat(i.ml), 0);
    const base = comp.filter(i => i.type === 'Base').reduce((s, i) => s + parseFloat(i.ml), 0);
    
    return {
        t: (top / total) * 100,
        h: (heart / total) * 100,
        b: (base / total) * 100
    };
}

// --- 2. GLOBAL WINDOW FUNCTIONS ---

window.updateVolumeScale = (id, baseJson, originalBaseAmt, targetVol) => {
    const comp = JSON.parse(decodeURIComponent(baseJson));
    const target = parseFloat(targetVol);
    const origBase = parseFloat(originalBaseAmt);
    
    const originalOilTotal = comp.reduce((sum, ing) => sum + parseFloat(ing.ml), 0);
    const originalGrandTotal = originalOilTotal + origBase;
    const multiplier = target / originalGrandTotal;

    comp.forEach((n, i) => {
        const el = document.getElementById(`ml-${id}-${i}`);
        if (el) el.innerText = (parseFloat(n.ml) * multiplier).toFixed(2) + 'mL';
    });

    const newBase = (origBase * multiplier).toFixed(2);
    document.getElementById(`base-${id}`).innerText = newBase + 'mL';
    document.getElementById(`yield-${id}`).innerText = target + 'mL';
    document.getElementById(`cost-${id}`).innerText = `Batch Cost: $${calculateBatchCost(comp, multiplier)}`;
};

window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editFormulaId = id;
        setActivePage('create');
        document.getElementById('name').value = data.name;
        document.getElementById('manual-base-input').value = data.baseAmount || 0;
        document.getElementById('public-checkbox').checked = data.public;
        document.getElementById('ingredient-rows-container').innerHTML = '';
        data.composition.forEach(item => createRow(item));
        document.querySelector('#page-create h2').innerText = "Edit Formula";
    }
};

window.editInventory = async (id) => {
    const docSnap = await getDoc(doc(db, "inventory", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editInventoryId = id;
        document.getElementById('inv-name').value = data.name;
        document.getElementById('inv-qty').value = data.qty;
        document.getElementById('inv-price').value = data.price;
        document.getElementById('inv-size').value = data.size;
        document.querySelector('#inventory-form button').innerText = "Update Material";
    }
};

window.deleteDocById = async (id) => {
    if (confirm("Delete this formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed('my');
    }
};

window.deleteInventory = async (id) => {
    if (confirm("Remove from stockroom?")) {
        await deleteDoc(doc(db, "inventory", id));
        loadInventoryCache();
    }
};

window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');
    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
    if (pageId === 'inventory') loadInventoryCache();
};

// --- 3. UI RENDERING ---

async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; padding:20px;">Updating Lab...</p>';

    try {
        await loadInventoryCache();
        const q = type === 'home' 
            ? query(collection(db, "formulas"), where("public", "==", true))
            : query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        
        const snap = await getDocs(q);
        container.innerHTML = '';

        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            const profile = getScentProfile(comp);
            const manualBase = parseFloat(data.baseAmount || 0);
            const compJson = encodeURIComponent(JSON.stringify(comp));
            
            const oilTotal = comp.reduce((sum, ing) => sum + parseFloat(ing.ml), 0);
            const totalVol = oilTotal + manualBase;
            const concentration = ((oilTotal / totalVol) * 100).toFixed(1);

            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">${data.name}</h3>
                        <span style="font-size:0.75rem; background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:12px; font-weight:bold;">${concentration}% Conc.</span>
                    </div>

                    <div class="scent-bar-container">
                        <div class="scent-bar">
                            <div class="bar-segment" style="width:${profile.t}%; background:var(--top-note)"></div>
                            <div class="bar-segment" style="width:${profile.h}%; background:var(--heart-note)"></div>
                            <div class="bar-segment" style="width:${profile.b}%; background:var(--base-note)"></div>
                        </div>
                        <div class="bar-labels">
                            <span class="label-top">Top: ${profile.t.toFixed(0)}%</span>
                            <span class="label-heart">Heart: ${profile.h.toFixed(0)}%</span>
                            <span class="label-base">Base: ${profile.b.toFixed(0)}%</span>
                        </div>
                    </div>

                    <div style="font-size:0.85rem; margin:10px 0; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px;">
                        <div style="display:flex; justify-content:space-between;"><span>Oils Total:</span><b>${oilTotal.toFixed(2)}mL</b></div>
                        <div style="display:flex; justify-content:space-between; color:#b45309"><span>Base:</span><b id="base-${d.id}">${manualBase.toFixed(2)}mL</b></div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid #ddd; margin-top:5px; font-weight:bold;"><span>Total Yield:</span><b id="yield-${d.id}">${totalVol.toFixed(2)}mL</b></div>
                    </div>

                    <div style="font-size:0.8rem; margin-bottom:10px;">
                        ${comp.map((c, i) => `
                            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:4px 0;">
                                <span>${c.name} <small style="color:#64748b">(${c.category})</small></span>
                                <b id="ml-${d.id}-${i}">${c.ml}mL</b>
                            </div>`).join('')}
                    </div>

                    <div id="cost-${d.id}" style="font-weight:bold; font-size:0.8rem; color:#16a34a; margin-bottom:10px;">Batch Cost: $${calculateBatchCost(comp)}</div>
                    
                    <label style="font-size:0.65rem; font-weight:bold; letter-spacing:0.5px; display:block; margin-bottom:5px;">RESIZE BATCH (mL)</label>
                    <input type="range" min="5" max="250" value="${totalVol}" step="1" style="width:100%;" 
                        oninput="updateVolumeScale('${d.id}', '${compJson}', '${manualBase}', this.value)">
                    
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        ${type === 'my' ? `<button onclick="editFormula('${d.id}')" class="secondary-btn" style="margin:0; flex:1;">Edit</button>` : ''}
                        ${type === 'my' ? `<button onclick="deleteDocById('${d.id}')" class="secondary-btn" style="margin:0; flex:1; background:#fee2e2; color:#b91c1c;">Delete</button>` : ''}
                    </div>
                </div>`);
        });
    } catch (e) { console.error(e); }
}

function renderInventoryList(snap) {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';
    snap.forEach(d => {
        const item = d.data();
        list.insertAdjacentHTML('beforeend', `
            <div class="panel" style="margin:5px 0; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                <div><b>${item.name}</b><br><small>$${(item.price/item.size).toFixed(2)}/mL | ${item.qty}mL stock</small></div>
                <div style="display:flex; gap:8px;">
                    <button onclick="editInventory('${d.id}')" style="background:#fbbf24; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">Edit</button>
                    <button onclick="deleteInventory('${d.id}')" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer;">X</button>
                </div>
            </div>`);
    });
}

// --- 4. FORM LOGIC ---

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style = "display:grid; grid-template-columns: 0.6fr 1.5fr 0.7fr 1.2fr 40px; gap:5px; margin-bottom:8px;";
    div.innerHTML = `
        <select class="ing-type"><option value="Top" ${data.type==='Top'?'selected':''}>T</option><option value="Heart" ${data.type==='Heart'?'selected':''}>H</option><option value="Base" ${data.type==='Base'?'selected':''}>B</option></select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required>
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required>
        <select class="ing-cat">${ACCORDS.map(a => `<option value="${a}" ${data.category===a?'selected':''}>${a}</option>`).join('')}</select>
        <button type="button" class="remove-row" style="background:#ef4444; color:white; border:none; border-radius:8px;">×</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

document.getElementById('formula-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('.ingredient-row');
    const composition = Array.from(rows).map(r => ({
        type: r.querySelector('.ing-type').value,
        name: r.querySelector('.ing-name').value.trim(),
        ml: r.querySelector('.ing-ml').value,
        category: r.querySelector('.ing-cat').value
    }));

    const formulaData = {
        name: document.getElementById('name').value,
        baseAmount: parseFloat(document.getElementById('manual-base-input').value || 0),
        composition,
        uid: auth.currentUser.uid,
        public: document.getElementById('public-checkbox').checked,
        updatedAt: serverTimestamp()
    };

    if (editFormulaId) {
        await updateDoc(doc(db, "formulas", editFormulaId), formulaData);
        editFormulaId = null;
        document.querySelector('#page-create h2').innerText = "New Formula";
    } else {
        await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
    }
    document.getElementById('formula-form').reset();
    setActivePage('my');
};

document.getElementById('inventory-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('inv-name').value.trim(),
        qty: parseFloat(document.getElementById('inv-qty').value),
        price: parseFloat(document.getElementById('inv-price').value),
        size: parseFloat(document.getElementById('inv-size').value),
        uid: auth.currentUser.uid
    };

    if (editInventoryId) {
        await updateDoc(doc(db, "inventory", editInventoryId), data);
        editInventoryId = null;
        document.querySelector('#inventory-form button').innerText = "Add to Stockroom";
    } else {
        await addDoc(collection(db, "inventory"), data);
    }
    document.getElementById('inventory-form').reset();
    loadInventoryCache();
};

// --- 5. INITIALIZATION ---

onAuthStateChanged(auth, (user) => {
    const brandSpan = document.querySelector('.brand span');
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    if (user) {
        if (brandSpan) brandSpan.innerText = user.displayName.toUpperCase();
        if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
    } else {
        if (brandSpan) brandSpan.innerText = "FRAGRANCE LAB";
    }
    setActivePage('home');
});

document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

createRow();
