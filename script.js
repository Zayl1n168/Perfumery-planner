Document.addEventListener('DOMContentLoaded', () => {
    // We are now using a global 'db' reference initialized in index.html for Firebase Firestore
    
    // Get all primary DOM elements
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
                // Using class for active state (more robust than inline style)
                btn.classList.add('active-nav');
                btn.style.fontWeight = 'bold';
            } else {
                btn.classList.remove('active-nav');
                btn.style.fontWeight = 'normal';
            }
        });

        // Re-render formulas only if navigating to the tracker page
        if (pageId === 'tracker') {
            renderAllFormulas();
        }
    };


    // --- Utility Functions (Parsing & Calculator) ---
    
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

    // --- FIREBASE CRUD IMPLEMENTATION ---
    
    // ASYNC: Deletes a formula from Firestore
    const deleteFormula = async (idToDelete) => {
        try {
            await db.collection("formulas").doc(idToDelete).delete();
            // List updates via onSnapshot listener
        } catch (error) {
            console.error("Error removing document: ", error);
            alert("Failed to delete formula. Check the console for details.");
        }
    };

    // ASYNC: Real-time data retrieval and rendering
    const renderAllFormulas = () => {
        const filterValue = concentrationFilter.value;
        // Show loading status while connecting/waiting
        formulaList.innerHTML = '<p id="loading-status">Connecting to database and loading formulas...</p>';

        // Use onSnapshot for real-time updates
        db.collection("formulas").onSnapshot(snapshot => {
            const allFormulas = [];
            snapshot.forEach(doc => {
                // Get the Firestore document ID and all data
                allFormulas.push({ ...doc.data(), id: doc.id });
            });
            
            formulaList.innerHTML = ''; // Clear list

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
        }, error => {
            console.error("Firestore data retrieval error:", error);
            formulaList.innerHTML = '<p style="color: red;">Error loading formulas. Check console for details.</p>';
        });
    };

    // --- Rendering and Edit Handlers ---
    
    const startEditMode = (formula) => {
        // Populate form fields
        document.getElementById('name').value = formula.name;
        document.getElementById('launch_year').value = formula.launch_year;
        document.getElementById('concentration').value = formula.concentration;
        scentFamilyInput.value = formula.scent_family || ''; // Scent Family Load
        document.getElementById('sillage').value = formula.sillage;
        document.getElementById('longevity').value = formula.longevity;
        document.getElementById('gender').value = formula.gender;
        document.getElementById('top_notes').value = joinNotes(formula.top_notes);
        document.getElementById('middle_notes').value = joinNotes(formula.middle_notes);
        document.getElementById('base_notes').value = joinNotes(formula.base_notes);
        document.getElementById('personal_review').value = formula.personal_review;

        // Set ID for update (this ID is the Firestore doc ID)
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
    
    const renderNotesList = (title, notes) => {
        if (!notes || notes.length === 0) return '';
        // Note rendering simplified for this example - assuming notes are simple strings
        return `
            <p style="margin-top: 5px; margin
