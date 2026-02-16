import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { 
    initializeFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, deleteDoc, doc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8"
};

// 1. INITIALIZE WITH STABLE CONNECTION SETTINGS
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Forces standard HTTP traffic
  useFetchStreams: false              // Prevents the "undefined" stream error
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 2. STATE MANAGEMENT
let inventoryCache = {}; 
let accordCache = []; 
let editFormulaId = null; 
let currentMode = "perfume"; 

const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// 3. DATA SYNC (Inventory & Accords)
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
        console.warn("Syncing...");
    }
}

// 4. MAIN LOAD FUNCTION
async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">Refreshing Lab Data...</p>';

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
            container.innerHTML = '<p style="text-align:center; padding:30px; opacity:0.5;">No entries found in this section.</p>';
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
                            <small style="color:#6366f1; font-weight:bold;">${data.creationType || 'Original'}${data.inspiredName ? ': ' + data.inspiredName : ''}</small>
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
        console.error("Critical Load Error:", e);
        container.innerHTML = `<div class="panel" style="text-align:center; color:#ef4444;">
            <b>Connection Error</b><br><small>${e.message}</small>
        </div>`;
    }
}

// 5. INVENTORY RENDERING
async function renderInventoryList() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center; padding:20px;">Accessing Stockroom...</p>';
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        list.innerHTML = '';
        if (snap.empty) {
            list.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">Stockroom is empty.</p>';
            return;
        }
        snap.forEach(d => {
            const item = d.data();
            list.insertAdjacentHTML('beforeend', `
                <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:12px; margin-bottom:8px;">
                    <div><b style="color:#1e293b;">${item.name}</b><br><small style="color:#64748b;">${item.qty}mL remaining</small></div>
                    <button onclick="deleteInventory('${d.id}')" style="color:#ef4444; background:#fff1f2; border:none; width:32px; height:32px; border-radius:50%; font-weight:bold; cursor:pointer;">&times;</button>
                </div>`);
        });
    } catch (e) {
        list.innerHTML = '<p style="color:red; text-align:center;">Error loading stock.</p>';
    }
}

// 6. GLOBAL WINDOW ACTIONS
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
    document.getElementById('manual-base-input').value = 0;
    document.getElementById('create-page-title').innerText = "Create New Accord";
    window.toggleInspiredField();
};

window.deleteInventory = async (id) => {
    if (confirm("Permanently remove from stockroom?")) {
        await deleteDoc(doc(db, "inventory", id));
        renderInventoryList();
    }
};

window.deleteDocById = async (id, type) => {
    if (confirm("Permanently delete this formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed(type);
    }
};

// 7. INITIALIZATION & AUTH
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

    // Form Submissions
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

    // Nav Bindings
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
    
    const creationSelect = document.getElementById('creation-type');
    if (creationSelect) creationSelect.onchange = window.toggleInspiredField;

    const newAccBtn = document.getElementById('new-accord-btn');
    if (newAccBtn) newAccBtn.onclick = window.prepareNewAccord;
});
