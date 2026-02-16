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
let accordCache = []; 
let editFormulaId = null; 
let currentMode = "perfume"; 

const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// --- 1. DATA SYNC ---

async function syncAllData() {
    if (!auth.currentUser) return;
    try {
        const invSnap = await getDocs(query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid)));
        inventoryCache = {};
        invSnap.forEach(d => {
            const item = d.data();
            inventoryCache[item.name.toLowerCase().trim()] = item.price / item.size;
        });

        const accSnap = await getDocs(query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid), where("isAccord", "==", true)));
        accordCache = [];
        accSnap.forEach(d => accordCache.push(d.data().name));
    } catch (e) { console.error("Sync error:", e); }
}

function getScentProfile(comp) {
    const total = comp.reduce((sum, ing) => sum + parseFloat(ing.ml || 0), 0) || 1;
    const top = comp.filter(i => i.type === 'Top').reduce((s, i) => s + parseFloat(i.ml), 0);
    const heart = comp.filter(i => i.type === 'Heart').reduce((s, i) => s + parseFloat(i.ml), 0);
    const base = comp.filter(i => i.type === 'Base').reduce((s, i) => s + parseFloat(i.ml), 0);
    return { t: (top / total) * 100, h: (heart / total) * 100, b: (base / total) * 100 };
}

// --- 2. NAVIGATION & FEED ---

window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');
    
    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
    if (pageId === 'accords') loadFeed('accords');
    if (pageId === 'inventory') renderInventoryList();
};

async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; padding:20px;">Updating Lab...</p>';

    try {
        await syncAllData();
        let q;
        if (type === 'home') {
            q = query(collection(db, "formulas"), where("public", "==", true), where("isAccord", "==", false));
        } else if (type === 'my') {
            q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid), where("isAccord", "==", false));
        } else {
            q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid), where("isAccord", "==", true));
        }

        const snap = await getDocs(q);
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">No formulas found here yet.</p>';
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            const profile = getScentProfile(comp);
            
            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="margin:0;">${data.name}</h3>
                            <small style="color:var(--brand-color)">${data.creationType || 'Original'}</small>
                        </div>
                        ${data.isAccord ? '<span class="accord-tag">Accord</span>' : ''}
                    </div>

                    <div class="scent-bar" style="display:flex; height:8px; border-radius:4px; overflow:hidden; margin:10px 0; background:#eee;">
                        <div style="width:${profile.t}%; background:#fcd34d"></div>
                        <div style="width:${profile.h}%; background:#f87171"></div>
                        <div style="width:${profile.b}%; background:#60a5fa"></div>
                    </div>

                    <div style="font-size:0.8rem; margin-bottom:10px;">
                        ${comp.map(c => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:2px 0;">
                            <span>${c.name}</span><b>${c.ml}mL</b>
                        </div>`).join('')}
                    </div>

                    <div style="display:flex; gap:10px;">
                        <button onclick="editFormula('${d.id}')" class="secondary-btn" style="flex:1; margin:0;">Edit</button>
                        <button onclick="deleteDocById('${d.id}', '${type}')" class="secondary-btn" style="flex:1; margin:0; color:red;">Delete</button>
                    </div>
                </div>`);
        });
    } catch (e) { 
        console.error("LoadFeed Error:", e);
        container.innerHTML = '<p>Error loading formulas. Check console.</p>';
    }
}

// --- 3. FORM ACTIONS ---

window.toggleInspiredField = () => {
    const type = document.getElementById('creation-type').value;
    document.getElementById('inspired-box').style.display = type === 'Inspired' ? 'block' : 'none';
};

window.prepareNewAccord = () => {
    currentMode = "accord";
    editFormulaId = null;
    setActivePage('create');
    document.getElementById('formula-form').reset();
    document.getElementById('manual-base-input').value = 0;
    document.getElementById('create-page-title').innerText = "Create New Accord";
    toggleInspiredField();
};

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
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

// --- 4. DATA OPS ---

window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editFormulaId = id;
        currentMode = data.isAccord ? "accord" : "perfume";
        setActivePage('create');
        document.getElementById('name').value = data.name;
        document.getElementById('manual-base-input').value = data.baseAmount || 0;
        document.getElementById('creation-type').value = data.creationType || 'Original';
        document.getElementById('inspired-name').value = data.inspiredName || '';
        toggleInspiredField();
        
        const container = document.getElementById('ingredient-rows-container');
        container.innerHTML = '';
        data.composition.forEach(item => createRow(item));
    }
};

window.deleteDocById = async (id, type) => {
    if (confirm("Delete this?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed(type);
    }
};

// --- 5. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
        document.getElementById('user-info').style.display = user ? 'flex' : 'none';
        if (user) {
            document.querySelector('.brand span').innerText = user.displayName.toUpperCase();
            document.getElementById('user-avatar').src = user.photoURL;
            syncAllData();
        }
        setActivePage('home');
    });

    // Event Listeners
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
            creationType: document.getElementById('creation-type').value,
            inspiredName: document.getElementById('inspired-name').value,
            isAccord: currentMode === "accord",
            composition,
            uid: auth.currentUser.uid,
            public: document.getElementById('public-checkbox').checked,
            updatedAt: serverTimestamp()
        };

        if (editFormulaId) {
            await updateDoc(doc(db, "formulas", editFormulaId), formulaData);
            editFormulaId = null;
        } else {
            await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
        }
        
        setActivePage(formulaData.isAccord ? 'accords' : 'my');
    };

    document.getElementById('creation-type').onchange = toggleInspiredField;
    document.getElementById('new-accord-btn').onclick = window.prepareNewAccord;
    document.getElementById('add-row-btn').onclick = () => createRow();
    document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
    document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
    document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
    document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('sign-out-btn').onclick = () => signOut(auth);
});
