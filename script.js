Document.addEventListener('DOMContentLoaded', () => {
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
    
    // Page Navigation Elements
    const navButtons = document.querySelectorAll('.nav-button'); 
    const pageTracker = document.getElementById('page-tracker');
    const pageSettings = document.getElementById('page-settings');
    
    // Dark Mode Elements and Key
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const DARK_MODE_KEY = 'darkModeEnabled';

    // NEW ELEMENT: Scent Family Input
    const scentFamilyInput = document.getElementById('scent_family'); 

    // --- DARK MODE LOGIC ---

    const applyDarkMode = (isEnabled) => {
        if (isEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
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


    // --- PAGE ROUTING LOGIC ---

    const navigateTo = (pageId) => {
        // Hide all pages
        pageTracker.style.display = 'none';
        pageSettings.style.display = 'none';

        // Show the selected page
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
             targetPage.style.display = 'block';
        }
       
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

        if (pageId === 'tracker') {
            renderAllFormulas();
        }
    };


    // --- Utility Functions (CRUD) ---

    const loadFormulas = () => {
        const json = localStorage.getItem(FORMULAS_STORAGE_KEY);
        return json ? JSON.parse(json) : [];
    };

    const saveFormulas = (formulas) => {
        localStorage.setItem(FORMULAS_STORAGE_KEY, JSON.stringify(formulas));
    };
    
    // Converts comma-separated string to clean array
    const parseNotes = (noteString) => {
        if (!noteString) return [];
        return noteString.split(',')
                         .map(note => note.trim())
                         .filter(note => note.length > 0);
    };

    // Converts array back to comma-separated string
    const joinNotes = (notesArray) => {
        return Array.isArray(notesArray) ? notesArray.join(', ') : '';
    };

    const deleteFormula = (idToDelete) => {
        let formulas = loadFormulas();
        formulas = formulas.filter(f => f.id !== idToDelete);
        saveFormulas(formulas);
        renderAllFormulas();
    };

    // --- Concentration Calculator ---

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

    // --- Edit Mode Handlers ---
    
    const startEditMode = (formula) => {
        // Populate form fields
        document.getElementById('name').value = formula.name;
        document.getElementById('launch_year').value = formula.launch_year;
        document.getElementById('concentration').value = formula.concentration;
        scentFamilyInput.value = formula.scent_family || ''; // UPDATED: Load Scent Family
        document.getElementById('sillage').value = formula.sillage;
        document.getElementById('longevity').value = formula.longevity;
        document.getElementById('gender').value = formula.gender;
        document.getElementById('top_notes').value = joinNotes(formula.top_notes);
        document.getElementById('middle_notes').value = joinNotes(formula.middle_notes);
        document.getElementById('base_notes').value = joinNotes(formula.base_notes);
        document.getElementById('personal_review').value = formula.personal_review;

        // Set ID for update
        formulaIdToEdit.value = formula.id;

        // Swap buttons
        saveButton.style.display = 'none';
        updateButton.style.display = 'block';
        cancelButton.style.display = 'block';
        
        document.getElementById('formula-form').scrollIntoView({ behavior: 'smooth' });
    };

    const cancelEditMode = () => {
        form.reset();
        formulaIdToEdit.value = '';

        // Swap buttons back
        saveButton.style.display = 'block';
        updateButton.style.display = 'none';
        cancelButton.style.display = 'none';
    };

    // --- Rendering ---

    const renderNotesList = (title, notes) => {
        if (!notes || notes.length === 0) return '';
        return `
            <p style="margin-top: 5px; margin-bottom: 2px;">
                <strong>${title}:</strong> ${notes.join(', ')}
            </p>
        `;
    };

    const createFormulaCard = (formula) => {
        const card = document.createElement('div');
        card.className = 'formula-card';
        card.dataset.id = formula.id;

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('h3');
        title.textContent = formula.name;
        header.appendChild(title);
        
        const buttonGroup = document.createElement('div');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => startEditMode(formula));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the formula: ${formula.name}?`)) {
                deleteFormula(formula.id);
            }
        });
        
        buttonGroup.appendChild(editBtn);
        buttonGroup.appendChild(deleteBtn);
        header.appendChild(buttonGroup);
        card.appendChild(header);

        // UPDATED: Display Scent Family Tag
        const familyInfo = document.createElement('p');
        familyInfo.innerHTML = `<strong>Family:</strong> <span class="scent-tag">${formula.scent_family || 'N/A'}</span>`;
        card.appendChild(familyInfo);
        // END UPDATE

        const details = document.createElement('div');
        details.innerHTML = `
            <p><strong>Year:</strong> ${formula.launch_year || 'N/A'}</p>
            <p><strong>Concentration:</strong> ${formula.concentration || 'N/A'}</p>
            <p><strong>Sillage:</strong> ${formula.sillage || 'N/A'}</p>
            <p><strong>Longevity:</strong> ${formula.longevity || 'N/A'}</p>
            <p><strong>Gender:</strong> ${formula.gender || 'N/A'}</p>
        `;
        card.appendChild(details);

        const notesSection = document.createElement('div');
        notesSection.innerHTML = `
            <h4>Notes:</h4>
            ${renderNotesList('Top', formula.top_notes)}
            ${renderNotesList('Heart', formula.middle_notes)}
            ${renderNotesList('Base', formula.base_notes)}
        `;
        card.appendChild(notesSection);

        if (formula.personal_review) {
             const review = document.createElement('div');
             review.innerHTML = `
                <h4>Review:</h4>
                <p>${formula.personal_review}</p>
             `;
             card.appendChild(review);
        }
        
        return card;
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
            formulaList.innerHTML = '<p id="loading-status">No saved formulas yet. Use the form above to add one!</p>';
        } else if (filteredFormulas.length === 0) {
            formulaList.innerHTML = `<p id="loading-status">No formulas found for Concentration: <strong>${filterValue}</strong>.</p>`;
        } else {
            filteredFormulas.forEach(formula => {
                formulaList.appendChild(createFormulaCard(formula));
            });
        }
    };
    
    // The handleUpdate function is implicitly covered by the form submit logic
    // since we check formulaIdToEdit.value inside the submit handler.

    // --- EVENT HANDLERS ---

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        
        // Basic name validation
        if (!document.getElementById('name').value.trim()) {
            errorMessage.textContent = 'Perfume Name is required.';
            errorMessage.style.display = 'block';
            return;
        }

        errorMessage.style.display = 'none';

        const newFormula = {
            id: formulaIdToEdit.value ? parseInt(formulaIdToEdit.value) : Date.now(),
            name: document.getElementById('name').value.trim(),
            launch_year: document.getElementById('launch_year').value,
            concentration: document.getElementById('concentration').value,
            scent_family: scentFamilyInput.value, // UPDATED: Capture Scent Family
            sillage: document.getElementById('sillage').value,
            longevity: document.getElementById('longevity').value,
            gender: document.getElementById('gender').value,
            top_notes: parseNotes(document.getElementById('top_notes').value),
            middle_notes: parseNotes(document.getElementById('middle_notes').value),
            base_notes: parseNotes(document.getElementById('base_notes').value),
            personal_review: document.getElementById('personal_review').value.trim()
        };

        let formulas = loadFormulas();
        
        // Logic to ADD or UPDATE
        if (formulaIdToEdit.value) {
            // Update logic
            const index = formulas.findIndex(f => f.id === newFormula.id);
            if (index !== -1) {
                formulas[index] = newFormula;
            }
            cancelEditMode(); // Exit edit mode after update
        } else {
            // Add new logic
            formulas.push(newFormula);
        }

        saveFormulas(formulas);
        form.reset();
        renderAllFormulas();
    });

    // The 'handleUpdate' function is now part of the submit listener, 
    // but the button still needs its listener (which will trigger the submit)
    // We can simplify this by just letting the submit handle it, but keep the 
    // listener if you want a separate update mechanism. For now, we'll keep it simple:
    updateButton.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent form default if any
        form.dispatchEvent(new Event('submit')); // Manually submit the form
    });
    
    cancelButton.addEventListener('click', cancelEditMode);
    concentrationFilter.addEventListener('change', renderAllFormulas);
    calculateButton.addEventListener('click', calculateConcentration);

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.page); 
        });
    });

    // Dark Mode Toggle Listener
    darkModeToggle.addEventListener('change', handleDarkModeToggle);


    // Initial setup:
    loadDarkModePreference();
    navigateTo('tracker'); 
});
