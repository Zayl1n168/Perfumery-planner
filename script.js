import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { initializeFirestore, collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true, useFetchStreams: false });
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- STATE MANAGEMENT ---
let inventoryCache = {}; 
let editFormulaId = null; 
let currentMode = "perfume"; 
let currentBatch = { ingredients: [], index: 0, formulaId: null, name: '' };
const ACCORDS = ['Citrus', 'Floral', 'Woody', 'Fresh', 'Sweet', 'Spicy', 'Gourmand', 'Animalic', 'Ozonic', 'Green', 'Resinous', 'Fruity', 'Earthy'];

// --- AUTH HANDLERS ---
window.login = () => signInWithPopup(auth, provider).catch(e => console.error("Login Failed:", e));
window.logout = () => signOut(auth).then(() => location.reload());

// --- MATH & HELPERS ---
function getScentProfile(comp) {
    const total = comp.reduce((sum, ing) => sum + parseFloat(ing.ml || 0), 0) || 1;
    const top = comp.filter(i => i.type === 'Top').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    const heart = comp.filter(i => i.type === 'Heart').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    const base = comp.filter(i => i.type === 'Base').reduce((s, i) => s + parseFloat(i.ml || 0), 0);
    return { t: (top / total) * 100, h: (heart / total) * 100, b: (base / total) * 100 };
}

function calculateBatchCost(comp) {
    let total = 0;
    comp.forEach(ing => {
        const pricePerMl = inventoryCache[ing.name.toLowerCase().trim()] || 0;
        total += (pricePerMl * parseFloat(ing.ml || 0));
    });
    return total.toFixed(2);
}

// --- LAB ASSISTANT ---
window.startMakeMode = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if(!docSnap.exists()) return;
    const data = docSnap.data();
    currentBatch = { formulaId: id, name: data.name, originalIngredients: data.composition, ingredients: [], index: 0 };
    document.getElementById('make-modal').style.display = 'block';
    document.getElementById('setup-screen').style.display = 'block';
    document.getElementById('step-screen').style.display = 'none';
};

window.startScaledBatch = () => {
    const vol = parseFloat(document.getElementById('target-vol').value);
    const conc = parseFloat(document.getElementById('target-conc').value) / 100;
    const currentTotalOil = currentBatch.originalIngredients.reduce((sum, i) => sum + parseFloat(i.ml), 0);
    const scaleFactor = (vol * conc) / currentTotalOil;
    currentBatch.ingredients = currentBatch.originalIngredients.map(i => ({
        ...i, ml: (parseFloat(i.ml) * scaleFactor).toFixed(2)
    }));
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('step-screen').style.display = 'block';
    showStep();
};

function showStep() {
    const content = document.getElementById('modal-content');
    const btn = document.getElementById('next-btn');
    if (currentBatch.index < currentBatch.ingredients.length) {
        const ing = currentBatch.ingredients[currentBatch.index];
        content.innerHTML = `Add: <b>${ing.ml}mL</b> of <b>${ing.name}</b>`;
        btn.onclick = () => { currentBatch.index++; showStep(); };
    } else {
        const date = new Date();
        const batchCode = `${currentBatch.name.substring(0,2).toUpperCase()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
        content.innerHTML = `Done! Batch <b>${batchCode}</b> created.`;
        btn.innerText = "Save Batch";
        btn.onclick = async () => {
            if(!auth.currentUser) return alert("Must be logged in");
            await addDoc(collection(db, "batches"), { batchNumber: batchCode, formulaName: currentBatch.name, uid: auth.currentUser.uid, status: "Macerating", createdAt: serverTimestamp() });
            alert("Batch saved!");
            document.getElementById('make-modal').style.display = 'none';
        };
    }
}

// --- DATA LOGIC ---
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

async function syncAllData() {
    if (!auth.currentUser) return;
    const invSnap = await getDocs(query(collection(db, "inventory"), where("uid", "==", auth.currentUser.uid)));
    inventoryCache = {};
    invSnap.forEach(d => {
        const item = d.data();
        inventoryCache[item.name.toLowerCase().trim()] = (item.price || 0) / (item.size || 1);
    });
}

async function loadFeed(type) {
    const containerId = type === 'home' ? 'cards' : (type === 'my' ? 'my-cards' : 'accord-list');
    const container = document.getElementById(containerId);
    if (!container) return;
    await syncAllData();
    const q = type === 'home' ? query(collection(db, "formulas"), where("public", "==", true)) : query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    container.innerHTML = '';
    snap.forEach(d => {
        const data = d.data();
        if ((type === 'home' && data.isAccord) || (type === 'my' && data.isAccord) || (type === 'accords' && !data.isAccord)) return;
        const comp = data.composition || [];
        const profile = getScentProfile(comp);
        container.insertAdjacentHTML('beforeend', `
            <div class="panel">
                <h3>${data.name}</h3>
                <div style="margin-top:10px;">
                    <button onclick="startMakeMode('${d.id}')">Make</button>
                    <button onclick="editFormula('${d.id}')">Edit</button>
                </div>
            </div>`);
    });
}

// --- INITIALIZATION ---
window.editFormula = async (id) => {
    const docSnap = await getDoc(doc(db, "formulas", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        editFormulaId = id;
        currentMode = data.isAccord ? "accord" : "perfume";
        window.setActivePage('create');
        document.getElementById('name').value = data.name;
        document.getElementById('creation-type').value = data.creationType || 'Original';
        document.getElementById('ingredient-rows-container').innerHTML = '';
        (data.composition || []).forEach(item => createRow(item));
    }
};

window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if(target) target.style.display = 'block';
    if (pageId === 'home' || pageId === 'my' || pageId === 'accords') loadFeed(pageId);
};

document.addEventListener('DOMContentLoaded', () => {
    // Buttons (Login/Logout/Menu)
    document.getElementById('sign-in-btn').onclick = window.login;
    document.getElementById('sign-out-btn').onclick = window.logout;
    document.getElementById('menu-btn').onclick = () => document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-overlay').onclick = () => document.getElementById('drawer').classList.remove('open');
    document.getElementById('add-row-btn').onclick = () => createRow();

    // Drawer Nav + Close Behavior
    document.querySelectorAll('.drawer-item').forEach(item => {
        item.onclick = () => {
            window.setActivePage(item.dataset.page);
            document.getElementById('drawer').classList.remove('open'); // FIX: Added this
        };
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            document.getElementById('sign-in-btn').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            window.setActivePage('home');
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
        await addDoc(collection(db, "formulas"), {
            name: document.getElementById('name').value,
            composition,
            uid: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });
        alert("Saved!");
    };
});
