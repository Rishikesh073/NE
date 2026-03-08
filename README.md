# Nexus — AI-Powered Marketing Agency Platform

> A full-stack SaaS platform for managing clients, campaigns, tasks, billing, and AI-powered content generation for a digital marketing agency.

---

## Key Features

- 🔐 **Firebase Authentication** — Email/password + Google Sign-In, with role-based access (Admin / Client)
- 📊 **Admin Dashboard** — Full visibility over all clients, campaigns, tasks, service requests, and real-time chat
- 👤 **Client Dashboard** — Personalized portal for submitting AI briefs, tracking tasks, uploading assets, and chatting
- 🤖 **AI Content Studio** — Generate marketing copy, SEO keywords, blog outlines, and AI images using Google Gemini
- 💳 **Stripe Billing** — Checkout sessions for Starter / Growth / Enterprise subscription tiers
- 🔔 **Real-Time Engine** — Socket.IO for live bi-directional messaging and task assignment
- 📧 **Automated Emails** — Nodemailer triggers on client signup, brief approval, and new messages
- ☁️ **Cloudinary Asset Store** — Clients can upload brand assets (images, PDFs) stored on Cloudinary
- 📡 **Ad Network Sync** — Nightly cron job to sync campaign data

---

## Tech Stack

### Backend (`nexus-back/`)
| Layer | Technology |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 5 |
| Database | Firestore (Firebase Admin SDK) |
| Authentication | Firebase Admin — JWT token verification |
| Real-Time | Socket.IO 4 |
| Billing | Stripe 20 |
| AI | Google Generative AI (Gemini 2.5 Flash) |
| File Uploads | Multer + Cloudinary |
| Email | Nodemailer (SMTP/SendGrid) |
| Scheduling | node-cron |
| Rate Limiting | express-rate-limit |

### Frontend (`nexus-frontend/`)
| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Routing | React Router v6 |
| Auth | Firebase Client SDK |
| HTTP Client | Axios (via `services/api.js`) |
| Real-Time | Socket.IO Client |
| Styling | Tailwind CSS + custom CSS |

---

## Project Structure

```
NE/
├── nexus-back/               # Express API server
│   ├── config/
│   │   ├── db.js             # Firestore client singleton
│   │   └── firebaseAdmin.js  # Firebase Admin SDK initializer
│   ├── controllers/
│   │   ├── aiController.js           # Gemini AI content generation
│   │   ├── assetController.js        # Cloudinary file uploads
│   │   ├── campaignController.js     # Campaign CRUD
│   │   ├── clientController.js       # Client CRUD + profile update
│   │   ├── messageController.js      # Chat messages
│   │   ├── serviceRequestController.js # AI Brief workflow
│   │   ├── stripeController.js       # Checkout + webhook
│   │   └── taskController.js         # Task management
│   ├── middleware/
│   │   └── authMiddleware.js  # Firebase JWT verifier (verifyToken)
│   ├── models/
│   │   ├── Campaign.js
│   │   ├── Client.js
│   │   ├── Message.js
│   │   └── Task.js
│   ├── routes/
│   │   └── api.js            # All API routes under /api
│   ├── services/
│   │   ├── adNetworkSync.js  # Cron: nightly ad network sync
│   │   └── emailService.js   # Nodemailer email templates
│   └── server.js             # Express + Socket.IO entry point
│
└── nexus-frontend/           # React SPA (Vite)
    └── src/
        ├── App.jsx            # Router setup + route guards
        ├── contexts/
        │   └── AuthContext.jsx # Global auth state + Firebase methods
        ├── services/
        │   ├── api.js          # Axios instance with auth interceptor
        │   └── firebase.js     # Firebase client config
        ├── components/
        │   ├── ProtectedRoute.jsx  # Redirects unauthenticated users
        │   └── AdminRoute.jsx      # Redirects non-admins
        └── pages/
            ├── LandingPage.jsx
            ├── Login.jsx
            ├── AdminLogin.jsx
            ├── ClientDashboard.jsx
            └── AdminDashboard.jsx
```

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- A **Firebase project** with Firestore and Authentication enabled
- A **Stripe** account (optional for billing features)
- A **Cloudinary** account (optional for asset uploads)
- A **Google Cloud** API key with Generative AI access (for AI Studio)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd NE
```

### 2. Set Up the Backend

```bash
cd nexus-back
npm install
```

Create a `.env` file in `nexus-back/`:

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:5173

# Firebase (download from Firebase Console → Project Settings → Service Accounts)
# Place the JSON file as nexus-back/firebaseServiceAccount.json

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI (Google Gemini)
GEMINI_API_KEY=AIza...

# Email (SMTP / SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG....
EMAIL_FROM="Nexus Admin <noreply@nexusproject.com>"
ADMIN_EMAIL=admin@yourcompany.com

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
npx nodemon server.js
# Server will start on http://localhost:5000
```

### 3. Set Up the Frontend

```bash
cd ../nexus-frontend
npm install
```

Create a `.env` file in `nexus-frontend/` (Vite uses `VITE_` prefix):

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Start the frontend:

