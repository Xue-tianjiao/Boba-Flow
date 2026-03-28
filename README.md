# Drink Scanner App (智能饮品识图与发现)

This is a full-stack web application for smart drink recognition and discovery, powered by Gemini 3 Flash and DeepSeek.

## Features
- **Smart Image Recognition**: Upload drink photos to identify brand, name, and details (sugar, ice).
- **New Product Discovery**: Daily recommendations of new drink releases.
- **Deep Search**: Semantic search for drinks with real-time web data and AI refinement.
- **Footprint & Insights**: Track your drink history and visualize your preferences.

## Project Structure
- `src/App.tsx`: Main frontend application with Apple-style UI.
- `src/services/geminiService.ts`: AI service integration (Gemini + DeepSeek).
- `server.ts`: Backend server (Express + SQLite + DeepSeek Proxy).
- `vite.config.ts`: Vite configuration.
- `package.json`: Dependencies and scripts.

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment Variables**
    The `.env` file has been created. Please update `GEMINI_API_KEY` with your actual key.
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    DEEPSEEK_API_KEY=sk-d84f890f669540719da646f105ac63b9
    ```

3.  **Start Development Server**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts, Motion.
- **Backend**: Node.js (Express), SQLite (Better-SQLite3).
- **AI**: Gemini 3 Flash (Vision & Search), DeepSeek (Text Refinement).
