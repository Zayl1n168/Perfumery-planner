document.addEventListener('DOMContentLoaded', () => {
    const FORMULAS_STORAGE_KEY = 'perfumeFormulas';
    const form = document.getElementById('formula-form');
    const formulaList = document.getElementById('formula-list');
    const errorMessage = document.getElementById('error-message');

    // --- Utility Functions ---

    // Function to load formulas from localStorage
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

    // Function to save formulas to localStorage
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
    
    // Function to safely split a comma-separated string into an array of trimmed strings
    const parseNotes = (noteString) => {
        if (!noteString || noteString.trim() === "") {
            return [];
        }
        // Splits by comma, trims whitespace, and filters out any empty strings
        return noteString.split(',').map(note => note.trim()).filter(note => note.length > 0);
    };

    // --- Rendering Functions ---

    // Function to create the HTML for a single formula card
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
        `;
        return card;
    };

    // Helper function to render an array of notes as a list
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

    // Function to render all formulas
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

    // --- Event Handlers ---

    form.addEventListener('submit', (event) => {
        event.preventDefault(); // Stop the form from submitting normally

        // Collect data from the form
        const newFormula = {
            id: Date.now(), 
            name: document.getElementById('name').value.trim(),
            launch_year: document.getElementById('launch_year').value,
            concentration: document.getElementById('concentration').value,
            sillage: document.getElementById('sillage').value,
            longevity: document.getElementById('longevity').value,
            gender: document.getElementById('gender').value,
            
            // Parse comma-separated notes into arrays
            top_notes: parseNotes(document.getElementById('top_notes').value),
            middle_notes: parseNotes(document.getElementById('middle_notes').value),
            base_notes: parseNotes(document.getElementById('base_notes').value),
            
            personal_review: document.getElementById('personal_review').value.trim(),
        };

        // Basic validation
        if (!newFormula.name) {
            errorMessage.textContent = "Perfume Name is required.";
            errorMessage.style.display = 'block';
            return;
        }

        // Load existing formulas, add the new one, and save
        const formulas = loadFormulas();
        formulas.push(newFormula);
        saveFormulas(formulas);

        // Re-render the list and reset the form
        renderAllFormulas();
        form.reset();
    });

    // Initial load when the page is ready
    renderAllFormulas();
});
