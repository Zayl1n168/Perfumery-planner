/* script.js — Firebase Modular (v9+) Version for Perfume Formula Tracker */

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

// --- Firebase Config (your actual credentials)
const firebaseConfig = {
  apiKey: "AIzaSyAe2qcNrIGYBh8VW_rp8ASRi1G6tkqUZMA",
  authDomain: "perfumery-planner.firebaseapp.com",
  projectId: "perfumery-planner",
  storageBucket: "perfumery-planner.firebasestorage.app",
  messagingSenderId: "117069368025",
  appId: "1:117069368025:web:97d3d5398c082946284cc8",
  measurementId: "G-94L63VLGMJ"
};

// --- Initialize Firebase + Firestore
const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  // ==== All your UI logic remains identical ====
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

  // --- Dark Mode ---
  const applyDarkMode = (isEnabled) => {
    document.body.classList.toggle('dark-mode', isEnabled);
  };
  const loadDarkModePreference = () => {
    const isEnabled = localStorage.getItem(DARK_MODE_KEY) === 'true';
    darkModeToggle.checked = isEnabled;
    applyDarkMode(isEnabled);
  };
  darkModeToggle.addEventListener('change', () => {
    const isEnabled = darkModeToggle.checked;
    localStorage.setItem(DARK_MODE_KEY, isEnabled);
    applyDarkMode(isEnabled);
  });
  loadDarkModePreference();

  // --- Navigation ---
  const navigateTo = (pageId) => {
    pageTracker.style.display = 'none';
    pageSettings.style.display = 'none';
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.style.display = 'block';

    navButtons.forEach(btn => {
      btn.classList.toggle('active-nav', btn.dataset.page === pageId);
      btn.style.fontWeight = btn.dataset.page === pageId ? 'bold' : 'normal';
    });

    if (pageId === 'tracker') renderAllFormulas();
    else if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  };
  navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));

  // --- Utilities ---
  const parseNotes = (n) => !n ? [] : n.split(',').map(x => x.trim()).filter(Boolean);
  const joinNotes = (a) => Array.isArray(a) ? a.join(', ') : '';
  const showError = (msg, sec = 4) => {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
    setTimeout(() => errorMessage.style.display = 'none', sec * 1000);
  };
  const escapeHtml = (unsafe) => (typeof unsafe !== 'string') ? '' : unsafe
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  // --- Concentration Calc ---
  calculateButton.addEventListener('click', () => {
    const oil = parseFloat(oilVolumeInput.value);
    const carrier = parseFloat(carrierVolumeInput.value);
    if (isNaN(oil) || isNaN(carrier) || oil < 0 || carrier < 0)
      return resultDisplay.textContent = 'Enter valid numbers.';
    const total = oil + carrier;
    if (total === 0) return resultDisplay.textContent = 'Total volume cannot be 0.';
    const conc = (oil / total) * 100;
    resultDisplay.textContent = `Concentration: ${conc.toFixed(2)}% Oil (v/v)`;
  });

  // --- Firestore CRUD ---
  const createFormula = async (payload) => {
    try {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "formulas"), payload);
    } catch (err) {
      console.error(err);
      showError('Failed to save formula.');
    }
  };
  const updateFormulaInDb = async (id, payload) => {
    try {
      payload.updatedAt = serverTimestamp();
      await updateDoc(doc(db, "formulas", id), payload);
    } catch (err) {
      console.error(err);
      showError('Failed to update formula.');
    }
  };
  const deleteFormula = async (id) => {
    if (!confirm('Delete this formula permanently?')) return;
    try {
      await deleteDoc(doc(db, "formulas", id));
    } catch (err) {
      console.error(err);
      showError('Failed to delete formula.');
    }
  };

  // --- Rendering ---
  const renderNotesList = (title, notes) => {
    if (!notes?.length) return '';
    return `<div class="note-category">${escapeHtml(title)}</div>
      <ul class="note-list">${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`;
  };

  const createFormulaCard = (formula) => {
    const card = document.createElement('div');
    card.className = 'formula-card';
    card.innerHTML = `
      <h3>${escapeHtml(formula.name || 'Unnamed')}
        ${formula.launch_year ? `<small style="font-size:0.7em;color:#777;">(${escapeHtml(String(formula.launch_year))})</small>` : ''}
      </h3>
      <p><strong>Concentration:</strong> ${escapeHtml(formula.concentration || '—')}
        ${formula.scent_family ? `<span class="scent-tag">${escapeHtml(formula.scent_family)}</span>` : ''}
        <br><strong>Sillage:</strong> ${escapeHtml(formula.sillage || '—')}
      </p>
      <p><strong>Longevity:</strong> ${escapeHtml(formula.longevity || '—')}
        • <strong>Gender:</strong> ${escapeHtml(formula.gender || '—')}</p>
      ${renderNotesList('Top Notes', formula.top_notes || [])}
      ${renderNotesList('Middle Notes', formula.middle_notes || [])}
      ${renderNotesList('Base Notes', formula.base_notes || [])}
      ${formula.personal_review ? `<p><em>${escapeHtml(formula.personal_review)}</em></p>` : ''}
    `;
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '14px';
    const eBtn = document.createElement('button');
    eBtn.textContent = 'Edit';
    eBtn.className = 'edit-btn';
    eBtn.addEventListener('click', () => startEditMode(formula));
    const dBtn = document.createElement('button');
    dBtn.textContent = 'Delete';
    dBtn.className = 'delete-btn';
    dBtn.addEventListener('click', () => deleteFormula(formula.id));
    btnWrap.append(eBtn, dBtn);
    card.appendChild(btnWrap);
    return card;
  };

  const renderAllFormulas = () => {
    const filterValue = concentrationFilter.value || 'all';
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    formulaList.innerHTML = '<p>Loading formulas...</p>';
    const q = query(collection(db, "formulas"), orderBy("createdAt", "desc"));
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        top_notes: Array.isArray(d.data().top_notes) ? d.data().top_notes : parseNotes(d.data().top_notes),
        middle_notes: Array.isArray(d.data().middle_notes) ? d.data().middle_notes : parseNotes(d.data().middle_notes),
        base_notes: Array.isArray(d.data().base_notes) ? d.data().base_notes : parseNotes(d.data().base_notes)
      }));

      formulaList.innerHTML = '';
      const filtered = filterValue === 'all' ? all : all.filter(f => f.concentration === filterValue);
      if (!filtered.length) {
        formulaList.innerHTML = '<p>No formulas found.</p>';
        return;
      }
      filtered.forEach(f => formulaList.appendChild(createFormulaCard(f)));
    }, err => {
      console.error(err);
      formulaList.innerHTML = '<p style="color:red;">Error loading formulas.</p>';
    });
  };

  // --- Edit / Update ---
  const startEditMode = (f) => {
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
    updateButton.style.display = 'block';
    cancelButton.style.display = 'block';
  };
  const cancelEditMode = () => {
    form.reset();
    formulaIdToEdit.value = '';
    saveButton.style.display = 'block';
    updateButton.style.display = 'none';
    cancelButton.style.display = 'none';
  };
  cancelButton.addEventListener('click', cancelEditMode);

  const validateForm = () => {
    const name = document.getElementById('name').value.trim();
    if (!name) return showError('Please give your formula a name.'), false;
    const top = parseNotes(document.getElementById('top_notes').value);
    const mid = parseNotes(document.getElementById('middle_notes').value);
    const base = parseNotes(document.getElementById('base_notes').value);
    if (top.length + mid.length + base.length === 0)
      return showError('Please add at least one note.'), false;
    return true;
  };

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    if (formulaIdToEdit.value) return showError('Edit mode active.');
    if (!validateForm()) return;

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

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    await createFormula(payload);
    saveButton.disabled = false;
    saveButton.textContent = 'Save New Formula';
    form.reset();
  });

  updateButton.addEventListener('click', async () => {
    const id = formulaIdToEdit.value;
    if (!id) return showError('No formula selected.');
    if (!validateForm()) return;

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

    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    await updateFormulaInDb(id, payload);
    updateButton.disabled = false;
    updateButton.textContent = 'Update Formula';
    cancelEditMode();
  });

  concentrationFilter.addEventListener('change', renderAllFormulas);
  navigateTo('tracker');
  window.addEventListener('beforeunload', () => unsubscribeSnapshot?.());
});
