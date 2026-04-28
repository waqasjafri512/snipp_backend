# 🚀 Snipp Backend - High-Performance Social Engine

Welcome to the **Snipp** backend! This is the engine powering the Snipp social ecosystem, built with a focus on real-time interactivity, low-latency communication, and exceptional database resilience.

---

## ⚡ Core Features

### 📞 Real-time Signaling System
- **Video & Audio Handshake**: Advanced Socket.io event handling for 1-on-1 calls (`callUser`, `answerCall`, `rejectCall`, `endCall`).
- **RTC Tokenization**: Dynamic Agora token generation with specialized roles for broadcasters and call participants.

### 🛡️ Resilient Database Architecture
- **Fault-Tolerant Queries**: Custom `queryResilient` implementation that automatically detects and retries queries during transient database connection drops.
- **Optimized Connection Pool**: Fine-tuned PostgreSQL pool management to ensure stability under high concurrent loads.

### 🔔 Integrated Notification Service
- **Hybrid Delivery**: Real-time socket emissions combined with high-priority **Firebase Cloud Messaging (FCM)** for cross-platform push notifications.
- **Actionable Alerts**: Support for chat, call, and social interaction notifications with custom payload data.

### 🎭 Dynamic Social Logic
- **Dare Ecosystem**: Complex logic for creating, accepting, and liking dares with real-time feedback.
- **Stories & Moments**: Auto-expiring content logic with efficient deletion and view tracking.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v5.x for improved performance)
- **Database**: PostgreSQL
- **Real-time**: Socket.io (with sticky-session support)
- **Security**: Firebase Admin SDK (Auth & UID Sync)
- **Email**: Nodemailer (Professional template support)

---

## 🏁 Getting Started

### 1. Prerequisites
- Node.js (v18.x or higher)
- PostgreSQL (v14.x or higher)
- Firebase Project Service Account

### 2. Environment Setup
Create a `.env` file based on `.env.example`:
```env
PORT=5000
DATABASE_URL=postgres://user:pass@host:5432/dbname
JWT_SECRET=your_secret
AGORA_APP_ID=your_id
AGORA_APP_CERTIFICATE=your_cert
```

### 3. Firebase SDK
Save your service account JSON as `firebase-adminsdk.json` in the root directory.

### 4. Installation & Launch
```bash
npm install
# Development mode with auto-reload
npm run dev
# Production launch
npm start
```

---

## 📍 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/sync` | `POST` | Primary entry point for Firebase UID synchronization. |
| `/api/auth/fcm-token` | `POST` | Update user push notification tokens. |
| `/api/dares/toggle-like` | `POST` | Toggle likes with instant real-time notification. |
| `/api/streams/get-token` | `GET` | Generate RTC tokens for calls and streaming. |
| `/api/messages/history` | `GET` | Retrieve conversation history with pagination. |

---

## 📦 Deployment

This server is designed to be **Cloud Native**. It is fully compatible with:
- **Vercel** (Serverless functions)
- **Heroku / DigitalOcean** (Persistent containers)
- **Docker** (Environment consistency)

---

Made with ❤️ by the **Snipp Engineering Team**.
