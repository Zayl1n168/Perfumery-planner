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
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
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
    } catch (e) { console.warn("Syncing..."); }
}

function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase().trim()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

// --- 2. GLOBAL WINDOW FUNCTIONS (Editing & Scaling) ---

window.updateVolumeScale = (id, baseJson, concentrationStr, targetVol) => {
    const comp = JSON.parse(decodeURIComponent(baseJson));
    const target = parseFloat(targetVol);
    const concentration = parseFloat(concentrationStr) / 100;
    
    const originalOilTotal = comp.reduce((sum, ing) => sum + parseFloat(ing.ml), 0);
    const newOilTotal = target * concentration;
    const multiplier = newOilTotal / originalOilTotal;

    comp.forEach((n, i) => {
        const el = document.getElementById(`ml-${id}-${i}`);
        if (el) el.innerText = (parseFloat(n.ml) * multiplier).toFixed(2) + 'mL';
    });

    const baseAmount = (target - newOilTotal).toFixed(2);
    document.getElementById(`base-${id}`).innerText = baseAmount + 'mL';
    document.getElementById(`yield-${id}`).innerText = target + 'mL';
    
    const newCost = calculateBatchCost(comp, multiplier);
    document.getElementById(`cost-${id}`).innerText = `Batch Cost: $${newCost}`;
};

window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editFormulaId = id;
        setActivePage('create');
        document.getElementById('name').value = data.name;
        document.getElementById('concentration-input').value = data.concentration;
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
    container.innerHTML = '<p style="padding:20px; text-align:center;">Updating...</p>';

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
            const compJson = encodeURIComponent(JSON.stringify(comp));
            
            const oilTotal = comp.reduce((sum, ing) => sum + parseFloat(ing.ml), 0);
            const concDecimal = parseFloat(data.concentration) / 100;
            const initialTotalVol = (oilTotal / concDecimal).toFixed(1);
            const initialBase = (initialTotalVol - oilTotal).toFixed(1);

            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <h3 style="color:var(--brand-color); margin-bottom:5px;">${data.name}</h3>
                    
                    <div style="margin:10px 0; font-size:0.8rem; background:rgba(0,0,0,0.03); padding:8px; border-radius:8px;">
                        <div style="display:flex; justify-content:space-between;"><span>Concentrate:</span><b>${oilTotal.toFixed(2)}mL</b></div>
                        <div style="display:flex; justify-content:space-between; color:var(--brand-color)"><span>Base Needed:</span><b id="base-${d.id}">${initialBase}mL</b></div>
                        <div style="display:flex; justify-content:space-between; border-top:1px solid #ddd; margin-top:5px; font-weight:bold;"><span>Total Yield:</span><b id="yield-${d.id}">${initialTotalVol}mL</b></div>
                    </div>

                    <div style="font-size:0.8rem; margin-bottom:10px;">
                        ${comp.map((c, i) => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee;"><span>${c.name}</span><b id="ml-${d.id}-${i}">${c.ml}mL</b></div>`).join('')}
                    </div>

                    <div id="cost-${d.id}" style="font-weight:bold; font-size:0.8rem; color:#16a34a; margin-bottom:10px;">Batch Cost: $${calculateBatchCost(comp)}</div>
                    
                    <label style="font-size:0.65rem; font-weight:bold; letter-spacing:1px;">TARGET BOTTLE SIZE (mL)</label>
                    <input type="range" min="5" max="100" value="${initialTotalVol}" step="5" style="width:100%; margin-bottom:10px;" 
                        oninput="updateVolumeScale('${d.id}', '${compJson}', '${data.concentration}', this.value)">
                    
                    <div style="display:flex; gap:10px;">
                        ${type === 'my' ? `<button onclick="editFormula('${d.id}')" style="flex:1; background:#fbbf24; border:none; padding:8px; border-radius:8px; font-weight:bold;">EDIT</button>` : ''}
                        ${type === 'my' ? `<button onclick="deleteDocById('${d.id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:8px; border-radius:8px; font-weight:bold;">DEL</button>` : ''}
                    </div>
                </div>`);
        });
    } catch (e) { container.innerHTML = '<p>Error.</p>'; }
}

function renderInventoryList(snap) {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';
    snap.forEach(d => {
        const item = d.data();
        list.insertAdjacentHTML('beforeend', `
            <div class="panel" style="margin:5px 0; padding:10px; display:flex; justify-content:space-between; align-items:center;">
                <div><b>${item.name}</b><br><small>$${(item.price/item.size).toFixed(2)}/mL | ${item.qty}mL stock</small></div>
                <div style="display:flex; gap:5px;">
                    <button onclick="editInventory('${d.id}')" style="background:#fbbf24; border:none; padding:5px 8px; border-radius:5px;">Edit</button>
                    <button onclick="deleteInventory('${d.id}')" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:5px;">X</button>
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
        concentration: document.getElementById('concentration-input').value,
        composition,
        uid: auth.currentUser.uid,
        public: document.getElementById('public-checkbox').checked,
        updatedAt: serverTimestamp()
    };

    if (editFormulaId) {
        await updateDoc(doc(db, "formulas", editFormulaId), formulaData);
        editFormulaId = null;
        document.querySelector('#page-create h2').innerText = "Create Formula";
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
