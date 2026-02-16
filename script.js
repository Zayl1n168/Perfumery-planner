import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    initializeFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, deleteDoc, doc, updateDoc, getDoc, clearIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8"
};

// 1. INITIALIZE WITH STABLE SETTINGS
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Fixes "Listen stream errored"
  useFetchStreams: false              // Fixes "Name: undefined" error
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 2. STATE MANAGEMENT
let inventoryCache = {}; 
let accordCache = []; 
let editFormulaId = null; 
let currentMode = "perfume"; // Tracks if we are saving a Perfume or an Accord

const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// 3. DATA SYNC
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
    } catch (e) {
        console.warn("Syncing... If persistent, check Firestore Rules.");
    }
}

// 4. MAIN LOAD FUNCTION
async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">Establishing connection...</p>';

    try {
        await syncAllData();
        let q;
        const colRef = collection(db, "formulas");
        
        if (type === 'home') {
            q = query(colRef, where("public", "==", true), where("isAccord", "==", false));
        } else if (type === 'my') {
            q = query(colRef, where("uid", "==", auth.currentUser.uid), where("isAccord", "==", false));
        } else {
            q = query(colRef, where("uid", "==", auth.currentUser.uid), where("isAccord", "==", true));
        }

        const snap = await getDocs(q);
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; padding:30px; opacity:0.5;">No records found.</p>';
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="margin:0;">${data.name}</h3>
                            <small style="color:#6366f1;">${data.creationType || 'Original'}${data.inspiredName ? ': ' + data.inspiredName : ''}</small>
                        </div>
                        ${data.isAccord ? '<span class="accord-tag" style="background:#ede9fe; color:#7c3aed; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold;">ACCORD</span>' : ''}
                    </div>
                    <div style="font-size:0.85rem; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                        ${comp.map(c => `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>${c.name}</span><b>${c.ml}mL</b>
                        </div>`).join('')}
                    </div>
                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <button onclick="editFormula('${d.id}')" class="secondary-btn" style="flex:1; margin:0;">Edit</button>
                        <button onclick="deleteDocById('${d.id}', '${type}')" class="secondary-btn" style="flex:1; margin:0; color:#ef4444; border-color:#fee2e2;">Delete</button>
                    </div>
                </div>`);
        });
    } catch (e) {
        console.error("Load Error:", e);
        // If we hit the DOMException seen in console, try clearing persistence
        if (e.code === 'failed-precondition' || e.name === 'DOMException') {
            clearIndexedDbPersistence(db);
        }
        container.innerHTML = `<div class="panel" style="text-align:center; color:#ef4444;">Connection Interrupted. Try refreshing.</div>`;
    }
}

// 5. INVENTORY & ACCORD ACTIONS
async function renderInventoryList() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;">Loading Stockroom...</p>';
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">Stockroom empty.</p>';
            return;
        }
        snap.forEach(d => {
            const item = d.data();
            list.insertAdjacentHTML('beforeend', `
                <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px;">
                    <div><b>${item.name}</b><br><small>${item.qty}mL</small></div>
                    <button onclick="deleteInventory('${d.id}')" style="color:#ef4444; background:none; border:none; font-weight:bold; cursor:pointer;">&times;</button>
                </div>`);
        });
    } catch (e) {
        list.innerHTML = '<p>Error loading stock.</p>';
    }
}

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

// 6. GLOBAL WINDOW NAVIGATION
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

window.toggleInspiredField = () => {
    const box = document.getElementById('inspired-box');
    const type = document.getElementById('creation-type').value;
    if (box) box.style.display = type === 'Inspired' ? 'block' : 'none';
};

window.prepareNewAccord = () => {
    currentMode = "accord";
    editFormulaId = null;
    setActivePage('create');
    document.getElementById('formula-form').reset();
    document.getElementById('ingredient-rows-container').innerHTML = '';
    createRow();
    document.getElementById('manual-base-input').value = 0;
    document.getElementById('create-page-title').innerText = "Accord Lab: New Base";
    window.toggleInspiredField();
};

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
        document.getElementById('public-checkbox').checked = data.public || false;
        window.toggleInspiredField();
        
        const container = document.getElementById('ingredient-rows-container');
        container.innerHTML = '';
        data.composition.forEach(item => createRow(item));
    }
};

window.deleteInventory = async (id) => {
    if (confirm("Delete this material?")) {
        await deleteDoc(doc(db, "inventory", id));
        renderInventoryList();
    }
};

window.deleteDocById = async (id, type) => {
    if (confirm("Permanently delete formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed(type);
    }
};

// 7. INITIALIZATION & FORM SUBMIT
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const info = document.getElementById('user-info');
        const loginBtn = document.getElementById('sign-in-btn');
        if (user) {
            loginBtn.style.display = 'none';
            info.style.display = 'flex';
            document.getElementById('user-avatar').src = user.photoURL;
            document.querySelector('.brand span').innerText = user.displayName.split(' ')[0].toUpperCase();
            await syncAllData();
            setActivePage('home');
        } else {
            loginBtn.style.display = 'block';
            info.style.display = 'none';
            setActivePage('home');
        }
    });

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
        
        currentMode = "perfume"; // Reset to default
        setActivePage(formulaData.isAccord ? 'accords' : 'my');
    };

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
        e.target.reset();
        renderInventoryList();
    };

    document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('sign-out-btn').onclick = () => signOut(auth);
    document.getElementById('menu-btn').onclick = () => { 
        document.getElementById('drawer').classList.add('open'); 
        document.getElementById('drawer-overlay').classList.add('show'); 
    };
    document.getElementById('drawer-overlay').onclick = () => { 
        document.getElementById('drawer').classList.remove('open'); 
        document.getElementById('drawer-overlay').classList.remove('show'); 
    };
    document.querySelectorAll('.drawer-item').forEach(item => { 
        item.onclick = () => setActivePage(item.dataset.page); 
    });
    
    document.getElementById('creation-type').onchange = window.toggleInspiredField;
    document.getElementById('new-accord-btn').onclick = window.prepareNewAccord;
    document.getElementById('add-row-btn').onclick = () => createRow();

    createRow(); // Start with one row
});
