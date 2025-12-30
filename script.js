import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
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

// --- Theme Management ---
const applyTheme = (isDark) => {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

// --- Navigation (Fixed for Stickiness) ---
window.setActivePage = (pageId) => {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const target = document.getElementById('page-' + pageId);
  if (target) target.style.display = 'block';
  
  // Close menu properly
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');

  if (pageId === 'home') loadFeed('home');
  if (pageId === 'my') {
    if (auth.currentUser) loadFeed('my');
    else alert("Please sign in to view your notebook!");
  }
};

// --- Loading Logic (Safety First) ---
async function loadFeed(type) {
  const container = document.getElementById(type === 'home' ? 'cards' : 'my-cards');
  if (!container) return;
  container.innerHTML = '<p style="padding:20px; text-align:center;">Scanning the lab...</p>';

  try {
    let q;
    if (type === 'home') {
       q = query(collection(db, "formulas"), where("public", "==", true));
    } else {
       q = query(collection(db, "formulas"), where("uid", "==", auth.currentUser.uid));
    }
    
    const snap = await getDocs(q);
    container.innerHTML = '';
    
    if (snap.empty) {
      container.innerHTML = '<p style="padding:20px; text-align:center;">No formulas found.</p>';
      return;
    }

    snap.forEach(doc => {
      const data = doc.data();
      container.insertAdjacentHTML('beforeend', `
        <div class="panel">
          <h3>${data.name || 'Untitled'}</h3>
          <p style="color:var(--muted)">${data.concentration || 'EDP'}</p>
        </div>
      `);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="padding:20px; color:red;">Connection error. Try refreshing.</p>`;
  }
}

// --- Auth State ---
onAuthStateChanged(auth, (user) => {
  const savedTheme = localStorage.getItem('prefTheme');
  applyTheme(savedTheme === 'dark');
  
  document.getElementById('sign-in-btn').style.display = user ? 'none' : 'block';
  document.getElementById('user-info').style.display = user ? 'flex' : 'none';
  if (user && document.getElementById('user-avatar')) {
    document.getElementById('user-avatar').src = user.photoURL;
  }
  
  setActivePage('home');
});

// --- UI Event Listeners ---
document.getElementById('menu-btn').onclick = () => {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('show');
};

document.getElementById('drawer-close').onclick = () => {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('show');
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
if(document.getElementById('theme-toggle')) {
    document.getElementById('theme-toggle').onchange = (e) => applyTheme(e.target.checked);
}
