import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, deleteDoc, doc 
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

const ACCORDS = [
  { val: 'Citrus', icon: '🍋' }, { val: 'Floral', icon: '🌸' }, { val: 'Woody', icon: '🪵' },
  { val: 'Fresh', icon: '🌊' }, { val: 'Sweet', icon: '🍯' }, { val: 'Spicy', icon: '🌶️' },
  { val: 'Gourmand', icon: '🧁' }, { val: 'Animalic', icon: '🐾' }, { val: 'Ozonic', icon: '💨' },
  { val: 'Green', icon: '🌿' }, { val: 'Resinous', icon: '🔥' }, { val: 'Fruity', icon: '🍎' },
  { val: 'Earthy', icon: '🌱' }
];

// --- 1. CORE FUNCTIONS (Defined first so they are available everywhere) ---

async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px; text-align:center;">Updating Lab...</p>';

    try {
        let q = query(collection(db, "formulas"), where("public", "==", true));
        if (type === 'my' && auth.currentUser) {
            q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
        }
        
        const snap = await getDocs(q);
        container.innerHTML = '';
        
        if (snap.empty) {
            container.innerHTML = '<p style="padding:20px; text-align:center;">No formulas found.</p>';
            return;
        }

        snap.forEach(d => {
            const data = d.data();
            const comp = data.composition || [];
            
            // Generate visualizer bar
            const colors = { Citrus: '#fbbf24', Floral: '#f472b6', Woody: '#78350f', Fresh: '#22d3ee', Sweet: '#f59e0b', Spicy: '#ef4444', Gourmand: '#92400e', Animalic: '#4b5563', Ozonic: '#7dd3fc', Green: '#16a34a', Resinous: '#d97706', Fruity: '#fb7185', Earthy: '#451a03' };
            let totalMl = 0;
            const totals = {};
            comp.forEach(c => { const ml = parseFloat(c.ml) || 0; totalMl += ml; totals[c.category] = (totals[c.category] || 0) + ml; });
            
            let barHtml = '<div style="display:flex; height:8px; border-radius:4px; overflow:hidden; margin:10px 0; background:#eee;">';
            for (const cat in totals) { barHtml += `<div style="width:${(totals[cat]/totalMl)*100}%; background:${colors[cat] || '#888'}"></div>`; }
            barHtml += '</div>';

            const card = `
                <div class="panel">
                    <h3 style="color:var(--brand-color)">${data.name}</h3>
                    <p style="font-size:0.75rem; font-weight:bold; color:var(--muted);">${data.concentration}</p>
                    ${totalMl > 0 ? barHtml : ''}
                    <div style="font-size:0.85rem; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                        ${comp.map(c => `<div style="display:flex; justify-content:space-between;"><span>${c.name}</span><b>${c.ml}mL</b></div>`).join('')}
                    </div>
                    ${type === 'my' ? `<button onclick="deleteDocById('${d.id}')" style="margin-top:15px; background:none; border:none; color:#ef4444; font-size:0.7rem; cursor:pointer; font-weight:bold;">DELETE FORMULA</button>` : ''}
                </div>`;
            container.insertAdjacentHTML('beforeend', card);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:red; padding:20px;">Connection Error.</p>';
    }
}

// Global Delete Function
window.deleteDocById = async (id) => {
    if (confirm("Delete this formula?")) {
        await deleteDoc(doc(db, "formulas", id));
        loadFeed('my');
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
};

// --- 2. FORM & UI HELPERS ---

function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style.display = "flex"; div.style.gap = "8px"; div.style.marginBottom = "10px";
    div.innerHTML = `
        <select class="ing-type" style="flex:1"><option value="Top">Top</option><option value="Heart">Heart</option><option value="Base">Base</option></select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
        <select class="ing-cat" style="flex:1.5">${ACCORDS.map(a => `<option value="${a.val}">${a.icon} ${a.val}</option>`).join('')}</select>
        <button type="button" class="remove-row" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:0 10px;">✕</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

// --- 3. EVENT LISTENERS ---

document.getElementById('formula-form').onsubmit = async (e) => {
    e.preventDefault();
    const rows = document.querySelectorAll('.ingredient-row');
    const composition = Array.from(rows).map(r => ({
        type: r.querySelector('.ing-type').value,
        name: r.querySelector('.ing-name').value,
        ml: r.querySelector('.ing-ml').value,
        category: r.querySelector('.ing-cat').value
    }));

    const formulaData = {
        name: document.getElementById('name').value,
        concentration: document.getElementById('concentration-input').value,
        composition,
        uid: auth.currentUser.uid,
        public: document.getElementById('public-checkbox').checked,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "formulas"), formulaData);
        setActivePage('my'); // Now loadFeed('my') is defined above and will work
    } catch (err) {
        alert("Error: " + err.message);
    }
};

onAuthStateChanged(auth, user => {
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    setActivePage('home');
});

document.getElementById('add-row-btn').onclick = () => createRow();
document.getElementById('menu-btn').onclick = () => { document.getElementById('drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); };
document.getElementById('drawer-overlay').onclick = () => { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); };
document.querySelectorAll('.drawer-item').forEach(item => { item.onclick = () => setActivePage(item.dataset.page); });
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

// Initial setup
createRow();