```bash
npm run dev
# App will start on http://localhost:5173
```

---

## Architecture Overview

### Request Lifecycle

```
Browser → React Router → Page Component
→ Axios (api.js, injects Bearer token)
→ Express Route (routes/api.js)
→ verifyToken middleware (validates Firebase JWT)
→ Controller (business logic)
→ Firestore (Firebase)
← JSON Response
← React State Update → UI Re-render
```

### Real-Time Layer (Socket.IO)

```
Client Browser ──join_room(uid)──► Socket Room (uid)
                                         │
Admin Browser ──join_room(uid)──► admin_room
                                         │
Admin sends ──send_message──► io.to(clientId) + io.to('admin_room')
Admin assigns ──assign_task──► io.to(clientId) + io.to('admin_room')
```

### Auth & Role System

Authentication is handled entirely by **Firebase**. The backend issues no session tokens of its own.

| User Type | Email | Route Access |
|---|---|---|
| Admin | Listed in `ADMIN_EMAILS` | `/admin`, `/admin-login` |
| Client | Any other registered user | `/client` |

- **Frontend guard:** `AdminRoute.jsx` checks `isAdmin` from `AuthContext`
- **Backend guard:** `verifyToken` middleware decodes the Firebase JWT on every protected route

### Service Request / AI Brief Workflow

```
Client submits brief
    → POST /api/checkout/create-session (Stripe)
    → Stripe Checkout (card payment)
    → Webhook: checkout.session.completed
    → serviceRequest.status = 'pending_admin_review'

Admin reviews in dashboard
    → PUT /api/service-requests/:id/approve
        → serviceRequest.status = 'approved'
        → client.plan upgraded to selected tier
        → Approval email sent to client
    OR
    → PUT /api/service-requests/:id/reject
        → serviceRequest.status = 'needs_clarification'
        → adminFeedback stored for client
```

---

## Environment Variables Reference

### Backend (`nexus-back/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port. Defaults to `5000` |
| `CLIENT_URL` | Yes | Frontend URL for Stripe redirects |
| `STRIPE_SECRET_KEY` | Yes* | Stripe secret key. Without it, checkout mocks success |
| `STRIPE_WEBHOOK_SECRET` | Yes* | Stripe webhook signature secret |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key for AI content generation |
| `SMTP_HOST` | Yes* | Mail server host (e.g., `smtp.sendgrid.net`) |
| `SMTP_PORT` | No | Mail server port. Defaults to `587` |
| `SMTP_USER` | Yes* | SMTP username (`apikey` for SendGrid) |
| `SMTP_PASS` | Yes* | SMTP password / API key |
| `EMAIL_FROM` | No | Sender address. Defaults to `noreply@nexusproject.com` |
| `ADMIN_EMAIL` | No | Admin email for message notifications |
| `FRONTEND_URL` | No | Used in email links. Defaults to `http://localhost:5173` |

> \* App works but the specific feature will fail silently without this key.

---

## Available Scripts

### Backend

| Command | Description |
|---|---|
| `npx nodemon server.js` | Start dev server with hot-reload |
| `node server.js` | Start production server |
| `node test-db.js` | Test Firestore database connection |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (hot-reload on port 5173) |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the project |

---

## Subscription Tiers

Defined in `stripeController.js`:

| Tier | Monthly Price |
|---|---|
| STARTER | $199 |
| GROWTH | $299 |
| ENTERPRISE | $499 |

---

## Automated Email Triggers

| Trigger | Template | File |
|---|---|---|
| New client registers | Welcome email | `emailService.sendWelcomeEmail` |
| Admin approves brief | "AI Agent is Active!" email | `emailService.sendBriefApprovedEmail` |
| New chat message | Message notification | `emailService.sendNewMessageNotification` |

---

## Deployment

### Backend (Render / Railway)

1. Point the service to `nexus-back/`
2. Set Start Command: `node server.js`
3. Add all environment variables from the table above
4. The server binds to `0.0.0.0:PORT` — compatible with Render

### Frontend (Vercel / Netlify)

1. Point the service to `nexus-frontend/`
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Add all `VITE_` environment variables

---

## Troubleshooting

### `Unauthorized: No token provided`
The frontend `api.js` must attach the Firebase ID token as `Authorization: Bearer <token>`. Check that the Axios interceptor in `services/api.js` is correctly fetching the token via `currentUser.getIdToken()`.

### `STRIPE_SECRET_KEY is missing`
This is intentional for local dev — the backend auto-approves requests without a real Stripe key. Set `STRIPE_SECRET_KEY` in `.env` for real payments.

### `GEMINI_API_KEY is missing`
The AI Content Studio endpoint (`POST /api/ai/generate`) returns a `500` error. Add your Google AI Studio key to `nexus-back/.env`.

### Socket.IO not connecting
Ensure both the backend Socket.IO server and the frontend `socket.io-client` are pointing to the same URL and port (`http://localhost:5000` in dev).

### Emails not sending
Check your SMTP credentials. The email service fails gracefully (returns `{ success: false }`) and logs the error — it will not crash the main API.
