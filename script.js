/* script.js — Modular Firebase + UI logic for the redesigned tracker
   - This is a module file. Include in index.html as: <script type="module" src="script.js"></script>
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

/* ---------- Firebase config (your credentials) ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8",
  measurementId: "G-94L63VLGMJ"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);

/* ---------- UI wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
  const form = document.getElementById('formula-form');
  const formulaList = document.getElementById('formula-list');
  const errorMessage = document.getElementById('error-message');
  const saveButton = document.getElementById('save-formula-button');
  const updateButton = document.getElementById('update-formula-button');
  const cancelButton = document.getElementById('cancel-edit-button');
  const formulaIdToEdit = document.getElementById('formula-id-to-edit');
  const concentrationFilter = document.getElementById('concentration-filter');
  const oilVolumeInput = document.getElementById('oil-volume');
  const carrierVolumeInput = document.getElementById('carrier-volume');
  const calculateButton = document.getElementById('calculate-concentration-btn');
  const resultDisplay = document.getElementById('concentration-result');
  const navButtons = document.querySelectorAll('.nav-button');
  const pageTracker = document.getElementById('page-tracker');
  const pageSettings = document.getElementById('page-settings');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const scentFamilyInput = document.getElementById('scent_family');

  const DARK_MODE_KEY = 'darkModeEnabled';
  let unsubscribeSnapshot = null;

  /* ------ Dark Mode handling ------ */
  const applyDarkMode = (enable) => document.body.classList.toggle('dark-mode', enable);
  darkModeToggle.checked = localStorage.getItem(DARK_MODE_KEY) === 'true';
  applyDarkMode(darkModeToggle.checked);
  darkModeToggle.addEventListener('change', () => {
    localStorage.setItem(DARK_MODE_KEY, darkModeToggle.checked);
    applyDarkMode(darkModeToggle.checked);
  });

  /* ------ Navigation ------ */
  const navigateTo = (pageId) => {
    pageTracker.style.display = pageId === 'tracker' ? 'block' : 'none';
    pageSettings.style.display = pageId === 'settings' ? 'block' : 'none';
    navButtons.forEach(b => b.classList.toggle('active-nav', b.dataset.page === pageId));
    if (pageId === 'tracker') renderAllFormulas();
    else if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  };
  navButtons.forEach(b => b.addEventListener('click', () => navigateTo(b.dataset.page)));

  /* ------ Utilities ------ */
  const parseNotes = (s) => !s ? [] : s.split(',').map(x=>x.trim()).filter(Boolean);
  const joinNotes = (arr) => Array.isArray(arr) ? arr.join(', ') : '';
  const esc = (t) => typeof t === 'string' ? t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

  const showError = (msg, t=3500) => {
    errorMessage.textContent = msg; errorMessage.style.display = 'block';
    setTimeout(()=>errorMessage.style.display='none', t);
  };

  /* ------ Concentration calculator ------ */
  calculateButton.addEventListener('click', () => {
    const oil = parseFloat(oilVolumeInput.value), carrier = parseFloat(carrierVolumeInput.value);
    if (isNaN(oil) || isNaN(carrier) || oil < 0 || carrier < 0) return resultDisplay.textContent = 'Enter valid numbers';
    const tot = oil + carrier;
    if (tot === 0) return resultDisplay.textContent = 'Total cannot be zero';
    resultDisplay.textContent = `Concentration: ${((oil/tot)*100).toFixed(2)}%`;
  });

  /* ------ Firestore CRUD (modular) ------ */
  async function createFormula(payload){
    try { payload.createdAt = serverTimestamp(); await addDoc(collection(db,'formulas'), payload); }
    catch(e){ console.error(e); showError('Save failed'); }
  }
  async function updateFormulaInDb(id,payload){
    try{ payload.updatedAt = serverTimestamp(); await updateDoc(doc(db,'formulas',id), payload); }
    catch(e){ console.error(e); showError('Update failed'); }
  }
  async function deleteFormulaById(id){
    if(!confirm('Delete this formula permanently?')) return;
    try{ await deleteDoc(doc(db,'formulas',id)); } catch(e){ console.error(e); showError('Delete failed'); }
  }

  /* ------ Scent family -> css class mapping ------ */
  const familyClass = (family) => {
    if(!family) return 'scent-tag';
    const f = family.toLowerCase();
    if(f.includes('floral')) return 'scent-tag floral';
    if(f.includes('wood')) return 'scent-tag woody';
    if(f.includes('citr')) return 'scent-tag citrus';
    if(f.includes('gourm')) return 'scent-tag gourmand';
    if(f.includes('orient') || f.includes('amber')) return 'scent-tag oriental';
    if(f.includes('arom')) return 'scent-tag aromatic';
    return 'scent-tag';
  };

  /* ------ Card HTML + pyramid handling ------ */
  function createCardHtml(formula){
    // placeholder image data URI or simple svg rectangle
    const thumb = `<div class="card-thumb"><img src="data:image/svg+xml;utf8,
      <svg xmlns='http://www.w3.org/2000/svg' width='200' height='280'>
      <rect rx='10' width='200' height='280' fill='%23161616'/>
      <text x='50%' y='50%' fill='%23bdbdbd' font-size='14' font-family='Arial' text-anchor='middle'>Bottle</text>
      </svg>" alt="thumb"></div>`;

    const top = formula.top_notes || [];
    const mid = formula.middle_notes || [];
    const base = formula.base_notes || [];

    const tags = formula.scent_family ? `<span class="${familyClass(formula.scent_family)}">${esc(formula.scent_family)}</span>` : '';

    // compact meta
    const meta = `<div class="meta"><strong>${esc(formula.concentration||'—')}</strong> · ${esc(formula.launch_year||'—')} · <span style="color:var(--muted)">${esc(formula.sillage||'—')}</span></div>`;

    // pyramid collapsed HTML (hidden by default)
    const pyramidHtml = `
      <div class="pyramid" data-id="${formula.id}">
        <div class="cat">Top Notes</div><ul>${top.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
        <div class="cat">Middle Notes</div><ul>${mid.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
        <div class="cat">Base Notes</div><ul>${base.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
      </div>`.replace(/\n/g,'');

    const review = formula.personal_review ? `<p style="margin-top:8px;color:var(--muted);font-size:0.92rem"><em>${esc(formula.personal_review)}</em></p>` : '';

    return `
      <div class="formula-card" data-id="${formula.id}">
        ${thumb}
        <div class="card-body">
          <div class="card-title">
            <h3>${esc(formula.name || 'Unnamed')}</h3>
            <div style="text-align:right">
              ${tags}
              ${meta}
            </div>
          </div>

          <div class="scent-tags">
            ${ (formula.top_notes||[]).slice(0,3).map(n=>`<div class="scent-pill">${esc(n)}</div>`).join('') }
          </div>

          <div class="note-actions">
            <button class="small-btn show-notes">Show Notes</button>
            <button class="small-btn edit-btn">Edit</button>
            <button class="small-btn delete-btn">Delete</button>
          </div>

          ${review}
          <div class="pyramid-wrap">
            <button class="pyramid-toggle">View Pyramid</button>
            ${pyramidHtml}
          </div>
        </div>
      </div>
    `;
  }

  /* ------ Render & realtime listener (with filter) ------ */
  function renderAllFormulas(){
    const filter = concentrationFilter.value || 'all';
    if(unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    formulaList.innerHTML = '<p class="muted">Loading formulas...</p>';

    const q = query(collection(db,'formulas'), orderBy('createdAt','desc'));
    unsubscribeSnapshot = onSnapshot(q, snapshot => {
      const arr = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          top_notes: Array.isArray(data.top_notes) ? data.top_notes : parseNotes(data.top_notes || ''),
          middle_notes: Array.isArray(data.middle_notes) ? data.middle_notes : parseNotes(data.middle_notes || ''),
          base_notes: Array.isArray(data.base_notes) ? data.base_notes : parseNotes(data.base_notes || '')
        };
      });

      const filtered = filter === 'all' ? arr : arr.filter(i=> i.concentration === filter);
      formulaList.innerHTML = filtered.length ? filtered.map(f => createCardHtml(f)).join('') : '<p class="muted">No formulas found.</p>';

      // attach per-card handlers (delegation alternative would be fine)
      document.querySelectorAll('.formula-card').forEach(card => {
        const id = card.dataset.id;
        const editBtn = card.querySelector('.edit-btn');
        const delBtn = card.querySelector('.delete-btn');
        const showNotesBtn = card.querySelector('.show-notes');
        const pyramidToggle = card.querySelector('.pyramid-toggle');
        const pyramid = card.querySelector('.pyramid');

        editBtn && editBtn.addEventListener('click', () => {
          // find the formula in filtered
          const formula = filtered.find(x => x.id === id);
          if(formula) startEditMode(formula);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        delBtn && delBtn.addEventListener('click', () => deleteFormulaById(id));

        showNotesBtn && showNotesBtn.addEventListener('click', () => {
          if(!pyramid) return;
          const visible = pyramid.style.display === 'block';
          pyramid.style.display = visible ? 'none' : 'block';
          if(!visible) pyramid.classList.add('pyramid-enter');
        });

        pyramidToggle && pyramidToggle.addEventListener('click', () => {
          if(!pyramid) return;
          const isOn = pyramid.style.display === 'block';
          pyramid.style.display = isOn ? 'none' : 'block';
          if(!isOn) pyramid.classList.add('pyramid-enter');
        });
      });

    }, err => {
      console.error(err);
      formulaList.innerHTML = '<p style="color:#ffaaaa">Error loading formulas.</p>';
    });
  }

  /* ------ Edit flow ------ */
  function startEditMode(f){
    document.getElementById('name').value = f.name || '';
    document.getElementById('launch_year').value = f.launch_year || '';
    document.getElementById('concentration').value = f.concentration || '';
    scentFamilyInput.value = f.scent_family || '';
    document.getElementById('sillage').value = f.sillage || '';
    document.getElementById('longevity').value = f.longevity || '';
    document.getElementById('gender').value = f.gender || '';
    document.getElementById('top_notes').value = joinNotes(f.top_notes || []);
    document.getElementById('middle_notes').value = joinNotes(f.middle_notes || []);
    document.getElementById('base_notes').value = joinNotes(f.base_notes || []);
    document.getElementById('personal_review').value = f.personal_review || '';
    formulaIdToEdit.value = f.id;
    saveButton.style.display = 'none';
    updateButton.style.display = 'inline-block';
    cancelButton.style.display = 'inline-block';
  }

  cancelButton.addEventListener('click', () => {
    form.reset(); formulaIdToEdit.value=''; saveButton.style.display='inline-block'; updateButton.style.display='none'; cancelButton.style.display='none';
  });

  const validateForm = () => {
    const name = document.getElementById('name').value.trim();
    if(!name){ showError('Please name the formula'); return false; }
    const t = parseNotes(document.getElementById('top_notes').value);
    const m = parseNotes(document.getElementById('middle_notes').value);
    const b = parseNotes(document.getElementById('base_notes').value);
    if(t.length + m.length + b.length === 0){ showError('Add at least one note'); return false; }
    return true;
  };

  /* ------ Form submit handlers ------ */
  form.addEventListener('submit', async (e)=> {
    e.preventDefault();
    if(formulaIdToEdit.value) return showError('In edit mode — update instead');
    if(!validateForm()) return;

    const payload = {
      name: document.getElementById('name').value.trim(),
      launch_year: document.getElementById('launch_year').value,
      concentration: document.getElementById('concentration').value,
      scent_family: scentFamilyInput.value,
      sillage: document.getElementById('sillage').value,
      longevity: document.getElementById('longevity').value,
      gender: document.getElementById('gender').value,
      top_notes: parseNotes(document.getElementById('top_notes').value),
      middle_notes: parseNotes(document.getElementById('middle_notes').value),
      base_notes: parseNotes(document.getElementById('base_notes').value),
      personal_review: document.getElementById('personal_review').value.trim()
    };

    saveButton.disabled = true; saveButton.textContent = 'Saving...';
    await createFormula(payload);
    saveButton.disabled = false; saveButton.textContent = 'Save New Formula';
    form.reset();
  });

  updateButton.addEventListener('click', async () => {
    const id = formulaIdToEdit.value;
    if(!id) return showError('No formula selected');
    if(!validateForm()) return;
    const payload = {
      name: document.getElementById('name').value.trim(),
      launch_year: document.getElementById('launch_year').value,
      concentration: document.getElementById('concentration').value,
      scent_family: scentFamilyInput.value,
      sillage: document.getElementById('sillage').value,
      longevity: document.getElementById('longevity').value,
      gender: document.getElementById('gender').value,
      top_notes: parseNotes(document.getElementById('top_notes').value),
      middle_notes: parseNotes(document.getElementById('middle_notes').value),
      base_notes: parseNotes(document.getElementById('base_notes').value),
      personal_review: document.getElementById('personal_review').value.trim()
    };
    updateButton.disabled = true; updateButton.textContent = 'Updating...';
    await updateFormulaInDb(id, payload);
    updateButton.disabled = false; updateButton.textContent = 'Update Formula';
    form.reset(); formulaIdToEdit.value=''; saveButton.style.display='inline-block'; updateButton.style.display='none'; cancelButton.style.display='none';
  });

  concentrationFilter.addEventListener('change', renderAllFormulas);

  // kick off
  navigateTo('tracker');
  window.addEventListener('beforeunload', ()=> unsubscribeSnapshot && unsubscribeSnapshot());
});
