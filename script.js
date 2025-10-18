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


    // --- Utility Functions ---

    const loadFormulas = () => {
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
        if (!noteString || noteString.trim() === "") {
            return [];
        }
        return noteString.split(',').map(note => note.trim()).filter(note => note.length > 0);
    };

    const joinNotes = (notesArray) => {
        return Array.isArray(notesArray) ? notesArray.join(', ') : '';
    }
    
    // --- DELETE LOGIC (NEW) ---
    
    const deleteFormula = (idToDelete) => {
        if (!confirm("Are you sure you want to delete this formula? This action cannot be undone.")) {
            return;
        }

        let formulas = loadFormulas();
        
        // Filter out the formula with the matching ID
        formulas = formulas.filter(f => f.id !== idToDelete);
        
        saveFormulas(formulas);
        renderAllFormulas();
        // If the user was editing the deleted formula, cancel edit mode
        if (parseInt(formulaIdToEdit.value) === idToDelete) {
            cancelEditMode();
        }
    };


    // --- CALCULATOR LOGIC ---
    
    const calculateConcentration = () => {
        const oilVol = parseFloat(oilVolumeInput.value);
        const carrierVol = parseFloat(carrierVolumeInput.value);
        
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
    

    // --- EDITING LOGIC ---

    const startEditMode = (formula) => {
        document.getElementById('name').value = formula.name || '';
        document.getElementById('launch_year').value = formula.launch_year || '';
        document.getElementById('concentration').value = formula.concentration || '';
        document.getElementById('sillage').value = formula.sillage || '';
        document.getElementById('longevity').value = formula.longevity || '';
        document.getElementById('gender').value = formula.gender || '';
        document.getElementById('top_notes').value = joinNotes(formula.top_notes);
        document.getElementById('middle_notes').value = joinNotes(formula.middle_notes);
        document.getElementById('base_notes').value = joinNotes(formula.base_notes);
        document.getElementById('personal_review').value = formula.personal_review || '';

        formulaIdToEdit.value = formula.id;

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

    const handleUpdate = (event) => {
        event.preventDefault();
        
        const formulaId = parseInt(formulaIdToEdit.value);
        if (!formulaId) return;

        const formulas = loadFormulas();
        const indexToUpdate = formulas.findIndex(f => f.id === formulaId);

        if (indexToUpdate !== -1) {
            const updatedFormula = {
                id: formulaId,
                name: document.getElementById('name').value.trim(),
                launch_year: document.getElementById('launch_year').value,
                concentration: document.getElementById('concentration').value,
                sillage: document.getElementById('sillage').value,
                longevity: document.getElementById('longevity').value,
                gender: document.getElementById('gender').value,
                top_notes: parseNotes(document.getElementById('top_notes').value),
                middle_notes: parseNotes(document.getElementById('middle_notes').value),
                base_notes: parseNotes(document.getElementById('base_notes').value),
                personal_review: document.getElementById('personal_review').value.trim(),
            };
            
            formulas[indexToUpdate] = updatedFormula;
            saveFormulas(formulas);
            renderAllFormulas();
            cancelEditMode();
        }
    };


    // --- RENDERING FUNCTIONS (MODIFIED for Delete Button) ---

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

        // Add event listener for the Edit button
        card.querySelector('.edit-btn').addEventListener('click', () => {
            startEditMode(formula);
        });
        
        // Add event listener for the NEW Delete button
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

    form.addEventListener('submit', (event) => {
        event.preventDefault(); 
        
        if (formulaIdToEdit.value) {
            handleUpdate(event); 
            return;
        }

        // NEW SAVE mode
        const newFormula = {
            id: Date.now(), 
            name: document.getElementById('name').value.trim(),
            // ... (rest of the fields are collected as before)
            launch_year: document.getElementById('launch_year').value,
            concentration: document.getElementById('concentration').value,
            sillage: document.getElementById('sillage').value,
            longevity: document.getElementById('longevity').value,
            gender: document.getElementById('gender').value,
            top_notes: parseNotes(document.getElementById('top_notes').value),
            middle_notes: parseNotes(document.getElementById('middle_notes').value),
            base_notes: parseNotes(document.getElementById('base_notes').value),
            personal_review: document.getElementById('personal_review').value.trim(),
        };

        if (!newFormula.name) {
            errorMessage.textContent = "Perfume Name is required.";
            errorMessage.style.display = 'block';
            return;
        }

        const formulas = loadFormulas();
        formulas.push(newFormula);
        saveFormulas(formulas);
        renderAllFormulas();
        form.reset();
    });

    updateButton.addEventListener('click', handleUpdate);
    cancelButton.addEventListener('click', cancelEditMode);
    concentrationFilter.addEventListener('change', renderAllFormulas);
    calculateButton.addEventListener('click', calculateConcentration);

    // Initial load when the page is ready
    renderAllFormulas();
});
