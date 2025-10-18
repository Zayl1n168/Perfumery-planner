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
    
    // Page Navigation Elements
    const navButtons = document.querySelectorAll('.nav-button'); 
    const pageTracker = document.getElementById('page-tracker');
    const pageSettings = document.getElementById('page-settings');
    
    // NEW: Dark Mode Elements and Key
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const DARK_MODE_KEY = 'darkModeEnabled';

    // --- DARK MODE LOGIC (NEW) ---

    const applyDarkMode = (isEnabled) => {
        if (isEnabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    const loadDarkModePreference = () => {
        const isEnabled = localStorage.getItem(DARK_MODE_KEY) === 'true';
        darkModeToggle.checked = isEnabled; // Set the toggle state
        applyDarkMode(isEnabled); // Apply the style
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


    // --- Utility Functions (CRUD, Calculator, Rendering - NO CHANGE) ---
    const loadFormulas = () => { /* ... (remains the same) ... */ };
    const saveFormulas = (formulas) => { /* ... (remains the same) ... */ };
    const parseNotes = (noteString) => { /* ... (remains the same) ... */ };
    const joinNotes = (notesArray) => { /* ... (remains the same) ... */ };
    const deleteFormula = (idToDelete) => { /* ... (remains the same) ... */ };
    const calculateConcentration = () => { /* ... (remains the same) ... */ };
    const startEditMode = (formula) => { /* ... (remains the same) ... */ };
    const cancelEditMode = () => { /* ... (remains the same) ... */ };
    const handleUpdate = (event) => { /* ... (remains the same) ... */ };
    const createFormulaCard = (formula) => { /* ... (remains the same) ... */ };
    const renderNotesList = (title, notes) => { /* ... (remains the same) ... */ };
    const renderAllFormulas = () => { /* ... (remains the same) ... */
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

    form.addEventListener('submit', (event) => { /* ... (remains the same) ... */ });
    updateButton.addEventListener('click', handleUpdate);
    cancelButton.addEventListener('click', cancelEditMode);
    concentrationFilter.addEventListener('change', renderAllFormulas);
    calculateButton.addEventListener('click', calculateConcentration);

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navigateTo(button.dataset.page); 
        });
    });

    // NEW: Dark Mode Toggle Listener
    darkModeToggle.addEventListener('change', handleDarkModeToggle);


    // Initial setup:
    loadDarkModePreference(); // Check local storage and apply dark mode before anything renders
    navigateTo('tracker'); 
});
