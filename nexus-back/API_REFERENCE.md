# Nexus API Reference

> Base URL: `http://localhost:5000/api` (dev) | `https://your-backend.onrender.com/api` (prod)

All endpoints require a **Firebase ID Token** in the `Authorization` header, except where noted.

---

## Authentication

Every protected endpoint uses the `verifyToken` middleware (`middleware/authMiddleware.js`). It validates the Firebase JWT sent by the client and attaches the decoded user payload to `req.user`.

### Request Header (Required on all routes)

```
Authorization: Bearer <Firebase ID Token>
```

**How to obtain a token (frontend):**

```js
// services/api.js
const token = await currentUser.getIdToken();
// Axios interceptor automatically injects this header
```

**Error Responses**

| Status | Condition | Body |
|---|---|---|
| `401` | No `Authorization` header or missing `Bearer` prefix | `{ "error": "Unauthorized: No token provided" }` |
| `403` | Token is invalid, expired, or revoked | `{ "error": "Unauthorized: Invalid or expired token" }` |

---

## Rate Limiting

All routes are protected by a global rate limiter:

- **Window:** 15 minutes
- **Max requests:** 100 per IP per window
- **Response on exceeded limit:** `{ "error": "Too many requests from this IP, please try again later." }`

---

## Campaigns

### `GET /api/campaigns`
Retrieve all campaigns.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "name": "Summer Sale Push",
    "status": "active",
    "budget": 5000,
    "clientId": "firebase_uid"
  }
]
```

**Response `200` (empty)**
```json
[]
```

---

### `POST /api/campaigns`
Create a new campaign.

**Auth:** Required

**Request Body**
```json
{
  "name": "Summer Sale Push",
  "status": "active",
  "budget": 5000,
  "clientId": "firebase_uid"
}
```

**Response `201`**
```json
{
  "id": "newly_created_doc_id",
  "name": "Summer Sale Push",
  "status": "active",
  "budget": 5000,
  "clientId": "firebase_uid"
}
```

---

### `POST /api/campaigns/sync`
Manually trigger an Ad Network sync (normally runs nightly via cron).

**Auth:** Required

**Response `200`**
```json
{ "message": "Ad Networks Synced Successfully" }
```

---

## Clients

### `GET /api/clients`
Retrieve all registered clients.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "uid": "firebase_auth_uid",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "plan": "GROWTH",
    "mrr": 299,
    "campaigns": 4,
    "avatar": "A",
    "since": "Mar 2026",
    "status": "active"
  }
]
```

---

### `POST /api/clients`
Register a new client. Called automatically during user registration (`AuthContext.registerClient`).

**Auth:** Required

**Request Body**
```json
{
  "uid": "firebase_auth_uid",
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "plan": "Pending Request",
  "mrr": 0,
  "campaigns": 0,
  "since": "Mar 2026",
  "avatar": "A"
}
```

**Response `201`**
```json
{
  "id": "firestore_doc_id",
  "uid": "firebase_auth_uid",
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "plan": "Pending Request"
}
```

> **Side effect:** Triggers a welcome email to `email` via `emailService.sendWelcomeEmail`.

---

### `PUT /api/clients/:uid`
Update a client's profile data. Identified by their Firebase Auth UID.

**Auth:** Required

**URL Params**
| Param | Type | Description |
|---|---|---|
| `uid` | `string` | Firebase Auth UID of the client |

**Request Body** *(any subset of profile fields)*
```json
{
  "companyName": "Acme Corp Ltd",
  "industry": "E-commerce",
  "phone": "+1-555-0100"
}
```

**Response `200`**
```json
{ "message": "Profile Updated Successfully" }
```

**Response `404`**
```json
{ "error": "Client not found" }
```

---

## Tasks

### `GET /api/tasks`
Retrieve all tasks.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "title": "Design new landing page",
    "status": "todo",
    "clientId": "firebase_uid",
    "assignedAt": "2026-03-08T10:00:00.000Z"
  }
]
```

---

### `POST /api/tasks`
Create and assign a new task.

**Auth:** Required

**Request Body**
```json
{
  "title": "Design new landing page",
  "status": "todo",
  "clientId": "firebase_uid"
}
```

**Response `201`**
```json
{
  "id": "newly_created_doc_id",
  "title": "Design new landing page",
  "status": "todo",
  "clientId": "firebase_uid"
}
```

> **Real-time side effect:** Admin can emit `assign_task` over Socket.IO to push the task live to the client's dashboard without a page refresh.

---

### `PUT /api/tasks/:id`
Update a task (e.g., change status from `todo` → `in_progress` → `done`).

**Auth:** Required

**URL Params**
| Param | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID of the task |

**Request Body** *(any fields to update)*
```json
{
  "status": "done"
}
```

**Response `200`**
```json
{
  "message": "Task updated successfully",
  "id": "firestore_doc_id",
  "status": "done"
}
```

---

## Messages

### `GET /api/messages`
Retrieve all messages, ordered by `time` ascending.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "from": "firebase_uid_or_admin",
    "to": "firebase_uid_or_admin_room",
    "msg": "Hello, how are things progressing?",
    "type": "text",
    "time": "2026-03-08T10:05:00.000Z"
  }
]
```

