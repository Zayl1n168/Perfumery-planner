// =========================================================
// STEP 1: INITIALIZE ARRAYS (Temporarily replacing the database)
// =========================================================
let rawMaterials = []; // Stores user's available materials


// =========================================================
// STEP 2: RAW MATERIAL LIBRARY LOGIC (Updated for Density)
// =========================================================

const addMaterialForm = document.getElementById('addMaterialForm');
const materialListElement = document.getElementById('materialList');

addMaterialForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('materialName').value;
    const volatility = document.getElementById('materialVolatility').value;
    const dilution = parseFloat(document.getElementById('materialDilution').value);
    const density = parseFloat(document.getElementById('materialDensity').value); // <--- NEW LINE
    
    // Create a unique ID for the material (for database/retrieval later)
    const newMaterial = {
        id: Date.now(), 
        name, 
        volatility, 
        dilution: dilution / 100, // Store as a decimal (e.g., 0.1 for 10%)
        density // <--- ADDED density
    };

    rawMaterials.push(newMaterial);
    renderMaterialList();
    addMaterialForm.reset();
    console.log("New Material Added:", newMaterial);
});

function renderMaterialList() {
    materialListElement.innerHTML = '';
    rawMaterials.forEach(material => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${material.name}</span>
            <small>(${material.volatility} / ${material.dilution * 100}% / ${material.density} g/mL)</small>
        `; // <--- NOW SHOWING DENSITY
        materialListElement.appendChild(li);
    });
}

// =========================================================
// STEP 3: FORMULA CREATION LOGIC (Updated for mL input)
// =========================================================

const componentInputsContainer = document.getElementById('componentInputs');
const addComponentBtn = document.getElementById('addComponentBtn');

addComponentBtn.addEventListener('click', () => {
    if (rawMaterials.length === 0) {
        alert("Please add some materials to your Raw Materials Library first!");
        return;
    }
    
    // This function creates the HTML for a single material input row
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

    // Create the VOLUME input field (CHANGED FROM WEIGHT)
    const volumeInput = document.createElement('input'); 
    volumeInput.type = 'number';
    volumeInput.min = '0.001';
    volumeInput.step = '0.001';
    volumeInput.placeholder = 'Volume (mL)'; // <--- NEW PLACHEHOLDER
    volumeInput.name = 'volume'; // <--- NEW NAME ATTRIBUTE
    
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
    componentDiv.appendChild(volumeInput); // Append the volume input
    componentDiv.appendChild(removeBtn);
    
    componentInputsContainer.appendChild(componentDiv);

    // Attach event listeners for calculation whenever a value changes
    select.addEventListener('change', calculateMetrics);
    volumeInput.addEventListener('input', calculateMetrics); // Listen to the volume input
    
    calculateMetrics(); // Recalculate after adding a new component
});


function calculateMetrics() {
    let totalWeight = 0; // Total mass in grams
    let totalConcentrateWeight = 0; // Total mass of pure fragrance oil
    
    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = parseInt(componentDiv.querySelector('select[name="material"]').value);
        // ⚠️ Retrieving 'volume' in mL ⚠️
        const volume_mL = parseFloat(componentDiv.querySelector('input[name="volume"]').value) || 0; 
        
        // Find the full material object from our materials array
        const material = rawMaterials.find(m => m.id === materialId);
        
        // Ensure material object, volume, AND density exist
        if (material && volume_mL > 0 && material.density) { 
            
            // --- CORE CONVERSION: Volume (mL) to Weight (g) ---
            const weight_g = volume_mL * material.density; 
            // ----------------------------------------------------

            // 1. Calculate the weight of the pure concentrate (using grams)
            const pureConcentrate = weight_g * material.dilution;
            
            // 2. Add to totals
            totalWeight += weight_g; // Total weight is now in grams
            totalConcentrateWeight += pureConcentrate;
        }
    });

    // 3. Final Calculation (remains mass/mass for accuracy)
    const fragranceConcentration = (totalConcentrateWeight / totalWeight) * 100 || 0;

    // 4. Update the display (still showing grams for total mass)
    document.getElementById('totalWeight').textContent = totalWeight.toFixed(3) + 'g';
    document.getElementById('concPercentage').textContent = fragranceConcentration.toFixed(2) + '%';
}


// Placeholder for saving the formula (needs Firebase integration later)
const createFormulaForm = document.getElementById('createFormulaForm');

createFormulaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formulaName = document.getElementById('formulaName').value;
    const totalWeight = parseFloat(document.getElementById('totalWeight').textContent);
    const concPercentage = parseFloat(document.getElementById('concPercentage').textContent);

    if (totalWeight === 0) {
        alert("Your formula is empty!");
        return;
    }
    
    // In a real app, you would package up the formula name, components, 
    // and final metrics and send them to Firebase here!
    
    alert(`Formula "${formulaName}" Saved! (This is a placeholder until Firebase is connected) Total Weight: ${totalWeight.toFixed(3)}g, Concentration: ${concPercentage.toFixed(2)}%`);

    // Reset the form (optional)
    createFormulaForm.reset();
    componentInputsContainer.innerHTML = '';
    calculateMetrics();
});

// Initial call to ensure the metric displays are correct on load
calculateMetrics();
