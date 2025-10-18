// =========================================================
// STEP 1: FIREBASE DATABASE SETUP & DATA LOADING
// =========================================================

let rawMaterials = []; // Global array to store materials loaded from the database
let savedFormulas = []; // NEW: Global array to store saved formula objects

// --- Initial Data Load Function ---
async function loadMaterials() {
    console.log("Loading materials from Firestore...");
    
    if (typeof db === 'undefined') {
        console.warn("Firebase 'db' not initialized. Data persistence is disabled.");
        return; 
    }
    
    // 1. Load Materials
    const materialSnapshot = await db.collection('materials').get(); 
    rawMaterials = materialSnapshot.docs.map(doc => ({
        id: doc.id, 
        ...doc.data()
    }));
    
    // 2. Load Formulas 
    await loadSavedFormulas();

    renderMaterialList();
    updateFormulaMaterialSelector();
    
    // Ensure metrics are clean when starting
    calculateMetrics();
}

// --- NEW: Load Saved Formulas from Firebase ---
async function loadSavedFormulas() {
    // Order by timestamp so the newest (most recently saved) is at the top
    const formulaSnapshot = await db.collection('formulas').orderBy('timestamp', 'desc').get();
    savedFormulas = formulaSnapshot.docs.map(doc => ({
        id: doc.id, // Store the Firestore STRING ID
        ...doc.data()
    }));
    renderFormulaList();
}

// --- NEW: Render Saved Formulas List ---
function renderFormulaList() {
    const listElement = document.getElementById('savedFormulaList');
    listElement.innerHTML = ''; // Clear existing list

    if (savedFormulas.length === 0) {
        listElement.innerHTML = '<li><small>No formulas saved yet.</small></li>';
        return;
    }

    savedFormulas.forEach(formula => {
        const li = document.createElement('li');
        li.classList.add('formula-item'); // Add class for styling
        
        // Display name and concentration
        li.innerHTML = `
            <span>${formula.name}</span>
            <small>${formula.concentration_pct.toFixed(2)}% | ${formula.totalWeight_g.toFixed(2)}g</small>
        `;
        
        // Make the list item clickable to view the formula
        li.addEventListener('click', () => viewFormula(formula.id));
        listElement.appendChild(li);
    });
}

