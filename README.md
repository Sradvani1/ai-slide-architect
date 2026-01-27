# AI Slide Architect

AI Slide Architect is an AI-driven application for creating classroom-ready slide decks. It turns a topic or uploaded documents into structured presentations with grounded research, speaker notes, and optional visuals, while keeping projects synced in the cloud.

## 🚀 Features

-   **AI-Powered Decks**: Generate slides from a topic or uploaded references (PDF, DOCX, TXT, images with OCR).
-   **Grounded Research**: Optional Google Search grounding and a dedicated research report export.
-   **Async Generation + Progress**: Background slide generation with real-time phases and retry on failure.
-   **Customizable Inputs**: Grade level, subject, slide count (2–10), bullets per slide (3–6), and optional instructions.
-   **Image Workflow**:
    -   Generate a visual idea per slide, edit it, and create images.
    -   Search for real images via Brave image search.
    -   Store generated images with the project.
-   **Secure Authentication**:
    -   Google Sign-In with Firestore-backed projects and auto-save.
    -   Firebase Storage for uploads and generated image assets.
-   **Sharing & Collaboration**: Share links with preview mode and one-click “make a copy” flow.
-   **Exports**:
    -   **PowerPoint (.pptx)** for full slides.
    -   **Speaker Notes (.docx)** (notes only).
    -   **Research Report (.docx)** with project metadata and sources.
-   **Modern UI**: Responsive, accessible interface built with React and Tailwind-inspired utility classes.

## 🛠️ Tech Stack

-   **Frontend**: [React](https://react.dev/), [Vite](https://vitejs.dev/)
-   **Backend**: [Firebase Functions](https://firebase.google.com/docs/functions) (v2, Express API)
-   **Data & Storage**: Firestore + Firebase Storage
-   **Auth**: Firebase Google Sign-In
-   **AI**: [Google Gemini](https://deepmind.google/technologies/gemini/) via `@google/genai`
-   **Image Search**: [Brave Search API](https://api.search.brave.com/)
-   **Document Handling**:
    -   `pptxgenjs` for PowerPoint
    -   `docx` for Word exports
    -   `pdfjs-dist` + `mammoth` for PDF/DOCX parsing
-   **Styling**: CSS / Tailwind-inspired utility classes

## 🔌 API Endpoints

Base URL:
- Local emulator: `http://localhost:5001/<project-id>/us-central1/api`
- Production: set `VITE_PRODUCTION_API_URL` to your Cloud Run URL

Endpoints:
- `POST /generate-slides` (auth) → async slide generation, returns 202 Accepted
- `POST /generate-image` (auth) → generates an image from the current prompt
- `POST /generate-prompt` (auth) → create or regenerate a slide’s visual idea
- `POST /search-images` (auth) → Brave image search for a slide
- `POST /extract-text` (auth) → OCR for uploaded images
- `POST /share/claim` (auth) → claim a shared deck and create a copy
- `GET /share/preview` (public) → read-only share preview
- `POST /admin/initialize-pricing` (admin) → initialize pricing data

## 🏁 Getting Started

Follow these steps to run the application locally.

### Prerequisites

-   **Node.js** (v18+ for web, Node 20 for Functions)
-   **npm** or **yarn**
-   A **Google Gemini API Key** (Get one [here](https://aistudio.google.com/app/apikey))
-   A **Firebase Project** (Create one [here](https://console.firebase.google.com/)) with:
    -   **Authentication** enabled (Google Provider)
    -   **Firestore Database** enabled
    -   **Firebase Storage** enabled
    -   **Firebase Functions** enabled
-   (Optional) **Brave Search API Key** for image search

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ai-slide-architect
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables (Frontend):**
    Create a `.env.local` file in the root directory:

    ```env
    # Firebase Configuration
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

    # Optional API routing overrides
    VITE_FUNCTIONS_URL=http://localhost:5001/<project-id>/us-central1/api
    VITE_USE_PROD_API=false
    VITE_PRODUCTION_API_URL=https://<your-cloud-run-url>
    ```

4.  **Configure Secrets (Firebase Functions):**
    These are required for deployed Functions and for any environment that runs the Functions backend.

    ```bash
    firebase functions:secrets:set GEMINI_API_KEY
    firebase functions:secrets:set BRAVE_API_KEY
    firebase functions:secrets:set ADMIN_USER_ID
    ```

5.  **Run the Development Server:**
    - Frontend only:
      ```bash
      npm run dev
      ```
    - Frontend + Functions emulator:
      ```bash
      npm run dev:emu
      ```

    The app should now be running at `http://localhost:5173`.

### Admin Scripts (Optional)

Some scripts (like `npm run init-pricing`) use Firebase Admin SDK and require a service account:

1. Create a service account and JSON key in Google Cloud.
2. Set `GOOGLE_APPLICATION_CREDENTIALS` to the key file path (recommended outside this repo).
3. Run:
   ```bash
   npm run init-pricing
   ```

Full setup steps are in `scripts/SETUP-SERVICE-ACCOUNT.md`.

## 📦 Deployment

This repo deploys the frontend separately from the backend Functions.

### Frontend (Vercel)

1.  **Push to GitHub** and import the repo into Vercel.
2.  **Framework Preset**: Vite
3.  **Build Command**: `npm run build`
4.  **Output Directory**: `dist`
5.  **Environment Variables**: add the `VITE_FIREBASE_...` values (and optional `VITE_*` API overrides).

### Backend (Firebase Functions)

1.  Configure Function secrets (`GEMINI_API_KEY`, optional `BRAVE_API_KEY`, optional `ADMIN_USER_ID`).
2.  Deploy:
    ```bash
    cd functions
    npm run deploy
    ```

Your frontend will call the Functions API URL you configure via `VITE_PRODUCTION_API_URL`.

## 📄 License

[MIT](LICENSE)
