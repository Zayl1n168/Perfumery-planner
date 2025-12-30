import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, 
    serverTimestamp, doc, updateDoc, getDoc 
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

// --- Navigation ---
window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');

    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
    if (pageId === 'create' && !editModeId) resetForm();
};

// --- Form Logic (Adding Materials) ---
function createRow(data = { type: 'Top', name: '', ml: '', category: 'Floral' }) {
    const container = document.getElementById('ingredient-rows-container');
    const div = document.createElement('div');
    div.className = 'ingredient-row';
    div.style.display = "flex";
    div.style.gap = "8px";
    div.style.marginBottom = "10px";
    
    div.innerHTML = `
        <select class="ing-type" style="flex:1">
            <option value="Top" ${data.type === 'Top' ? 'selected' : ''}>Top</option>
            <option value="Heart" ${data.type === 'Heart' ? 'selected' : ''}>Heart</option>
            <option value="Base" ${data.type === 'Base' ? 'selected' : ''}>Base</option>
        </select>
        <input type="text" placeholder="Material" class="ing-name" value="${data.name}" required style="flex:2">
        <input type="number" step="0.01" placeholder="mL" class="ing-ml" value="${data.ml}" required style="flex:1">
        <select class="ing-cat" style="flex:1.5">
            ${ACCORDS.map(a => `<option value="${a.val}" ${data.category === a.val ? 'selected' : ''}>${a.icon} ${a.val}</option>`).join('')}
        </select>
        <button type="button" class="remove-row" style="background:#ef4444; color:white; border:none; border-radius:8px; padding:0 10px;">✕</button>
    `;
    div.querySelector('.remove-row').onclick = () => div.remove();
    container.appendChild(div);
}

function resetForm() {
    editModeId = null;
    const form = document.getElementById('formula-form');
    if(form) form.reset();
    const container = document.getElementById('ingredient-rows-container');
    if(container) {
        container.innerHTML = '';
        createRow(); 
    }
}

// --- Saving Logic ---
document.getElementById('formula-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Please sign in first!");

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
        author: auth.currentUser.displayName,
        public: document.getElementById('public-checkbox').checked,
        updatedAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "formulas"), { ...formulaData, createdAt: serverTimestamp() });
        alert("Formula Saved to Lab!");
        setActivePage('my');
    } catch (err) {
        alert("Error saving: " + err.message);
    }
};

// --- Startup & Listeners ---
onAuthStateChanged(auth, user => {
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    setActivePage('home');
});

document.getElementById('add-row-btn').onclick = () => createRow();
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
document.getElementById('sign-in-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('sign-out-btn').onclick = () => signOut(auth);

// Initialize first row
createRow();
