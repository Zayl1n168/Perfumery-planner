/* script.js
   Full Firebase-based implementation for Perfume Formula Tracker
   Assumes `db` (firebase.firestore()) is already initialized in index.html
*/

document.addEventListener('DOMContentLoaded', () => {
    // Global UI references
    const form = document.getElementById('formula-form');
    const formulaList = document.getElementById('formula-list');
    const errorMessage = document.getElementById('error-message');
    const saveButton = document.getElementById('save-formula-button');
    const updateButton = document.getElementById('update-formula-button');
    const cancelButton = document.getElementById('cancel-edit-button');
    const formulaIdToEdit = document.getElementById('formula-id-to-edit');
    const concentrationFilter = document.getElementById('concentration-filter');

    // Calculator elements
    const oilVolumeInput = document.getElementById('oil-volume');
    const carrierVolumeInput = document.getElementById('carrier-volume');
    const calculateButton = document.getElementById('calculate-concentration-btn');
    const resultDisplay = document.getElementById('concentration-result');

    // Page navigation
    const navButtons = document.querySelectorAll('.nav-button');
    const pageTracker = document.getElementById('page-tracker');
    const pageSettings = document.getElementById('page-settings');

    // Dark mode
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const DARK_MODE_KEY = 'darkModeEnabled';

    // Scent family input (form)
    const scentFamilyInput = document.getElementById('scent_family');

    // Firestore onSnapshot unsubscribe handle
    let unsubscribeSnapshot = null;

    // ---------- Dark Mode ----------
    const applyDarkMode = (isEnabled) => {
        if (isEnabled) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
    };

    const loadDarkModePreference = () => {
        const isEnabled = localStorage.getItem(DARK_MODE_KEY) === 'true';
        darkModeToggle.checked = isEnabled;
        applyDarkMode(isEnabled);
    };

    const handleDarkModeToggle = () => {
        const isEnabled = darkModeToggle.checked;
        localStorage.setItem(DARK_MODE_KEY, isEnabled);
        applyDarkMode(isEnabled);
    };

    darkModeToggle.addEventListener('change', handleDarkModeToggle);
    loadDarkModePreference();

    // ---------- Navigation ----------
    const navigateTo = (pageId) => {
        // Hide both pages, then show the requested one
        pageTracker.style.display = 'none';
        pageSettings.style.display = 'none';

        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.style.display = 'block';

        // Update nav button active state
        navButtons.forEach(btn => {
            if (btn.dataset.page === pageId) {
                btn.classList.add('active-nav');
                btn.style.fontWeight = 'bold';
            } else {
                btn.classList.remove('active-nav');
                btn.style.fontWeight = 'normal';
            }
        });

        // When going to tracker, (re)connect listener
        if (pageId === 'tracker') {
            renderAllFormulas();
        } else {
            // Unsubscribe if leaving tracker to avoid extra listeners
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        }
    };

    // wire nav buttons
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // ---------- Utilities ----------
    const parseNotes = (noteString) => {
        if (!noteString) return [];
        return noteString.split(',')
                         .map(n => n.trim())
                         .filter(n => n.length > 0);
    };

    const joinNotes = (notesArray) => {
        return Array.isArray(notesArray) ? notesArray.join(', ') : '';
    };

    const showError = (msg, seconds = 4) => {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, seconds * 1000);
    };

    // ---------- Concentration Calculator ----------
    const calculateConcentration = () => {
        const oilVolume = parseFloat(oilVolumeInput.value);
        const carrierVolume = parseFloat(carrierVolumeInput.value);

        if (isNaN(oilVolume) || isNaN(carrierVolume) || oilVolume < 0 || carrierVolume < 0) {
            resultDisplay.textContent = 'Please enter valid positive numbers for both volumes.';
            resultDisplay.style.color = '#cc0000';
            return;
        }

        const totalVolume = oilVolume + carrierVolume;
        if (totalVolume === 0) {
            resultDisplay.textContent = 'Total volume cannot be zero.';
            resultDisplay.style.color = '#cc0000';
            return;
        }

        const concentration = (oilVolume / totalVolume) * 100;
        resultDisplay.textContent = `Concentration: ${concentration.toFixed(2)}% Oil (v/v)`;
        resultDisplay.style.color = '#006600';
    };

    calculateButton.addEventListener('click', calculateConcentration);

    // ---------- Firestore CRUD & Rendering ----------

    // Safely create a formula document
    const createFormula = async (payload) => {
        try {
            // Add timestamps for reference
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('formulas').add(payload);
        } catch (err) {
            console.error('Create failed:', err);
            showError('Failed to save formula. See console for details.');
        }
    };

    // Safely update an existing formula
    const updateFormulaInDb = async (docId, payload) => {
        try {
            payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('formulas').doc(docId).update(payload);
        } catch (err) {
            console.error('Update failed:', err);
            showError('Failed to update formula. See console for details.');
        }
    };

    // Delete (already had but re-implemented to be safe)
    const deleteFormula = async (idToDelete) => {
        try {
            if (!confirm('Delete this formula permanently?')) return;
            await db.collection('formulas').doc(idToDelete).delete();
        } catch (error) {
            console.error('Error removing document: ', error);
            showError('Failed to delete formula. Check console for details.');
        }
    };

    // Build HTML for note lists (top/middle/base)
    const renderNotesList = (title, notes) => {
        if (!notes || notes.length === 0) return '';
        // render as category header + pill tags
        const noteItems = notes.map(n => `<li>${escapeHtml(n)}</li>`).join('');
        return `
            <div class="note-category">${escapeHtml(title)}</div>
            <ul class="note-list">${noteItems}</ul>
        `;
    };

    // Helper to escape basic HTML to avoid injection in titles/notes
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    // Create a formula card DOM node
    const createFormulaCard = (formula) => {
        const card = document.createElement('div');
        card.className = 'formula-card';

        // Title and metadata
        const title = document.createElement('h3');
        title.innerHTML = `${escapeHtml(formula.name || 'Unnamed')}` +
                          (formula.launch_year ? ` <small style="font-size:0.7em; color:#777;">(${escapeHtml(String(formula.launch_year))})</small>` : '');
        card.appendChild(title);

        // Row: concentration + scent family + sillage tag
        const metaP = document.createElement('p');
        metaP.innerHTML = `<strong>Concentration:</strong> ${escapeHtml(formula.concentration || '—')}` +
                          (formula.scent_family ? ` <span class="scent-tag">${escapeHtml(formula.scent_family)}</span>` : '') +
                          ` <br><strong>Sillage:</strong> ${escapeHtml(formula.sillage || '—')}`;
        card.appendChild(metaP);

        // Longevity & Gender
        const smallP = document.createElement('p');
        smallP.innerHTML = `<strong>Longevity:</strong> ${escapeHtml(formula.longevity || '—')} &nbsp; • &nbsp; <strong>Gender:</strong> ${escapeHtml(formula.gender || '—')}`;
        card.appendChild(smallP);

        // Notes sections
        card.insertAdjacentHTML('beforeend', renderNotesList('Top Notes', formula.top_notes || []));
        card.insertAdjacentHTML('beforeend', renderNotesList('Middle Notes', formula.middle_notes || []));
        card.insertAdjacentHTML('beforeend', renderNotesList('Base Notes', formula.base_notes || []));

        // Personal review
        if (formula.personal_review) {
            const reviewP = document.createElement('p');
            reviewP.style.marginTop = '12px';
            reviewP.innerHTML = `<em>${escapeHtml(formula.personal_review)}</em>`;
            card.appendChild(reviewP);
        }

        // Buttons (Edit / Delete)
        const btnWrap = document.createElement('div');
        btnWrap.style.marginTop = '14px';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.style.marginRight = '8px';
        editBtn.addEventListener('click', () => startEditMode(formula));

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => deleteFormula(formula.id));

        btnWrap.appendChild(editBtn);
        btnWrap.appendChild(delBtn);

        card.appendChild(btnWrap);
        return card;
    };

    // Render all formulas with filter; uses onSnapshot but avoids duplicate listeners
    const renderAllFormulas = () => {
        const filterValue = concentrationFilter.value || 'all';

        // Unsubscribe previous listener if present (prevents duplicates)
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }

        formulaList.innerHTML = '<p id="loading-status">Connecting to database and loading formulas...</p>';

        unsubscribeSnapshot = db.collection('formulas')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const allFormulas = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Normalize arrays if they are stored as strings accidentally
                    data.top_notes = Array.isArray(data.top_notes) ? data.top_notes : parseNotes(data.top_notes || '');
                    data.middle_notes = Array.isArray(data.middle_notes) ? data.middle_notes : parseNotes(data.middle_notes || '');
                    data.base_notes = Array.isArray(data.base_notes) ? data.base_notes : parseNotes(data.base_notes || '');
                    allFormulas.push({ ...data, id: doc.id });
                });

                formulaList.innerHTML = ''; // clear

                const filtered = allFormulas.filter(f => {
                    if (!filterValue || filterValue === 'all') return true;
                    return f.concentration === filterValue;
                });

                if (allFormulas.length === 0) {
                    formulaList.innerHTML = '<p id="loading-status">No saved formulas yet. Use the form above to add one!</p>';
                    return;
                }

                if (filtered.length === 0) {
                    formulaList.innerHTML = `<p id="loading-status">No formulas found for Concentration: <strong>${escapeHtml(filterValue)}</strong>.</p>`;
                    return;
                }

                // append cards
                filtered.forEach(formula => {
                    formulaList.appendChild(createFormulaCard(formula));
                });
            }, error => {
                console.error('Firestore data retrieval error:', error);
                formulaList.innerHTML = '<p style="color: red;">Error loading formulas. Check console for details.</p>';
            });
    };

    // ---------- Edit Mode ----------
    const startEditMode = (formula) => {
        // Populate form
        document.getElementById('name').value = formula.name || '';
        document.getElementById('launch_year').value = formula.launch_year || '';
        document.getElementById('concentration').value = formula.concentration || '';
        scentFamilyInput.value = formula.scent_family || '';
        document.getElementById('sillage').value = formula.sillage || '';
        document.getElementById('longevity').value = formula.longevity || '';
        document.getElementById('gender').value = formula.gender || '';
        document.getElementById('top_notes').value = joinNotes(formula.top_notes || []);
        document.getElementById('middle_notes').value = joinNotes(formula.middle_notes || []);
        document.getElementById('base_notes').value = joinNotes(formula.base_notes || []);
        document.getElementById('personal_review').value = formula.personal_review || '';

        formulaIdToEdit.value = formula.id;

        // Button toggles
        saveButton.style.display = 'none';
        updateButton.style.display = 'block';
        cancelButton.style.display = 'block';

        form.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelEditMode = () => {
        form.reset();
        formulaIdToEdit.value = '';
        saveButton.style.display = 'block';
        updateButton.style.display = 'none';
        cancelButton.style.display = 'none';
    };

    cancelButton.addEventListener('click', cancelEditMode);

    // ---------- Form Submit Handlers ----------
    const validateForm = () => {
        const name = document.getElementById('name').value.trim();
        if (!name) {
            showError('Please give your formula a name.');
            return false;
        }
        // optional: ensure at least one note exists
        const top = parseNotes(document.getElementById('top_notes').value);
        const mid = parseNotes(document.getElementById('middle_notes').value);
        const base = parseNotes(document.getElementById('base_notes').value);
        if (top.length + mid.length + base.length === 0) {
            showError('Please add at least one note (top, middle, or base).');
            return false;
        }
        return true;
    };

    // Save (create new) handler
    form.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        // If currently editing, don't create a new doc
        if (formulaIdToEdit.value) {
            showError('You are in edit mode — click Update or Cancel to proceed.');
            return;
        }
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

        // Basic optimistic UI feedback
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        await createFormula(payload);

        saveButton.disabled = false;
        saveButton.textContent = 'Save New Formula';
        form.reset();
    });

    // Update handler
    updateButton.addEventListener('click', async () => {
        const docId = formulaIdToEdit.value;
        if (!docId) {
            showError('No formula selected to update.');
            return;
        }
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

        await updateFormulaInDb(docId, payload);

        updateButton.disabled = false;
        updateButton.textContent = 'Update Formula';
        cancelEditMode();
    });

    // Concentration filter listener
    concentrationFilter.addEventListener('change', () => {
        // re-render using snapshot (we already subscribe to onSnapshot)
        renderAllFormulas();
    });

    // Initial page and data load
    navigateTo('tracker'); // default page
    // (renderAllFormulas is triggered by navigateTo)

    // Safety: when user closes or refreshes, unsubscribe to avoid leaks
    window.addEventListener('beforeunload', () => {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
    });
});
