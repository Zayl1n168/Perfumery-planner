document.addEventListener('DOMContentLoaded', () => {
    const FORMULAS_STORAGE_KEY = 'perfumeFormulas';
    const form = document.getElementById('formula-form');
    const formulaList = document.getElementById('formula-list');
    const errorMessage = document.getElementById('error-message');
    
    // Get the new buttons and hidden ID field
    const saveButton = document.getElementById('save-formula-button');
    const updateButton = document.getElementById('update-formula-button');
    const cancelButton = document.getElementById('cancel-edit-button');
    const formulaIdToEdit = document.getElementById('formula-id-to-edit');

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

    // Helper to join notes array back into a comma-separated string for the form
    const joinNotes = (notesArray) => {
        return Array.isArray(notesArray) ? notesArray.join(', ') : '';
    }

    // --- NEW EDITING LOGIC ---

    const startEditMode = (formula) => {
        // Populate the form fields with the formula data
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

        // Store the ID of the formula being edited
        formulaIdToEdit.value = formula.id;

        // Toggle buttons visibility
        saveButton.style.display = 'none';
        updateButton.style.display = 'block';
        cancelButton.style.display = 'block';
        
        // Scroll to the top of the form for easy editing
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
        if (!formulaId) return; // Should not happen if in edit mode

        const formulas = loadFormulas();
        const indexToUpdate = formulas.findIndex(f => f.id === formulaId);

        if (indexToUpdate !== -1) {
            // Create a new updated formula object
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
            
            // Replace the old formula with the new one
            formulas[indexToUpdate] = updatedFormula;
            saveFormulas(formulas);
            renderAllFormulas();
            cancelEditMode();
        }
    };


    // --- RENDERING FUNCTIONS (Updated) ---

    // Function to create the HTML for a single formula card (ADDED EDIT BUTTON)
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
        `;
        
        // Add event listener for the new Edit button
        card.querySelector('.edit-btn').addEventListener('click', () => {
            startEditMode(formula);
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
        const formulas = loadFormulas();
        formulaList.innerHTML = ''; // Clear existing list
        
        if (formulas.length === 0) {
            formulaList.innerHTML = '<p>No saved formulas yet. Use the form above to add one!</p>';
        } else {
            formulas.forEach(formula => {
                formulaList.appendChild(createFormulaCard(formula));
            });
        }
    };

    // --- EVENT HANDLERS (Modified) ---

    form.addEventListener('submit', (event) => {
        event.preventDefault(); 
        
        // Check if we are in EDIT mode (by checking the hidden ID)
        if (formulaIdToEdit.value) {
            // If the user clicks Save while in edit mode, treat it as an update
            handleUpdate(event); 
            return;
        }

        // We are in NEW SAVE mode
        const newFormula = {
            id: Date.now(), 
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

    // Handle the explicit Update and Cancel buttons
    updateButton.addEventListener('click', handleUpdate);
    cancelButton.addEventListener('click', cancelEditMode);

    // Initial load when the page is ready
    renderAllFormulas();
});