---

### `POST /api/messages`
Persist a new message to Firestore.

**Auth:** Required

**Request Body**
```json
{
  "from": "firebase_uid",
  "to": "admin_room",
  "msg": "Hello, how are things progressing?",
  "type": "text"
}
```

**Response `201`**
```json
{
  "id": "newly_created_doc_id",
  "from": "firebase_uid",
  "to": "admin_room",
  "msg": "Hello, how are things progressing?",
  "time": "2026-03-08T10:05:18.231Z"
}
```

> **Side effects:**
> - If `to` is a client UID → sends email notification to that client's email
> - If `to` is `admin_room` → sends email notification to `process.env.ADMIN_EMAIL`
> - Real-time delivery happens separately via Socket.IO `send_message` event.

---

## Service Requests (AI Briefs)

Service requests represent an intake form submitted by a client describing their marketing brief. They flow through a lifecycle: `pending_payment` → `pending_admin_review` → `approved` / `needs_clarification`.

### `GET /api/service-requests`
Retrieve all service requests, ordered newest first.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "clientId": "firebase_uid",
    "clientName": "Acme Corp",
    "clientEmail": "contact@acme.com",
    "requirements": {
      "selectedTier": "GROWTH",
      "goals": "Increase brand awareness",
      "targetAudience": "B2B SaaS founders"
    },
    "status": "pending_admin_review",
    "createdAt": "2026-03-08T10:00:00.000Z"
  }
]
```

---

### `POST /api/service-requests`
Create a new service request directly (bypasses Stripe). Used for requests created outside the billing flow.

**Auth:** Required

**Request Body**
```json
{
  "clientId": "firebase_uid",
  "clientName": "Acme Corp",
  "clientEmail": "contact@acme.com",
  "requirements": {
    "selectedTier": "GROWTH",
    "goals": "Increase brand awareness"
  }
}
```

**Response `201`**
```json
{
  "id": "firestore_doc_id",
  "clientId": "firebase_uid",
  "status": "pending_admin_review",
  "createdAt": "2026-03-08T10:00:00.000Z"
}
```

---

### `PUT /api/service-requests/:id`
Update any field on a service request.

**Auth:** Required

**URL Params**
| Param | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID |

**Request Body** *(any fields to update)*
```json
{
  "requirements": { "goals": "Updated goals" }
}
```

**Response `200`**
```json
{
  "message": "Service request updated successfully",
  "id": "firestore_doc_id"
}
```

---

### `PUT /api/service-requests/:id/approve`
Admin approves an AI brief. Upgrades the client's plan tier and sends an approval email.

**Auth:** Required (Admin only — enforced in frontend, not backend)

**URL Params**
| Param | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID |

**Response `200`**
```json
{
  "message": "AI Agent Deployed & Tier Upgraded Successfully",
  "id": "firestore_doc_id"
}
```

**Side effects:**
1. Sets `serviceRequest.status = 'approved'` and `approvedAt` timestamp
2. Updates `client.plan` to the `requirements.selectedTier` (e.g., `GROWTH`)
3. Sets `client.status = 'active'`
4. Sends approval email to `clientEmail`

---

### `PUT /api/service-requests/:id/reject`
Admin rejects/sends back a brief for clarification.

**Auth:** Required (Admin only — enforced in frontend)

**URL Params**
| Param | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID |

**Request Body**
```json
{
  "feedback": "Please provide more detail about your target demographics."
}
```

**Response `200`**
```json
{
  "message": "Request sent back to client for clarification"
}
```

**Side effects:**
- Sets `serviceRequest.status = 'needs_clarification'`
- Stores `adminFeedback` on the document
- Records `rejectedAt` timestamp

---

## Billing & Stripe

### `POST /api/checkout/create-session`
Create a Stripe Checkout session for a subscription purchase. Also creates a service request in Firestore with `status: 'pending_payment'`.

**Auth:** Required

**Request Body**
```json
{
  "clientId": "firebase_uid",
  "clientEmail": "contact@acme.com",
  "clientName": "Acme Corp",
  "requirements": {
    "selectedTier": "GROWTH",
    "goals": "Scale paid ads",
    "targetAudience": "E-commerce owners"
  }
}
```

**Tier Pricing**
| Tier | Amount |
|---|---|
| `STARTER` | $199/month |
| `GROWTH` | $299/month |
| `ENTERPRISE` | $499/month |

**Response `200` (Stripe configured)**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

**Response `200` (Dev mode — no Stripe key set)**
```json
{
  "mockUrl": "http://localhost:5173/dashboard?success=true&session_id=mock_session_123"
}
```

**Response `400` (invalid tier)**
```json
{
  "error": "Invalid protocol tier selected."
}
```

---

## AI Content Generation

### `POST /api/ai/generate`
Generate AI marketing content using **Google Gemini 1.5 Flash**. Supports multiple content types in a single request.

**Auth:** Required

**Request Body**
```json
{
  "productName": "CloudSync Pro",
  "description": "A B2B SaaS tool that syncs your business data across 100+ platforms automatically.",
  "targetAudience": "Operations managers at mid-sized e-commerce companies",
  "contentType": ["marketingCopy", "seoKeywords", "blogOutline", "image"]
}
```

**`contentType` Options**
| Value | Output |
|---|---|
| `marketingCopy` | 3 ad copy variants with `hook`, `body`, `cta` |
| `seoKeywords` | 15 high-intent keyword strings |
| `blogOutline` | 5-point blog post outline |
| `image` | AI image URL via Pollinations.ai |

**Response `200`**
```json
{
  "_thinking": "The target audience cares about efficiency and reducing manual work...",
  "marketingCopy": [
    {
      "variant": "Urgency",
      "hook": "Stop wasting 10 hours a week on manual data entry.",
      "body": "CloudSync Pro connects all your tools in minutes...",
      "cta": "Try free for 14 days →"
    }
  ],
  "seoKeywords": [
    "best data sync software for ecommerce",
    "automate business operations saas"
  ],
  "blogOutline": "1. The Hidden Cost of Disconnected Tools\n2. ...",
  "imageUrl": "https://image.pollinations.ai/prompt/...?width=1024&height=768&nologo=true&seed=482031"
}
```

**Response `400`**
```json
{
  "error": "Product Name and Description are required."
}
```

**Response `500` (missing API key)**
```json
{
  "error": "GEMINI_API_KEY is missing in server environment variables."
}
```

---

## Assets

### `GET /api/assets`
Retrieve all uploaded client assets.

**Auth:** Required

**Response `200`**
```json
[
  {
    "id": "firestore_doc_id",
    "clientId": "firebase_uid",
    "name": "brand-logo.png",
    "url": "https://res.cloudinary.com/dxgzkijjo/image/upload/nexus_client_assets/...",
    "type": "image/png",
    "uploadedAt": "2026-03-08T10:00:00.000Z"
  }
]
```

---

### `POST /api/assets`
Upload a file to Cloudinary and save its metadata in Firestore.

**Auth:** Required

**Content-Type:** `multipart/form-data`

**Form Fields**
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `File` | Yes | The file to upload (image, PDF, etc.) |
| `clientId` | `string` | Yes | Firebase Auth UID of the client |
| `fileName` | `string` | No | Override display name. Defaults to original filename |

**Response `201`**
```json
{
  "id": "firestore_doc_id",
  "clientId": "firebase_uid",
  "name": "brand-logo.png",
  "url": "https://res.cloudinary.com/dxgzkijjo/...",
  "type": "image/png",
  "uploadedAt": "2026-03-08T10:05:18.231Z"
}
```

---

### `DELETE /api/assets/:id`
Delete an asset from Firestore by its document ID.

> **Note:** This only removes the Firestore record; the file remains on Cloudinary. Full cleanup requires Cloudinary's destroy API.

**Auth:** Required

**URL Params**
| Param | Type | Description |
|---|---|---|
| `id` | `string` | Firestore document ID of the asset |

**Response `200`**
```json
{ "message": "Asset deleted" }
```

---

## Real-Time (Socket.IO)

The WebSocket server runs on the same port as the HTTP server (`5000`). Connect via:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000');
```

