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

// --- 1. CORE LOGIC ---

async function loadInventoryCache() {
    if (!auth.currentUser) return;
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        inventoryCache = {};
        snap.forEach(d => {
            const item = d.data();
            if (item.price && item.size) inventoryCache[item.name.toLowerCase()] = item.price / item.size;
        });
        renderInventoryList(snap);
    } catch (e) { console.error("Inventory error:", e); }
}

function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

// --- 2. FEED & UI ---

async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center;">Updating...</p>';

    try {
        await loadInventoryCache();
        let q;
        if (type === 'home') {
            q = query(collection(db, "formulas"), where("public", "==", true));
        } else {
            if (!auth.currentUser) {
                container.innerHTML = '<p style="padding:20px; text-align:center;">Please Sign In to view.</p>';
                return;
            }
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
                    <h3 style="color:var(--brand-color)">${data.name}</h3>
                    ${barHtml}
                    <div style="font-size:0.85rem; margin-bottom:10px;">
                        ${comp.map((c, i) => `<div style="display:flex; justify-content:space-between;"><span>${c.name}</span><b id="ml-${d.id}-${i}">${c.ml}mL</b></div>`).join('')}
                    </div>
                    <div id="cost-${d.id}" style="font-weight:bold; font-size:0.8rem; color:#16a34a; margin-bottom:10px;">Cost: $${cost}</div>
                    <input type="range" min="1" max="10" value="1" style="width:100%" oninput="updateBatchScale('${d.id}', '${compJson}', this.value)">
                    ${type === 'my' ? `<button onclick="deleteDocById('${d.id}')" style="margin-top:10px; border:none; background:none; color:red; font-size:0.7rem;">DELETE</button>` : ''}
                </div>`;
            container.insertAdjacentHTML('beforeend', card);
        });
    } catch (e) { 
        console.error(e);
        container.innerHTML = '<p style="padding:20px; text-align:center; color:red;">Error loading feed.</p>'; 
    }
}

// --- 3. INVENTORY LOGIC ---

function renderInventoryList(snap) {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';
    snap.forEach(d => {
        const item = d.data();
        list.insertAdjacentHTML('beforeend', `
            <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${item.name}</span>
                <span>${item.qty}mL ($${(item.price/item.size).toFixed(2)}/mL)</span>
            </div>
        `);
    });
}

document.getElementById('inventory-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('inv-name').value,
        qty: parseFloat(document.getElementById('inv-qty').value),
        price: parseFloat(document.getElementById('inv-price').value),
        size: parseFloat(document.getElementById('inv-size').value),
        uid: auth.currentUser.uid
    };
    await addDoc(collection(db, "inventory"), data);
    document.getElementById('inventory-form').reset();
    loadInventoryCache();
};

// --- 4. GLOBAL HELPERS ---

window.updateBatchScale = (id, baseJson, mult) => {
    const base = JSON.parse(decodeURIComponent(baseJson));
    base.forEach((n, i) => {
        const el = document.getElementById(`ml-${id}-${i}`);
        if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL';
    });
    const newCost = calculateBatchCost(base, mult);
    document.getElementById(`cost-${id}`).innerText = `Cost: $${newCost}`;
};

window.deleteDocById = async (id) => {
    if (confirm("Delete?")) { await deleteDoc(doc(db, "formulas", id)); loadFeed('my'); }
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

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style = "display:flex; gap:5px; margin-bottom:8px;";
    div.innerHTML = `
        <select class="ing-type" style="flex:1"><option value="Top">T</option><option value="Heart">H</option><option value="Base">B</option></select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
        <select class="ing-cat" style="flex:1">${ACCORDS.map(a => `<option value="${a.val}">${a.icon}</option>`).join('')}</select>
        <button type="button" class="remove-row" style="background:#ff4d4d; color:white; border:none; border-radius:5px; width:30px;">×</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

// --- 5. AUTH & STARTUP ---

onAuthStateChanged(auth, user => {
    const signBtn = document.getElementById('sign-in-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
        signBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
        // Fix: Update the "User" text with real name
        const brandSpan = document.querySelector('.brand span');
        if (brandSpan) brandSpan.innerText = user.displayName ? user.displayName.toUpperCase() : "LAB";
    } else {
        signBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
    setActivePage('home');
});

document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

document.getElementById('formula-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('.ingredient-row');
    const composition = Array.from(rows).map(r => ({
        type: r.querySelector('.ing-type').value,
        name: r.querySelector('.ing-name').value,
        ml: r.querySelector('.ing-ml').value,
        category: r.querySelector('.ing-cat').value
    }));
    await addDoc(collection(db, "formulas"), {
        name: document.getElementById('name').value,
        concentration: document.getElementById('concentration-input').value,
        composition,
        uid: auth.currentUser.uid,
        public: document.getElementById('public-checkbox').checked,
        createdAt: serverTimestamp()
    });
    setActivePage('my');
};

createRow();
