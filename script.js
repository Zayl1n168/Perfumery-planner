import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

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

// --- Fix Dark Mode ---
const applyTheme = (isDark) => {
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

// --- Navigation ---
window.setActivePage = (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const target = document.getElementById('page-' + pageId);
    if (target) target.style.display = 'block';
    
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('show');

    if (pageId === 'home') loadFeed('home');
    if (pageId === 'my') loadFeed('my');
};

// --- Safety Load ---
async function loadFeed(type) {
    const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
    if (!container) return;
    container.innerHTML = 'Loading...';

    try {
        const q = query(collection(db, "formulas"));
        const snap = await getDocs(q);
        container.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            // Basic card for testing to ensure no blank screen
            container.insertAdjacentHTML('beforeend', `
                <div class="panel">
                    <h3>${data.name || 'Untitled'}</h3>
                    <p>${data.concentration || 'EDP'}</p>
                </div>
            `);
        });
    } catch (e) {
        container.innerHTML = 'Error loading formulas. Please sign in again.';
    }
}

// --- Startup ---
onAuthStateChanged(auth, user => {
    const savedTheme = localStorage.getItem('prefTheme');
    applyTheme(savedTheme === 'dark');
    
    document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
    document.getElementById('user-info').style.display = user ? 'flex' : 'none';
    
    setActivePage('home');
});

// UI Listeners
document.getElementById('menu-btn').onclick = () => {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('show');
};
