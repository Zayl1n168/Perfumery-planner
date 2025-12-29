import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

/* ---------- Firebase Setup ---------- */
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

/* ---------- DOM Elements ---------- */
const pages = {
  home: document.getElementById('page-home'),
  my: document.getElementById('page-my'),
  create: document.getElementById('page-create'),
  settings: document.getElementById('page-settings')
};

const formulaForm = document.getElementById('formula-form');
const themeToggle = document.getElementById('theme-toggle');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const menuBtn = document.getElementById('menu-btn');

/* ---------- Navigation & Theme ---------- */
const applyTheme = (isDark) => {
  // Your CSS uses .dark, so we toggle that
  document.body.classList.toggle('dark', isDark);
  if (themeToggle) themeToggle.checked = isDark;
  localStorage.setItem('prefTheme', isDark ? 'dark' : 'light');
};

themeToggle?.addEventListener('change', () => applyTheme(themeToggle.checked));
applyTheme(localStorage.getItem('prefTheme') === 'dark');

function setActivePage(pageId) {
  Object.values(pages).forEach(p => { if(p) p.style.display = 'none'; });
  if (pages[pageId]) pages[pageId].style.display = 'block';
  
  if (pageId === 'home') loadPublicFeed();
  if (pageId === 'my') renderMyFormulas();
  
  drawer?.classList.remove('open');
  drawerOverlay?.classList.remove('show');
}

menuBtn?.addEventListener('click', () => {
  drawer?.classList.add('open');
  drawerOverlay?.classList.add('show');
});

document.getElementById('drawer-close')?.addEventListener('click', () => {
  drawer?.classList.remove('open');
  drawerOverlay?.classList.remove('show');
});

drawerOverlay?.addEventListener('click', () => {
  drawer?.classList.remove('open');
  drawerOverlay?.classList.remove('show');
});

document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => setActivePage(item.dataset.page));
});

/* ---------- Authentication ---------- */
let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const userInfo = document.getElementById('user-info');
  const signInBtn = document.getElementById('sign-in-btn');

  if (user) {
    if (signInBtn) signInBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-avatar').src = user.photoURL;
  } else {
    if (signInBtn) signInBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }
  loadPublicFeed();
});

document.getElementById('sign-in-btn')?.addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('sign-out-btn')?.addEventListener('click', () => signOut(auth));

/* ---------- Public Feed Logic ---------- */
async function loadPublicFeed() {
  const feedCards = document.getElementById('cards');
  if (!feedCards) return;
  feedCards.innerHTML = '<p class="muted">Scanning the fragrance library...</p>';

  try {
    const q = query(
      collection(db, "formulas"),
      where("public", "==", true),
      orderBy("createdAt", "desc"),
      limit(25)
    );

    const snap = await getDocs(q);
    feedCards.innerHTML = '';

    if (snap.empty) {
      feedCards.innerHTML = '<p class="muted">No public formulas yet.</p>';
      return;
    }

    snap.forEach((doc) => {
      const data = doc.data();
      feedCards.insertAdjacentHTML('beforeend', `
        <div class="card">
          <div class="card-header">
            <h3>${data.name}</h3>
            <span class="badge">${data.concentration}</span>
          </div>
          <p><strong>Top:</strong> ${data.top_notes?.join(', ') || 'N/A'}</p>
          <p><strong>Heart:</strong> ${data.middle_notes?.join(', ') || 'N/A'}</p>
          <p><strong>Base:</strong> ${data.base_notes?.join(', ') || 'N/A'}</p>
          <div class="card-footer" style="margin-top:10px; border-top: 1px solid var(--border); padding-top:5px;">
            <small>By ${data.author} • ${data.gender}</small>
          </div>
        </div>
      `);
    });
  } catch (err) {
    console.error(err);
    feedCards.innerHTML = '<p class="error">Unable to load feed.</p>';
  }
}

/* ---------- Create Formula Logic ---------- */
formulaForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Sign in first!");

  const cleanNotes = (id) => document.getElementById(id).value.split(',').map(n => n.trim()).filter(n => n !== "");

  const payload = {
    name: document.getElementById('name').value.trim(),
    concentration: document.getElementById('concentration').value,
    gender: document.getElementById('gender').value,
    top_notes: cleanNotes('top_notes'),
    middle_notes: cleanNotes('middle_notes'),
    base_notes: cleanNotes('base_notes'),
    uid: currentUser.uid,
    author: currentUser.displayName,
    public: document.getElementById('public-checkbox').checked,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "formulas"), payload);
    formulaForm.reset();
    alert("Formula Saved!");
    setActivePage('home');
  } catch (err) {
    alert("Save Error: " + err.message);
  }
});

/* ---------- My Formulas Logic ---------- */
async function renderMyFormulas() {
  const myCards = document.getElementById('my-cards');
  if (!myCards || !currentUser) return;
  myCards.innerHTML = '<p class="muted">Fetching your notebook...</p>';

  const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  myCards.innerHTML = '';
  
  if (snap.empty) {
      myCards.innerHTML = '<p class="muted">You haven\'t created any formulas yet.</p>';
      return;
  }

  snap.forEach(d => {
    const data = d.data();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <h3>${data.name}</h3>
        <p class="muted">${data.concentration} | ${data.public ? '🌍 Public' : '🔒 Private'}</p>
        <button class="btn danger small delete-btn" style="margin-top:10px;" data-id="${d.id}">Delete Formula</button>
    `;
    card.querySelector('.delete-btn').onclick = () => deleteFormula(d.id);
    myCards.appendChild(card);
  });
}

async function deleteFormula(id) {
    if(confirm("Are you sure you want to delete this formula forever?")) {
        try {
            await deleteDoc(doc(db, "formulas", id));
            renderMyFormulas();
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    }
}

/* ---------- Settings Logic ---------- */
document.getElementById('export-btn')?.addEventListener('click', async () => {
    if (!currentUser) return alert("Sign in to export your data!");
    
    try {
        const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fragrance_backup_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("Export failed: " + err.message);
    }
});

document.getElementById('delete-all-btn')?.addEventListener('click', async () => {
    if (!currentUser) return alert("Sign in first!");
    if (confirm("DANGER: This will delete ALL your formulas from our servers. This cannot be undone. Proceed?")) {
        try {
            const q = query(collection(db, "formulas"), where("uid", "==", currentUser.uid));
            const snap = await getDocs(q);
            const batch = snap.docs.map(d => deleteDoc(doc(db, "formulas", d.id)));
            await Promise.all(batch);
            alert("Lab records cleared.");
            setActivePage('home');
        } catch (err) {
            alert("Clear failed: " + err.message);
        }
    }
});

// Start on Home
setActivePage('home');
