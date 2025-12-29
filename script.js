import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, limit, getDocs, 
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
let inventoryCache = {}; // Stores { "Material Name": costPerMl }

// --- Auth & Startup ---
onAuthStateChanged(auth, user => {
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    if (user) {
        if (document.getElementById('user-avatar')) document.getElementById('user-avatar').src = user.photoURL;
        loadInventoryCache(); // Pre-load costs for calculations
    }
    setActivePage('home');
});

// --- Load Inventory Costs ---
async function loadInventoryCache() {
    const q = query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    inventoryCache = {};
    snap.forEach(d => {
        const item = d.data();
        if (item.price && item.size) {
            inventoryCache[item.name.toLowerCase()] = item.price / item.size;
        }
    });
}

// --- Calculation Logic ---
function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

// --- Card Rendering ---
function createCard(d, isOwner) {
    const data = d.data();
    const comp = Array.isArray(data.composition) ? data.composition : [];
    const compJson = encodeURIComponent(JSON.stringify(comp));
    const batchCost = calculateBatchCost(comp);

    const renderSection = (type) => {
        const notes = comp.filter(n => n.type === type);
        if (notes.length === 0) return '';
        return `<div class="note-section-title">${type} Notes</div>` + 
            notes.map(n => `<div class="ing-item"><span>${n.name}</span><b id="ml-${d.id}-${comp.indexOf(n)}">${n.ml}mL</b></div>`).join('');
    };

    return `
        <div class="fragrance-card">
            <div class="card-header-brand">
                <h3>${data.name || 'Untitled'}</h3>
                <span class="badge">${data.concentration || 'EDP'}</span>
            </div>
            <div class="card-body">
                ${getVisualizerHtml(comp)}
                <div class="composition-list">
                    ${comp.length > 0 ? (renderSection('Top') + renderSection('Heart') + renderSection('Base')) : '<p>Legacy formula.</p>'}
                </div>
                <div id="cost-display-${d.id}" class="cost-badge">Batch Cost: $${batchCost}</div>
                ${comp.length > 0 ? `
                    <div class="scaler-ui">
                        <label id="val-${d.id}" style="font-size:0.65rem; font-weight:800; color:var(--muted); display:block; margin-top:10px;">BATCH SIZE: 1x</label>
                        <input type="range" id="scale-${d.id}" min="1" max="50" value="1" oninput="updateScale('${d.id}', '${compJson}')">
                    </div>` : ''}
            </div>
            ${isOwner ? `
                <div class="card-actions" style="padding:15px; display:flex; gap:10px; border-top:1px solid var(--border)">
                    <button class="btn small" onclick="editFormula('${d.id}')" style="flex:1; background:var(--brand-color)">EDIT</button>
                    <button class="btn small" onclick="deleteFormula('${d.id}')" style="flex:1; background:#ef4444; color:white">DELETE</button>
                </div>` : ''}
        </div>`;
}

window.updateScale = (id, baseJson) => {
    const mult = document.getElementById(`scale-${id}`).value;
    const base = JSON.parse(decodeURIComponent(baseJson));
    
    // Update mL values
    base.forEach((n, i) => { 
        const el = document.getElementById(`ml-${id}-${i}`); 
        if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL'; 
    });
    
    // Update Cost Badge
    const newCost = calculateBatchCost(base, mult);
    document.getElementById(`cost-display-${id}`).innerText = `Batch Cost: $${newCost}`;
    document.getElementById(`val-${id}`).innerText = `BATCH SIZE: ${mult}x`;
};

// ... (Rest of your navigation, form, and loadFeed functions stay the same)