// Function to update the dropdown options in existing formula component rows
function updateFormulaMaterialSelector() {
    const selects = componentInputsContainer.querySelectorAll('select[name="material"]');
    selects.forEach(select => {
        const selectedId = select.value;
        select.innerHTML = '<option value="">-- Select Material --</option>';
        rawMaterials.forEach(material => {
            const option = document.createElement('option');
            option.value = material.id;
            option.textContent = material.name;
            if (material.id === selectedId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    });
}

// Call the function to load data when the script starts
loadMaterials(); 


// =========================================================
// STEP 2: RAW MATERIAL LIBRARY LOGIC (SAVE to Firebase)
// =========================================================

const addMaterialForm = document.getElementById('addMaterialForm');
const materialListElement = document.getElementById('materialList');

addMaterialForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (typeof db === 'undefined') {
        alert("Cannot save. Firebase is not set up correctly in index.html.");
        return;
    }

    const name = document.getElementById('materialName').value;
    const volatility = document.getElementById('materialVolatility').value;
    const dilution = parseFloat(document.getElementById('materialDilution').value);
    const density = parseFloat(document.getElementById('materialDensity').value);
    
    // Data object to save to Firebase
    const newMaterialData = {
        name, 
        volatility, 
        dilution: dilution / 100, // Store as a decimal
        density,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Save to Firebase and get the document reference
    const docRef = await db.collection('materials').add(newMaterialData);
    
    // Add the new material (including the Firestore ID) to our local list
    rawMaterials.push({
        id: docRef.id, // This is the new STRING ID
        ...newMaterialData
    });
    
    renderMaterialList();
    addMaterialForm.reset();
    updateFormulaMaterialSelector(); // Update the dropdowns with the new material
    console.log("New Material Added to DB:", docRef.id);
});

function renderMaterialList() {
    materialListElement.innerHTML = '';
    rawMaterials.forEach(material => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${material.name}</span>
            <small>(${material.volatility} / ${material.dilution * 100}% / ${material.density} g/mL)</small>
        `;
        materialListElement.appendChild(li);
    });
}

// =========================================================
// STEP 3: FORMULA CREATION/VIEWING LOGIC
// =========================================================

const componentInputsContainer = document.getElementById('componentInputs');
const addComponentBtn = document.getElementById('addComponentBtn');
const createFormulaForm = document.getElementById('createFormulaForm');

// --- NEW: Load a Saved Formula into the Form ---
function viewFormula(formulaId) {
    const formula = savedFormulas.find(f => f.id === formulaId);
    if (!formula) return;

    // 1. Clear current components
    componentInputsContainer.innerHTML = '';
    
    // 2. Set the Formula Name field
    document.getElementById('formulaName').value = formula.name;

    // 3. Add components back into the form
    formula.components.forEach(component => {
        // Create the necessary HTML elements for the component row
        const componentDiv = document.createElement('div');
        componentDiv.classList.add('formula-component');
        
        // --- Material Dropdown ---
        const select = document.createElement('select');
        select.name = 'material';
        select.innerHTML = '<option value="">-- Select Material --</option>';
        rawMaterials.forEach(material => {
            const option = document.createElement('option');
            option.value = material.id;
            option.textContent = material.name;
            // Set the saved material as selected
            if (material.id === component.materialId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // --- Volume Input ---
        const volumeInput = document.createElement('input'); 
        volumeInput.type = 'number';
        volumeInput.min = '0.001';
        volumeInput.step = '0.001';
        volumeInput.placeholder = 'Volume (mL)'; 
        volumeInput.name = 'volume'; 
        volumeInput.value = component.volume_mL; // Set the saved volume

        // --- Remove Button ---
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.classList.add('remove-component-btn');
        removeBtn.addEventListener('click', () => {
            componentDiv.remove();
            calculateMetrics();
        });

        componentDiv.appendChild(select);
        componentDiv.appendChild(volumeInput);
        componentDiv.appendChild(removeBtn);
        componentInputsContainer.appendChild(componentDiv);

        // Re-attach listeners for changes
        select.addEventListener('change', calculateMetrics);
        volumeInput.addEventListener('input', calculateMetrics);
    });

    // 4. Run calculation to update metrics and pyramid immediately
    calculateMetrics();
}


// --- Component Adding Logic ---
addComponentBtn.addEventListener('click', () => {
    if (rawMaterials.length === 0) {
        alert("Please add some materials to your Raw Materials Library first!");
        return;
    }
    
    const componentDiv = document.createElement('div');
    componentDiv.classList.add('formula-component');
    
    // Create the material dropdown
    const select = document.createElement('select');
    select.name = 'material';
    select.innerHTML = '<option value="">-- Select Material --</option>';
    rawMaterials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = material.name;
        select.appendChild(option);
    });

    // Create the VOLUME input field
    const volumeInput = document.createElement('input'); 
    volumeInput.type = 'number';
    volumeInput.min = '0.001';
    volumeInput.step = '0.001';
    volumeInput.placeholder = 'Volume (mL)'; 
    volumeInput.name = 'volume'; 
    
    // Create the remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'X';
    removeBtn.classList.add('remove-component-btn');
    removeBtn.addEventListener('click', () => {
        componentDiv.remove();
        calculateMetrics(); 
    });

    componentDiv.appendChild(select);
    componentDiv.appendChild(volumeInput);
    componentDiv.appendChild(removeBtn);
    
    componentInputsContainer.appendChild(componentDiv);

    select.addEventListener('change', calculateMetrics);
    volumeInput.addEventListener('input', calculateMetrics); 
    
    calculateMetrics(); 
});


// --- Core Calculation Logic ---
function calculateMetrics() {
    let totalWeight = 0; 
    let totalConcentrateWeight = 0;
    
    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = componentDiv.querySelector('select[name="material"]').value;
        const volume_mL = parseFloat(componentDiv.querySelector('input[name="volume"]').value) || 0; 
        
        const material = rawMaterials.find(m => m.id === materialId);
        
        if (material && volume_mL > 0 && material.density) { 
            const weight_g = volume_mL * material.density; 
            const pureConcentrate = weight_g * material.dilution;
            
            totalWeight += weight_g; 
            totalConcentrateWeight += pureConcentrate;
        }
    });

    const fragranceConcentration = (totalConcentrateWeight / totalWeight) * 100 || 0;

    document.getElementById('totalWeight').textContent = totalWeight.toFixed(3) + 'g';
    document.getElementById('concPercentage').textContent = fragranceConcentration.toFixed(2) + '%';
    
    renderPyramid(); 
}

// --- Olfactory Pyramid Rendering ---
function renderPyramid() {
    document.getElementById('pyramidTop').querySelector('.note-list').innerHTML = '';
    document.getElementById('pyramidMiddle').querySelector('.note-list').innerHTML = '';
    document.getElementById('pyramidBase').querySelector('.note-list').innerHTML = '';

    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];

    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = componentDiv.querySelector('select[name="material"]').value;
        const material = rawMaterials.find(m => m.id === materialId);

        if (material) {
            const noteTag = `<li>${material.name}</li>`;

            switch (material.volatility) {
                case 'Top':
                    topNotes.push(noteTag);
                    break;
                case 'Middle':
                    middleNotes.push(noteTag);
                    break;
                case 'Base':
                    baseNotes.push(noteTag);
                    break;
            }
        }
    });

    document.getElementById('pyramidTop').querySelector('.note-list').innerHTML = topNotes.join('');
    document.getElementById('pyramidMiddle').querySelector('.note-list').innerHTML = middleNotes.join('');
    document.getElementById('pyramidBase').querySelector('.note-list').innerHTML = baseNotes.join('');
}


// =========================================================
// STEP 4: FORMULA SAVING LOGIC (SAVE to Firebase & RELOAD LIST)
// =========================================================

createFormulaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formulaName = document.getElementById('formulaName').value;
    const totalWeight = parseFloat(document.getElementById('totalWeight').textContent);
    const concPercentage = parseFloat(document.getElementById('concPercentage').textContent);

    if (totalWeight === 0) {
        alert("Your formula is empty!");
        return;
    }
    
    if (typeof db === 'undefined') {
        alert("Cannot save. Firebase is not set up correctly in index.html.");
        return;
    }
    
    // Gather all components for saving
    const componentsToSave = [];
    const components = document.getElementById('componentInputs').querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = componentDiv.querySelector('select[name="material"]').value;
        const volume = parseFloat(componentDiv.querySelector('input[name="volume"]').value) || 0;
        
        const material = rawMaterials.find(m => m.id === materialId);

        if (material) {
            componentsToSave.push({
                materialId: material.id, 
                name: material.name, 
                volatility: material.volatility,
                volume_mL: volume
            });
        }
    });

    const finalFormula = {
        name: formulaName,
        totalWeight_g: totalWeight,
        concentration_pct: concPercentage,
        components: componentsToSave,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Save to the formulas collection
    await db.collection('formulas').add(finalFormula);

    // After saving, reload the formula list to show the new one immediately
    await loadSavedFormulas(); 

    alert(`Success! Formula "${formulaName}" has been saved to your database.`);

    // Reset the form
    createFormulaForm.reset();
    componentInputsContainer.innerHTML = '';
    calculateMetrics();
});
