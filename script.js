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

const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

// --- 1. DATA FETCHING (Wait for Auth) ---

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
    } catch (e) { console.warn("Inventory fetch delayed"); }
}

async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center;">Syncing Lab...</p>';

    // Safety: If checking "My Notebook" but not logged in, stop here.
    if (type === 'my' && !auth.currentUser) {
        container.innerHTML = '<p style="padding:20px; text-align:center;">Please Sign In to view your Notebook.</p>';
        return;
    }

    try {
        await loadInventoryCache();
        const q = type === 'home' 
            ? query(collection(db, "formulas"), where("public", "==", true))
            : query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = `<p style="padding:20px; text-align:center;">No formulas found in ${type === 'home' ? 'Public Feed' : 'your Notebook'}.</p>`;
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            const cost = calculateBatchCost(comp);
            const compJson = encodeURIComponent(JSON.stringify(comp));

            // UI Building
            const colors = { Citrus: '#fbbf24', Floral: '#f472b6', Woody: '#78350f', Fresh: '#22d3ee', Sweet: '#f59e0b', Spicy: '#ef4444', Gourmand: '#92400e', Animalic: '#4b5563', Ozonic: '#7dd3fc', Green: '#16a34a', Resinous: '#d97706', Fruity: '#fb7185', Earthy: '#451a03' };
            let totalMl = 0;
            const totals = {};
            comp.forEach(c => { const ml = parseFloat(c.ml) || 0; totalMl += ml; totals[c.category] = (totals[c.category] || 0) + ml; });

            let barHtml = '<div style="display:flex; height:10px; border-radius:6px; overflow:hidden; margin:12px 0; background:#eee;">';
            for (const cat in totals) { barHtml += `<div style="width:${(totals[cat]/totalMl)*100}%; background:${colors[cat] || '#888'}"></div>`; }
            barHtml += '</div>';

            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <h3 style="color:var(--brand-color)">${data.name}</h3>
                    ${barHtml}
                    <div style="font-size:0.85rem; margin-bottom:10px;">
                        ${comp.map((c, i) => `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #f9f9f9;"><span>${c.name}</span><b id="ml-${d.id}-${i}">${c.ml}mL</b></div>`).join('')}
                    </div>
                    <div id="cost-${d.id}" style="font-weight:bold; font-size:0.8rem; color:#16a34a; margin-bottom:10px;">Cost: $${cost}</div>
                    <input type="range" min="1" max="10" value="1" style="width:100%" oninput="updateBatchScale('${d.id}', '${compJson}', this.value)">
                    ${type === 'my' ? `<button onclick="deleteDocById('${d.id}')" style="margin-top:10px; border:none; background:none; color:red; font-size:0.7rem; cursor:pointer;">DELETE</button>` : ''}
                </div>`);
        });
    } catch (e) { 
        container.innerHTML = '<p style="padding:20px; text-align:center; color:red;">Authentication Sync Error. Try clicking Feed again.</p>'; 
    }
}

// --- 2. AUTHENTICATION (The Fix) ---

onAuthStateChanged(auth, (user) => {
    const signBtn = document.getElementById('sign-in-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const brandSpan = document.querySelector('.brand span');

    if (user) {
        signBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        if (userAvatar) userAvatar.src = user.photoURL || '';
        if (brandSpan) brandSpan.innerText = user.displayName ? user.displayName.toUpperCase() : "MY LAB";
        
        // Only load the feed once the user is definitely logged in
        loadFeed('home'); 
    } else {
        signBtn.style.display = 'block';
        userInfo.style.display = 'none';
        if (brandSpan) brandSpan.innerText = "FRAGRANCE LAB";
        loadFeed('home');
    }
});

// --- 3. GLOBAL HELPERS ---

function calculateBatchCost(composition, multiplier = 1) {
    let total = 0;
    composition.forEach(ing => {
        const costPerMl = inventoryCache[ing.name.toLowerCase()] || 0;
        total += (costPerMl * parseFloat(ing.ml)) * multiplier;
    });
    return total.toFixed(2);
}

window.updateBatchScale = (id, baseJson, mult) => {
    const base = JSON.parse(decodeURIComponent(baseJson));
    base.forEach((n, i) => {
        const el = document.getElementById(`ml-${id}-${i}`);
        if (el) el.innerText = (parseFloat(n.ml) * mult).toFixed(2) + 'mL';
    });
    const newCost = calculateBatchCost(base, mult);
    document.getElementById(`cost-${id}`).innerText = `Cost: $${newCost}`;
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

window.deleteDocById = async (id) => {
    if (confirm("Delete this formula?")) { await deleteDoc(doc(db, "formulas", id)); loadFeed('my'); }
};

// UI Listeners
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

// --- 4. INVENTORY & CREATE ---
// (Ensure your existing createRow and form submit logic from the previous message is kept here)
