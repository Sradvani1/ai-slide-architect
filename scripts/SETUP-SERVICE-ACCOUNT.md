# Setting Up Service Account for Script Access

This allows your scripts to read/write to Firestore without browser authentication.

## Step 1: Create Service Account in Google Cloud Console

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=ai-slide-architect-9de88
2. Click **"+ CREATE SERVICE ACCOUNT"**
3. Fill in:
   - **Service account name**: `firebase-scripts` (or any name)
   - **Service account ID**: auto-generated (keep it)
   - Click **"CREATE AND CONTINUE"**
4. **Grant access** (optional - skip for now, we'll add permissions):
   - Click **"CONTINUE"**
   - Click **"DONE"**

## Step 2: Create and Download Key

1. Find your service account in the list
2. Click on it (the email address)
3. Go to **"KEYS"** tab
4. Click **"ADD KEY"** → **"Create new key"**
5. Select **JSON** format
6. Click **"CREATE"**
7. **SAVE THE FILE** - it will download automatically
8. **IMPORTANT**: Move it to a safe location (NOT in your project directory)
   - Example: `~/firebase-keys/ai-slide-architect-service-account.json`
   - **NEVER commit this file to git!**

## Step 3: Grant Firestore Permissions

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=ai-slide-architect-9de88
2. Find your service account (search for the email)
3. Click the **pencil icon** (Edit)
4. Click **"ADD ANOTHER ROLE"**
5. Add these roles:
   - **Cloud Datastore User** (for Firestore read/write)
   - **Firebase Admin** (for full Firebase access)
6. Click **"SAVE"**

## Step 4: Set Environment Variable

**Option A: Temporary (for this session)**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/sameer/path/to/your-service-account-key.json"
```

**Option B: Permanent (add to ~/.zshrc)**
```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/Users/sameer/path/to/your-service-account-key.json"' >> ~/.zshrc
source ~/.zshrc
```

**Option C: Per-project (create .env file)**
```bash
# In project root, create .env file:
echo 'GOOGLE_APPLICATION_CREDENTIALS=/Users/sameer/path/to/your-service-account-key.json' > .env
```

## Step 5: Test It

```bash
npm run init-pricing
```

If it works, you're all set! Now you can write any script that uses Firebase Admin SDK.

## Security Notes

- **NEVER commit the service account key to git**
- Add to `.gitignore`: `*.json` (or be more specific)
- Keep the key file secure
- If compromised, delete it and create a new one

## Using in Scripts

Your scripts can now use:
```javascript
const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'ai-slide-architect-9de88'
});
const db = admin.firestore();
// Now you can read/write to Firestore
```
