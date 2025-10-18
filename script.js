// =========================================================
// STEP 1: FIREBASE DATABASE SETUP & DATA LOADING
// =========================================================

let rawMaterials = []; // Global array to store materials loaded from the database

// Function to fetch materials from the database when the app loads
async function loadMaterials() {
    console.log("Loading materials from Firestore...");
    
    // Safety check to ensure Firebase is ready
    if (typeof db === 'undefined') {
        console.warn("Firebase 'db' not initialized. Data persistence is disabled.");
        return; 
    }
    
    // Wait for the data to be fetched
    const snapshot = await db.collection('materials').get(); 
    
    rawMaterials = snapshot.docs.map(doc => ({
        id: doc.id, // Use the Firestore STRING ID
        ...doc.data()
    }));
    
    console.log("Materials loaded:", rawMaterials);
    renderMaterialList(); // Display materials
    
    // Update any existing formula selectors (crucial for loading data correctly)
    updateFormulaMaterialSelector(); 
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
        // Note: material.id is now a string from Firestore
        li.innerHTML = `
            <span>${material.name}</span>
            <small>(${material.volatility} / ${material.dilution * 100}% / ${material.density} g/mL)</small>
        `;
        materialListElement.appendChild(li);
    });
}

// =========================================================
// STEP 3: FORMULA CREATION LOGIC (Calculations & Pyramid)
// =========================================================

const componentInputsContainer = document.getElementById('componentInputs');
const addComponentBtn = document.getElementById('addComponentBtn');

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
        calculateMetrics(); // Recalculate after removal
    });

    componentDiv.appendChild(select);
    componentDiv.appendChild(volumeInput);
    componentDiv.appendChild(removeBtn);
    
    componentInputsContainer.appendChild(componentDiv);

    // Attach event listeners for calculation whenever a value changes
    select.addEventListener('change', calculateMetrics);
    volumeInput.addEventListener('input', calculateMetrics); 
    
    calculateMetrics(); // Recalculate after adding a new component
});


function calculateMetrics() {
    let totalWeight = 0; // Total mass in grams
    let totalConcentrateWeight = 0; // Total mass of pure fragrance oil
    
    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        // Material ID is read as a string value
        const materialId = componentDiv.querySelector('select[name="material"]').value;
        const volume_mL = parseFloat(componentDiv.querySelector('input[name="volume"]').value) || 0; 
        
        // Find the material using the string ID
        const material = rawMaterials.find(m => m.id === materialId);
        
        // Ensure material object, volume, AND density exist
        if (material && volume_mL > 0 && material.density) { 
            
            // --- CORE CONVERSION: Volume (mL) to Weight (g) ---
            const weight_g = volume_mL * material.density; 
            // ----------------------------------------------------

            // 1. Calculate the weight of the pure concentrate (using grams)
            const pureConcentrate = weight_g * material.dilution;
            
            // 2. Add to totals
            totalWeight += weight_g; 
            totalConcentrateWeight += pureConcentrate;
        }
    });

    // 3. Final Calculation (remains mass/mass for accuracy)
    const fragranceConcentration = (totalConcentrateWeight / totalWeight) * 100 || 0;

    // 4. Update the display 
    document.getElementById('totalWeight').textContent = totalWeight.toFixed(3) + 'g';
    document.getElementById('concPercentage').textContent = fragranceConcentration.toFixed(2) + '%';
    
    // 5. CALL THE PYRAMID RENDER FUNCTION
    renderPyramid(); 
}

// --- RENDER OLFACTORY PYRAMID ---
function renderPyramid() {
    // 1. Clear previous content
    document.getElementById('pyramidTop').querySelector('.note-list').innerHTML = '';
    document.getElementById('pyramidMiddle').querySelector('.note-list').innerHTML = '';
    document.getElementById('pyramidBase').querySelector('.note-list').innerHTML = '';

    // 2. Create arrays to hold notes for each level
    const topNotes = [];
    const middleNotes = [];
    const baseNotes = [];

    // 3. Loop through components and group them by Volatility
    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = componentDiv.querySelector('select[name="material"]').value;
        
        // Find the full material object (using the string ID)
        const material = rawMaterials.find(m => m.id === materialId);

        // Only process if a material is actually selected
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

    // 4. Render the grouped notes into the DOM
    document.getElementById('pyramidTop').querySelector('.note-list').innerHTML = topNotes.join('');
    document.getElementById('pyramidMiddle').querySelector('.note-list').innerHTML = middleNotes.join('');
    document.getElementById('pyramidBase').querySelector('.note-list').innerHTML = baseNotes.join('');
}


// =========================================================
// STEP 4: FORMULA SAVING LOGIC (SAVE to Firebase)
// =========================================================

const createFormulaForm = document.getElementById('createFormulaForm');

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
        
        // Look up the material to save its name and volatility with the formula
        const material = rawMaterials.find(m => m.id === materialId);

        if (material) {
            componentsToSave.push({
                materialId: material.id, 
                name: material.name, // Save name for easy display later
                volatility: material.volatility,
                volume_mL: volume
            });
        }
    });

    // Final Formula object to send to the 'formulas' collection
    const finalFormula = {
        name: formulaName,
        totalWeight_g: totalWeight,
        concentration_pct: concPercentage,
        components: componentsToSave,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() // Adds a creation date
    };
    
    // Save to the formulas collection
    await db.collection('formulas').add(finalFormula);

    alert(`Success! Formula "${formulaName}" has been saved to your database.`);

    // Reset the form
    createFormulaForm.reset();
    componentInputsContainer.innerHTML = '';
    calculateMetrics();
});

// The initial call ensures everything loads when the script runs
// The loadMaterials() function handles the data loading first.
// calculateMetrics(); // This is no longer needed here as loadMaterials() calls it indirectly.
