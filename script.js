// =========================================================
// STEP 1: INITIALIZE ARRAYS (Temporarily replacing the database)
// =========================================================
let rawMaterials = []; // Stores user's available materials
let currentFormulaComponents = []; // Stores materials currently in the formula being created


// =========================================================
// STEP 2: RAW MATERIAL LIBRARY LOGIC
// =========================================================

const addMaterialForm = document.getElementById('addMaterialForm');
const materialListElement = document.getElementById('materialList');

addMaterialForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('materialName').value;
    const volatility = document.getElementById('materialVolatility').value;
    const dilution = parseFloat(document.getElementById('materialDilution').value);
    
    // Create a unique ID for the material (for database/retrieval later)
    const newMaterial = {
        id: Date.now(), 
        name, 
        volatility, 
        dilution: dilution / 100 // Store as a decimal (e.g., 0.1 for 10%)
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
            <small>(${material.volatility} / ${material.dilution * 100}%)</small>
        `;
        materialListElement.appendChild(li);
    });
}

// =========================================================
// STEP 3: FORMULA CREATION LOGIC
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

    // Create the weight input field
    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.min = '0.001';
    weightInput.step = '0.001';
    weightInput.placeholder = 'Weight (g)';
    weightInput.name = 'weight';
    
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
    componentDiv.appendChild(weightInput);
    componentDiv.appendChild(removeBtn);
    
    componentInputsContainer.appendChild(componentDiv);

    // Attach event listeners for calculation whenever a value changes
    select.addEventListener('change', calculateMetrics);
    weightInput.addEventListener('input', calculateMetrics);
    
    calculateMetrics(); // Recalculate after adding a new component
});


function calculateMetrics() {
    let totalWeight = 0;
    let totalConcentrateWeight = 0;
    
    const components = componentInputsContainer.querySelectorAll('.formula-component');
    
    components.forEach(componentDiv => {
        const materialId = parseInt(componentDiv.querySelector('select[name="material"]').value);
        const weight = parseFloat(componentDiv.querySelector('input[name="weight"]').value) || 0;
        
        // Find the full material object from our materials array
        const material = rawMaterials.find(m => m.id === materialId);
        
        if (material && weight > 0) {
            // 1. Calculate the weight of the pure concentrate in this component
            const pureConcentrate = weight * material.dilution;
            
            // 2. Add to totals
            totalWeight += weight;
            totalConcentrateWeight += pureConcentrate;
        }
    });

    // 3. Final Calculation
    const fragranceConcentration = (totalConcentrateWeight / totalWeight) * 100 || 0;

    // 4. Update the display
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
    
    alert(`Formula "${formulaName}" Saved! Total Weight: ${totalWeight.toFixed(3)}g, Concentration: ${concPercentage.toFixed(2)}%`);

    // Reset the form (optional)
    createFormulaForm.reset();
    componentInputsContainer.innerHTML = '';
    calculateMetrics();
});

// Initial call to ensure the metric displays are correct on load
calculateMetrics();
