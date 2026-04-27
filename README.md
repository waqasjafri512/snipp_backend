# ⚡ Snipp Backend - Premium Social Challenge Platform

Welcome to the **Snipp** backend API! This is a high-performance Node.js & PostgreSQL server powering the Snipp mobile application. It features real-time chat, live streaming, story management, and a dynamic "Dare" ecosystem.

## 🚀 Key Features

*   **Real-time Messaging**: Powered by Socket.io for instant communication.
*   **Live Streaming**: Integration with Agora for low-latency video streaming.
*   **Dynamic Feed**: Smart algorithms for dares, completions, and interactions.
*   **Stories & Moments**: 24-hour disappearing content with delete functionality.
*   **Friends Ecosystem**: Mutual follow logic to build real connections.
*   **Notifications**: Real-time alerts for likes, comments, and follows.

## 🛠 Tech Stack

*   **Runtime**: Node.js
*   **Framework**: Express.js (v5)
*   **Database**: PostgreSQL
*   **Real-time**: Socket.io
*   **Media**: Multer (Local storage / Cloud-ready)
*   **Auth**: Firebase Authentication (via Admin SDK) & Custom JWT

## 🏁 Getting Started

### Prerequisites

*   Node.js (v16+)
*   PostgreSQL (Local or Cloud instance like Supabase/Neon)
*   Firebase Project (for Authentication)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone <your-repo-url>
    cd dare-challenge/backend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory based on `.env.example`:
    ```bash
    cp .env.example .env
    ```
    Update the database credentials and Agora keys in your `.env`.

4.  **Firebase Configuration**:
    Download your Service Account JSON from Firebase Console and save it as `firebase-adminsdk.json` in the root directory.

5.  **Database Initialization**:
    The tables will be automatically created on the first run.

6.  **Run the server**:
    ```bash
    # Development mode
    npm run dev

    # Production mode
    npm start
    ```

## 📍 API Endpoints Summary

| Path | Description |
| :--- | :--- |
| `/api/auth/sync` | Sync Firebase user with PostgreSQL |
| `/api/auth/login` | Legacy login support |
| `/api/profile` | Profile management, Follows, Stats |
| `/api/dares` | Create, Complete, Like, Comment on Dares |
| `/api/messages` | Chat history and conversation lists |
| `/api/stories` | Upload and manage 24h stories |
| `/api/streams` | RTC Token generation for Agora |

## 📦 Deployment Note (Vercel)

This backend is optimized for **Vercel** deployment. 

> [!IMPORTANT]
> Since `.json` keys shouldn't be pushed to GitHub, for Vercel deployment:
> 1. Copy the entire content of `firebase-adminsdk.json`.
> 2. Add an Environment Variable in Vercel named `FIREBASE_SERVICE_ACCOUNT`.
> 3. Paste the JSON content as the value.

---

Made with ❤️ by the Snipp Team.
