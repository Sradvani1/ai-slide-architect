<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Slide Architect

AI Slide Architect is a powerful, AI-driven application designed to streamline the creation of presentation slides. By leveraging the capabilities of Google's Gemini API, it transforms topics or uploaded documents into fully structured, visually appealing presentations complete with speaker notes and image prompts.

## 🚀 Features

-   **AI-Powered Generation**: Instantly generate slide decks from a simple topic or by analyzing uploaded documents (PDF, DOCX, TXT).
-   **Secure Authentication**:
    -   **Google Sign-In**: Simple and secure login using your Google account.
    -   **Cloud Storage**: Your projects are automatically saved to the cloud (Firestore) and linked to your account.
    -   **Auto-Save**: Never lose your work with built-in auto-saving functionality.
-   **Customizable Context**: Tailor content by specifying the target **Grade Level** and **Subject** to ensure relevance and appropriate complexity.
-   **Smart Content Creation**:
    -   Automatic generation of slide titles, bullet points, and speaker notes.
    -   Intelligent image prompts designed to create relevant visuals for each slide.
-   **Interactive Editing**:
    -   Edit slide content directly within the application.
    -   Refine and regenerate image prompts to get the perfect visual.
    -   "Recreate Prompt" feature to generate fresh image ideas based on slide context.
-   **Export Options**:
    -   **PowerPoint (.pptx)**: Download the full presentation with formatted slides.
    -   **Speaker Notes (.docx)**: Export a dedicated document containing detailed speaker notes and sources.
    -   **Research Report (.docx)**: Download the project research report with metadata and sources.
-   **Modern UI**: A sleek, responsive interface built with React and Tailwind CSS (via standard CSS) for a premium user experience.

## 🛠️ Tech Stack

-   **Frontend**: [React](https://react.dev/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **AI Model**: [Google Gemini](https://deepmind.google/technologies/gemini/) (via `@google/genai`)
-   **Backend & Auth**: [Firebase](https://firebase.google.com/)
    -   **Authentication**: Google Sign-In
    -   **Firestore**: Real-time database for user and project storage
-   **Document Handling**:
    -   `pptxgenjs`: For generating PowerPoint files.
    -   `docx`: For creating Word documents.
    -   `pdfjs-dist` & `mammoth`: For parsing uploaded PDFs and Word docs.
-   **Styling**: CSS / Tailwind-inspired utility classes.

## 🏁 Getting Started

Follow these steps to run the application locally.

### Prerequisites

-   **Node.js** (v18 or higher recommended)
-   **npm** or **yarn**
-   A **Google Gemini API Key** (Get one [here](https://aistudio.google.com/app/apikey))
-   A **Firebase Project** (Create one [here](https://console.firebase.google.com/)) with:
    -   **Authentication** enabled (Google Provider).
    -   **Firestore Database** enabled.

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

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory and add your API keys:

    ```env
    # Google Gemini AI
    GEMINI_API_KEY=your_gemini_api_key

    # Firebase Configuration
    VITE_FIREBASE_API_KEY=your_firebase_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The app should now be running at `http://localhost:5173`.

## 📦 Deployment on Vercel

This project is optimized for deployment on [Vercel](https://vercel.com/).

1.  **Push to GitHub**: Ensure your project is pushed to a GitHub repository.
2.  **Import to Vercel**:
    -   Go to your Vercel dashboard and click **"Add New..."** -> **"Project"**.
    -   Select your `ai-slide-architect` repository.
3.  **Configure Project**:
    -   **Framework Preset**: Vercel should automatically detect **Vite**.
    -   **Root Directory**: `./` (default)
    -   **Build Command**: `npm run build` (default)
    -   **Output Directory**: `dist` (default)
4.  **Environment Variables**:
    -   Expand the **"Environment Variables"** section.
    -   Add `GEMINI_API_KEY` and all `VITE_FIREBASE_...` variables from your `.env.local` file.
5.  **Deploy**: Click **"Deploy"**.

Your application will be live in a few moments!

## 📄 License

[MIT](LICENSE)
