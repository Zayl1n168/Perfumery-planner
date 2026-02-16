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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// FIX: Force long polling to stop the 'Listen' stream error
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- STATE MANAGEMENT ---
let inventoryCache = {}; 
let accordCache = []; 
let editFormulaId = null; 
let currentMode = "perfume"; 

const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// --- DATA SYNC ---
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
        console.warn("Syncing... (Database may be empty)");
    }
}

// --- FEED LOGIC ---
async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; padding:20px;">Connecting to Lab...</p>';

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
            container.innerHTML = '<p style="text-align:center; padding:20px; opacity:0.5;">No entries found.</p>';
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
                            <small style="color:#6366f1;">${data.creationType || 'Original'}</small>
                        </div>
                        ${data.isAccord ? '<span class="accord-tag" style="background:#ede9fe; color:#7c3aed; padding:2px 6px; border-radius:4px; font-size:0.7rem;">Accord</span>' : ''}
                    </div>
                    <div style="font-size:0.85rem; margin-top:10px;">
                        ${comp.map(c => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #f1f5f9; padding:2px 0;">
                            <span>${c.name}</span><b>${c.ml}mL</b>
                        </div>`).join('')}
                    </div>
                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <button onclick="editFormula('${d.id}')" class="secondary-btn" style="flex:1;">Edit</button>
                        <button onclick="deleteDocById('${d.id}', '${type}')" class="secondary-btn" style="flex:1; color:red;">Delete</button>
                    </div>
                </div>`);
        });
    } catch (e) {
        console.error("Load Error:", e);
        container.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Connection failed. Check your internet.</p>`;
    }
}

async function renderInventoryList() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center;">Checking stock...</p>';
    try {
        const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
        const snap = await getDocs(q);
        list.innerHTML = '';
        if (snap.empty) list.innerHTML = '<p style="text-align:center; opacity:0.5;">Stockroom is empty.</p>';
        snap.forEach(d => {
            const item = d.data();
            list.insertAdjacentHTML('beforeend', `
                <div class="panel" style="display:flex; justify-content:space-between; align-items:center; padding:10px;">
                    <div><b>${item.name}</b><br><small>${item.qty}mL in stock</small></div>
                    <button onclick="deleteInventory('${d.id}')" style="color:red; background:none; border:none; font-weight:bold; cursor:pointer;">X</button>
                </div>`);
        });
    } catch (e) {
        list.innerHTML = '<p>Error loading stock.</p>';
    }
}

// --- GLOBAL UTILS ---
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

window.deleteInventory = async (id) => {
    if (confirm("Delete this material?")) {
        await deleteDoc(doc(db, "inventory", id));
        renderInventoryList();
    }
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const info = document.getElementById('user-info');
        const loginBtn = document.getElementById('sign-in-btn');
        if (user) {
            loginBtn.style.display = 'none';
            info.style.display = 'flex';
            document.getElementById('user-avatar').src = user.photoURL;
            document.querySelector('.brand span').innerText = user.displayName.toUpperCase();
            await syncAllData();
            setActivePage('home');
        } else {
            loginBtn.style.display = 'block';
            info.style.display = 'none';
        }
    });

    document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
    document.getElementById('sign-out-btn').onclick = () => signOut(auth);
    document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
    document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
    document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
    
    // Add logic for Creation Type Change
    const creationSelect = document.getElementById('creation-type');
    if (creationSelect) creationSelect.onchange = window.toggleInspiredField;

    const newAccBtn = document.getElementById('new-accord-btn');
    if (newAccBtn) newAccBtn.onclick = window.prepareNewAccord;
});
