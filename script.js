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

// 1. STABLE INITIALIZATION
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, 
  useFetchStreams: false
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 2. STATE & CONSTANTS
let inventoryCache = {}; 
let editFormulaId = null; 
let currentMode = "perfume"; 

const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// 3. SCENT PROFILE CALCULATION (The Scaler/Top Bar Logic)
function getScentProfile(comp) {
    const total = comp.reduce((sum, ing) => sum + parseFloat(ing.ml || 0), 0) || 1;
    const top = comp.filter(i => i.type === 'Top').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    const heart = comp.filter(i => i.type === 'Heart').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    const base = comp.filter(i => i.type === 'Base').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    
    return { 
        t: (top / total) * 100, 
        h: (heart / total) * 100, 
        b: (base / total) * 100 
    };
}

// 4. MAIN FEED LOADING
async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">Refreshing Lab...</p>';

    try {
        let q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        if (type === 'home') q = query(collection(db, "formulas"), where("public", "==", true));

        const snap = await getDocs(q);
        container.innerHTML = '';

        if (snap.empty) {
            container.innerHTML = '<p style="text-align:center; padding:30px; opacity:0.5;">No records found.</p>';
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const isAccord = data.isAccord === true;
            
            // UI Filtering
            if (type === 'home' && isAccord) return;
            if (type === 'my' && isAccord) return;
            if (type === 'accords' && !isAccord) return;

            const comp = data.composition || [];
            const profile = getScentProfile(comp);
            
            // Inspired By Display Logic
            const label = (data.creationType === 'Inspired' && data.inspiredName) 
                ? `Inspired by: <b>${data.inspiredName}</b>` 
                : (data.creationType || 'Original');

            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="margin:0;">${data.name || 'Untitled'}</h3>
                            <small style="color:#6366f1;">${label}</small>
                        </div>
                        ${isAccord ? '<span class="accord-tag" style="background:#ede9fe; color:#7c3aed; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:bold;">ACCORD</span>' : ''}
                    </div>

                    <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; margin:12px 0; background:#f1f5f9;">
                        <div style="width:${profile.t}%; background:#fcd34d"></div>
                        <div style="width:${profile.h}%; background:#f87171"></div>
                        <div style="width:${profile.b}%; background:#60a5fa"></div>
                    </div>

                    <div style="font-size:0.85rem;">
                        ${comp.map(c => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #f8fafc; padding:3px 0;">
                            <span>${c.name}</span><b>${c.ml}mL</b>
                        </div>`).join('')}
                    </div>

                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <button onclick="editFormula('${d.id}')" class="secondary-btn" style="flex:1;">Edit</button>
                        <button onclick="deleteDocById('${d.id}', '${type}')" class="secondary-btn" style="flex:1; color:#ef4444;">Delete</button>
                    </div>
                </div>`);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p style="text-align:center; color:red;">Connection Error. Check internet.</p>`;
    }
}

// 5. INVENTORY & ROWS
async function renderInventoryList() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        list.innerHTML = '';
        snap.forEach(d => {
            const item = d.data();
            list.insertAdjacentHTML('beforeend', `
                <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:10px; margin-bottom:8px;">
                    <div><b>${item.name}</b><br><small>${item.qty}mL in stock</small></div>
                    <button onclick="deleteInventory('${d.id}')" style="color:#ef4444; border:none; background:none; font-weight:bold; cursor:pointer;">&times;</button>
                </div>`);
        });
    } catch (e) { console.error(e); }
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
        <button type="button" class="remove-row" style="background:#fee2e2; color:#ef4444; border:none; border-radius:8px;">&times;</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

// 6. NAVIGATION & ACTIONS
window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + pageId).style.display = 'block';
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');
    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
    if (pageId === 'accords') loadFeed('accords');
    if (pageId === 'inventory') renderInventoryList();
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
        const container = document.getElementById('ingredient-rows-container');
        container.innerHTML = '';
        (data.composition || []).forEach(item => createRow(item));
        if (typeof window.toggleInspiredField === "function") window.toggleInspiredField();
    }
};

window.deleteInventory = async (id) => {
    if (confirm("Delete from stockroom?")) {
        await deleteDoc(doc(db, "inventory", id));
        renderInventoryList();
    }
};

window.deleteDocById = async (id, type) => {
    if (confirm("Delete formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed(type);
    }
};

window.toggleInspiredField = () => {
    const box = document.getElementById('inspired-box');
    const type = document.getElementById('creation-type').value;
    if (box) box.style.display = type === 'Inspired' ? 'block' : 'none';
};

// 7. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('sign-in-btn').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('user-avatar').src = user.photoURL;
            document.querySelector('.brand span').innerText = user.displayName.split(' ')[0].toUpperCase();
            setActivePage('home');
        } else {
            document.getElementById('sign-in-btn').style.display = 'block';
            document.getElementById('user-info').style.display = 'none';
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

        const fData = {
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
            await updateDoc(doc(db, "formulas", editFormulaId), fData);
            editFormulaId = null;
        } else {
            await addDoc(collection(db, "formulas"), { ...fData, createdAt: serverTimestamp() });
        }
        setActivePage(fData.isAccord ? 'accords' : 'my');
    };

    document.getElementById('inventory-form').onsubmit = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, "inventory"), {
            name: document.getElementById('inv-name').value,
            qty: parseFloat(document.getElementById('inv-qty').value),
            price: parseFloat(document.getElementById('inv-price').value),
            size: parseFloat(document.getElementById('inv-size').value),
            uid: auth.currentUser.uid
        });
        e.target.reset();
        renderInventoryList();
    };

    // Navigation & Buttons
    document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('sign-out-btn').onclick = () => signOut(auth);
    document.getElementById('menu-btn').onclick = () => document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-overlay').onclick = () => document.getElementById('drawer').classList.remove('open');
    document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
    document.getElementById('creation-type').onchange = window.toggleInspiredField;
    document.getElementById('add-row-btn').onclick = () => createRow();
    
    document.getElementById('new-accord-btn').onclick = () => {
        currentMode = "accord";
        editFormulaId = null;
        setActivePage('create');
        document.getElementById('formula-form').reset();
        document.getElementById('ingredient-rows-container').innerHTML = '';
        createRow();
    };
});