### Events

#### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join_room` | `clientId: string` | Join a named room. Both clients and admins call this. Clients pass their UID; everyone also auto-joins `admin_room`. |
| `send_message` | `{ clientId, from, msg, type, time }` | Send a message. Broadcast to `clientId` room and `admin_room`. |
| `assign_task` | `{ id, title, clientId, status }` | Assign a task. Broadcast to `clientId` room and `admin_room`. |

#### Server → Client

| Event | Payload | Trigger |
|---|---|---|
| `receive_message` | Same as `send_message` payload | Emitted to both the client's room and `admin_room` |
| `new_task_assigned` | Same as `assign_task` payload | Emitted to both the client's room and `admin_room` |

### Example Flow (Admin sends message to client)

```js
// Admin side
socket.emit('join_room', 'admin_uid');

socket.emit('send_message', {
  clientId: 'client_firebase_uid',
  from: 'Admin',
  msg: 'Your campaign is live!',
  type: 'text',
  time: new Date().toISOString()
});

// Client side (listening)
socket.on('receive_message', (data) => {
  console.log(data.msg); // "Your campaign is live!"
});
```

---

## Email Service (Internal)

These are internal functions called automatically by controllers — they are **not exposed as API endpoints**.

| Function | Trigger | Template |
|---|---|---|
| `sendWelcomeEmail(email, name)` | `POST /api/clients` | "Welcome to Nexus!" |
| `sendBriefApprovedEmail(email, tier)` | `PUT /api/service-requests/:id/approve` | "🚀 Your AI Agent is Now Active!" |
| `sendNewMessageNotification(email, sender)` | `POST /api/messages` | "You have a new message from {sender}" |

All functions fail gracefully — they log the error but do **not** crash the API response if email delivery fails.

---

## Error Responses

All endpoints return errors in this shape:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / missing required fields |
| `401` | No authentication token provided |
| `403` | Invalid or expired token |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
