const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
    admin.initializeApp();
} catch (e) {
    // If already initialized
}

const db = admin.firestore();

async function initializeModelPricing() {
    const now = Date.now();

    // Hardcoded IDs to avoid import issues
    const MODEL_SLIDE_GENERATION = "gemini-3-flash-preview";
    const MODEL_IMAGE_GENERATION = "gemini-3-pro-image-preview";

    const pricingData = [
        {
            id: MODEL_SLIDE_GENERATION,
            modelName: 'Gemini 3 Flash Preview',
            modelType: 'text',
            inputPricePer1MTokens: 0.50,
            outputPricePer1MTokens: 3.00,
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: MODEL_IMAGE_GENERATION,
            modelName: 'Gemini 3 Pro Preview (Image)',
            modelType: 'image',
            inputPricePer1MTokens: 3.00,
            outputPricePer1MTokens: 120.00,
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    ];

    console.log('Starting initialization...');

    for (const pricing of pricingData) {
        try {
            await db.collection('modelPricing').doc(pricing.id).set(pricing);
            console.log(`Successfully set pricing for ${pricing.id}`);
        } catch (err) {
            console.error(`Failed to set pricing for ${pricing.id}:`, err);
        }
    }

    console.log('Initialization complete.');
    process.exit(0);
}

initializeModelPricing();
