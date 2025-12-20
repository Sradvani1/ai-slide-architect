const admin = require('firebase-admin');

// Initialize Firebase Admin
// This assumes you have GOOGLE_APPLICATION_CREDENTIALS set or are running on a machine with firebase login
try {
    admin.initializeApp();
} catch (e) {
    // If already initialized
}

const db = admin.firestore();

async function initializeModelPricing() {
    const now = Date.now();

    // Using the same constants as in the app
    const MODEL_SLIDE_GENERATION = "gemini-1.5-flash";
    const MODEL_IMAGE_GENERATION = "imagen-3";

    const pricingData = [
        {
            id: MODEL_SLIDE_GENERATION,
            modelName: 'Gemini 1.5 Flash',
            modelType: 'text',
            inputPricePer1MTokens: 0.15,
            outputPricePer1MTokens: 0.60,
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: MODEL_IMAGE_GENERATION,
            modelName: 'Imagen 3',
            modelType: 'image',
            inputPricePer1MTokens: 0.00,
            outputPricePer1MTokens: 10.00, // $0.01 per image
            effectiveDate: now,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    ];

    const batch = db.batch();

    for (const pricing of pricingData) {
        const ref = db.collection('modelPricing').doc(pricing.id);
        console.log(`Setting pricing for ${pricing.id}...`);
        batch.set(ref, pricing);
    }

    try {
        await batch.commit();
        console.log('Successfully initialized model pricing in Firestore.');
    } catch (error) {
        console.error('Error initializing model pricing:', error);
        process.exit(1);
    }
}

initializeModelPricing();
