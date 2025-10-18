document.addEventListener('DOMContentLoaded', () => {
    const FORMULAS_STORAGE_KEY = 'perfumeFormulas';
    const form = document.getElementById('formula-form');
    const formulaList = document.getElementById('formula-list');
    const errorMessage = document.getElementById('error-message');
    
    // Get the button/ID elements
    const saveButton = document.getElementById('save-formula-button');
    const updateButton = document.getElementById('update-formula-button');
    const cancelButton = document.getElementById('cancel-edit-button');
    const formulaIdToEdit = document.getElementById('formula-id-to-edit');
    const concentrationFilter = document.getElementById('concentration-filter');
    
    // Get calculator elements
    const oilVolumeInput = document.getElementById('oil-volume');
    const carrierVolumeInput = document.getElementById('carrier-volume');
    const calculateButton = document.getElementById('calculate-concentration-btn');
    const resultDisplay = document.getElementById('concentration-result');
    
    // NEW: Page Navigation Elements
    const navButtons = document.querySelectorAll('.nav-button');
    const pageTracker = document.getElementById('page-tracker');
    const pageSettings = document.getElementById('page-settings');

    // NEW: Material Image Placeholder Data (for future use)
    const MATERIAL_IMAGES = { /* ... (your material image data remains here) */ };


    // --- NEW: PAGE ROUTING LOGIC ---

    const navigateTo = (pageId) => {
        // Hide all pages
        pageTracker.style.display = 'none';
        pageSettings.style.display = 'none';

        // Show the selected page
        document.getElementById(`page-${pageId}`).style.display = 'block';
        
        // Update button styles
        navButtons.forEach(btn => {
            if (btn.dataset.page === pageId) {
                btn.style.fontWeight = 'bold';
                btn.style.textDecoration = 'underline';
            } else {
                btn.style.fontWeight = 'normal';
                btn.style.textDecoration = 'none';
            }
        });

        // If navigating to the tracker page, render the list
        if (pageId === 'tracker') {
            renderAllFormulas();
        }
    };


    // --- Utility Functions ---

    const loadFormulas = () => {
        // ... (No change)
        try {
            const jsonString = localStorage.getItem(FORMULAS_STORAGE_KEY);
            return jsonString ? JSON.parse(jsonString) : [];
        } catch (e) {
            console.error("Error loading formulas from storage:", e);
            errorMessage.textContent = "Error loading data. Local storage may be corrupted.";
            errorMessage.style.display = 'block';
            return [];
        }
    };

    const saveFormulas = (formulas) => {
        // ... (No change)
        try {
            localStorage.setItem(FORMULAS_STORAGE_KEY, JSON.stringify(formulas));
            errorMessage.style.display = 'none';
        } catch (e) {
            console.error("Error saving formulas to storage:", e);
            errorMessage.textContent = "Error saving data. Storage limit reached or access denied.";
            errorMessage.style.display = 'block';
        }
    };
    
    const parseNotes = (noteString) => {
        // ... (No change)
        if (!noteString || noteString.trim() === "") {
            return [];
        }
        return noteString.split(',').map(note => note.trim()).filter(note => note.length > 0);
    };

    const joinNotes = (notesArray) => {
        // ... (No change)
        return Array.isArray(notesArray) ? notesArray.join(', ') : '';
    }
    
    const deleteFormula = (idToDelete) => {
        // ... (No change)
        if (!confirm("Are you sure you want to delete this formula? This action cannot be undone.")) {
            return;
        }

        let formulas = loadFormulas();
        
        formulas = formulas.filter(f => f.id !== idToDelete);
        
        saveFormulas(formulas);
        renderAllFormulas();
        if (parseInt(formulaIdToEdit.value) === idToDelete) {
            cancelEditMode();
        }
    };

    // --- CALCULATOR LOGIC (No change) ---
    const calculateConcentration = () => {
        // ... (Function content remains the same)
        const oilVol = parseFloat(oilVolumeInput.value);
        const carrierVol = parseFloat(carrierVolumeInput.value);
        // ... (rest of function)
        if (isNaN(oilVol) || isNaN(carrierVol) || oilVol < 0 || carrierVol < 0) {
            resultDisplay.textContent = "Error: Please enter valid non-negative numbers.";
            return;
        }
        
        const totalVolume = oilVol + carrierVol;
        
        if (totalVolume === 0) {
            resultDisplay.textContent = "Total Volume cannot be zero.";
            return;
        }

        const percentage = ((oilVol / totalVolume) * 100).toFixed(2);
        
        let classification = '';
        if (percentage >= 20) {
            classification = 'Extrait de Parfum (20% - 40%)';
        } else if (percentage >= 15) {
            classification = 'Eau de Parfum (EDP) (15% - 20%)';
        } else if (percentage >= 10) {
            classification = 'Eau de Toilette (EDT) (10% - 15%)';
        } else if (percentage >= 5) {
            classification = 'Eau de Cologne (EDC) (5% - 10%)';
        } else {
            classification = 'Low Concentration Scent';
        }

        resultDisplay.innerHTML = `Concentration: <span style="color: #4CAF50;">${percentage}%</span> (Approx. ${classification})`;
    };
    

    // --- EDITING LOGIC (No change) ---
    const startEditMode = (formula) => { /* ... (Content remains the same) */ };
    const cancelEditMode = () => { /* ... (Content remains the same) */ };
    const handleUpdate = (event) => { /* ... (Content remains the same) */ };


    // --- RENDERING FUNCTIONS (No change) ---
    // Note: Image hover functions are stripped out to align with your last request to skip them.
    const createFormulaCard = (formula) => {
        const card = document.createElement('div');
        card.className = 'formula-card';
        card.innerHTML = `
            <h3>${formula.name || 'Untitled Formula'} (${formula.launch_year || 'N/A'})</h3>
            <p><strong>Type:</strong> ${formula.concentration || 'N/A'} &bull; <strong>Gender:</strong> ${formula.gender || 'N/A'}</p>
            <p><strong>Sillage:</strong> ${formula.sillage || 'N/A'} &bull; <strong>Longevity:</strong> ${formula.longevity || 'N/A'}</p>
            
            <div class="note-category">Olfactive Pyramid:</div>
            ${renderNotesList('Top', formula.top_notes)}
            ${renderNotesList('Heart', formula.middle_notes)}
            ${renderNotesList('Base', formula.base_notes)}

            <div class="note-category">Review:</div>
            <p>${formula.personal_review ? formula.personal_review.substring(0, 150) + (formula.personal_review.length > 150 ? '...' : '') : 'No review notes.'}</p>
            
            <button class="edit-btn" data-id="${formula.id}">Edit Formula</button>
            <button class="delete-btn" data-id="${formula.id}">Delete</button>
        `;
        
        const formulaId = formula.id;

        card.querySelector('.edit-btn').addEventListener('click', () => {
            startEditMode(formula);
        });
        
        card.querySelector('.delete-btn').addEventListener('click', () => {
            deleteFormula(formulaId);
        });

        return card;
    };

    const renderNotesList = (title, notes) => {
        if (!notes || notes.length === 0) {
            return `<p style="margin: 0 0 5px 0;"><strong>${title}:</strong> None listed</p>`;
        }
        const noteItems = notes.map(note => `<li>${note}</li>`).join('');
        return `
            <p style="margin: 5px 0 0 0;"><strong>${title}:</strong></p>
            <ul class="note-list">${noteItems}</ul>
        `;
    };

    const renderAllFormulas = () => {
        const allFormulas = loadFormulas();
        formulaList.innerHTML = ''; 
        
        const filterValue = concentrationFilter.value;

        const filteredFormulas = allFormulas.filter(formula => {
            if (filterValue === 'all') {
                return true;
            }
            return formula.concentration === filterValue;
        });
        
        if (allFormulas.length === 0) {
            formulaList.innerHTML = '<p>No saved formulas yet. Use the form above to add one!</p>';
        } else if (filteredFormulas.length === 0) {
            formulaList.innerHTML = `<p>No formulas found for Concentration: <strong>${filterValue}</strong>.</p>`;
        } else {
            filteredFormulas.forEach(formula => {
                formulaList.appendChild(createFormulaCard(formula));
            });
        }
    };


    // --- EVENT HANDLERS ---

    // Form submission (No change)
    form.addEventListener('submit', (event) => { /* ... (Content remains the same) */ });

    // Buttons and Filter (No change)
    updateButton.addEventListener('click', handleUpdate);
    cancelButton.addEventListener('click', cancelEditMode);
    concentrationFilter.addEventListener('change', renderAllFormulas);
    calculateButton.addEventListener('click', calculateConcentration);

    // NEW: Navigation Event Listeners
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.page);
        });
    });


    // Initial setup: Navigate to the default page and render formulas
    navigateTo('tracker'); 
});
