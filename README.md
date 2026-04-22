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
*   **Auth**: JSON Web Tokens (JWT) & Bcrypt

## 🏁 Getting Started

### Prerequisites

*   Node.js (v16+)
*   PostgreSQL (Local or Cloud instance like Supabase/Neon)

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

4.  **Database Initialization**:
    The tables will be automatically created on the first run.

5.  **Run the server**:
    ```bash
    # Development mode
    npm run dev

    # Production mode
    npm start
    ```

## 📍 API Endpoints Summary

| Path | Description |
| :--- | :--- |
| `/api/auth` | Login, Signup, and JWT Refresh |
| `/api/profile` | Profile management, Follows, Stats |
| `/api/dares` | Create, Complete, Like, Comment on Dares |
| `/api/messages` | Chat history and conversation lists |
| `/api/stories` | Upload and manage 24h stories |
| `/api/streams` | RTC Token generation for Agora |

## 📦 Deployment Note

This backend is ready for deployment on **Render.com**, **Railway.app**, or **DigitalOcean**. 

> [!IMPORTANT]
> For production deployment (e.g., Render), ensure you use a cloud PostgreSQL database (Supabase/Neon) and set up Cloudinary or S3 for permanent image storage.

---

Made with ❤️ by the Snipp Team.
