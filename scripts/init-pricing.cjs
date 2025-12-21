const admin = require('firebase-admin');

// Initialize with project ID
admin.initializeApp({
  projectId: 'ai-slide-architect-9de88'
});

const db = admin.firestore();

const pricingData = [
  {
    id: 'gemini-3-flash-preview',
    modelName: 'Gemini 3 Flash Preview',
    modelType: 'text',
    inputPricePer1MTokens: 0.50,
    outputPricePer1MTokens: 3.00,
    effectiveDate: Date.now(),
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'gemini-3-pro-image-preview',
    modelName: 'Gemini 3 Pro Preview (Image)',
    modelType: 'image',
    inputPricePer1MTokens: 3.00,
    outputPricePer1MTokens: 120.00,
    effectiveDate: Date.now(),
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

async function init() {
  const batch = db.batch();
  
  pricingData.forEach(p => {
    const ref = db.collection('modelPricing').doc(p.id);
    batch.set(ref, p);
    console.log(`Adding ${p.id}...`);
  });
  
  await batch.commit();
  console.log('✅ Done!');
  process.exit(0);
}

init().catch(err => {
  console.error('Error:', err.message);
  console.error('\nMake sure you have GOOGLE_APPLICATION_CREDENTIALS set or run:');
  console.error('gcloud auth application-default login');
  process.exit(1);
});
