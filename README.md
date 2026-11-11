# Aroma Coffee Shop Management System

A full-stack starter project for the Coffee Shop Management System assignment.

## Technologies
- React + Vite (frontend)
- Express.js (REST API)
- Fetch API
- Upstash Redis (Serverless NoSQL database via `redis` client)  
- Redis-backed menu and orders
- GitHub
- Vercel/Netlify (frontend hosting)
- Render (backend hosting)

## Features
- Customer menu with Maloti prices
- Shopping cart and checkout
- Order numbers formatted as `V0001`, `V0002`, ...
- Upstash Redis-backed menu and orders
- Staff login and protected staff API routes
- Add/update/delete menu items
- View orders and update order status
- Daily order summary
- Health endpoint and request validation

## Requirements
- Node.js 20 or newer recommended
- Upstash Redis database account & connection URL (`REDIS_URL`)

## 1. Set up Upstash Redis Database

Create a free Redis database at [Upstash](https://upstash.com/):

1. Sign up/log in to Upstash and click **Create Database**.
2. Name your database (e.g., `aroma-coffee-db`) and select a region close to your backend hosting.
3. Once created, copy the **`REDIS_URL`** connection string (it looks like `rediss://default:your_password@your-host.upstash.io:6379`).

Data Structures stored in Redis:
- `menu:items` — JSON string or Redis Hash storing menu product details and availability.
- `orders:counter` — Redis INCR counter generating sequential order numbers (`1`, `2`, ...).
- `order:V0001`, `order:V0002` — JSON string or Redis Hash storing customer order details, status, and items.
- `orders:all` — Redis Set or List indexing all created order IDs.

The public order ID is generated using Redis's atomic `INCR orders:counter` command, formatted as `V0001`, `V0002`, etc. Atomic increment guarantees unique order numbers even under concurrent requests.

## 2. Start the backend

Open a terminal in `backend/`:

```bash
npm install
```

Copy `.env.example` to `.env` and enter your Upstash Redis connection string and strong staff/JWT secrets. Do not commit `.env`.

```bash
REDIS_URL=rediss://default:your_password@your-host.upstash.io:6379
```

Run the backend:

```bash
npm run dev
```

The backend runs on `http://localhost:5000` by default. Test `http://localhost:5000/api/health`; the response should identify Redis as the active database. The backend automatically seeds initial menu items into Redis if `menu:items` is empty.

## 3. Start the frontend

Open a second terminal in `frontend/`:

```bash
npm install
```

Copy `.env.example` to `.env` (the default API URL works for local development).

```env
VITE_API_URL=http://localhost:5000
```

Then run:

```bash
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173`.

## 4. Staff login

Set `STAFF_USERNAME`, `STAFF_PASSWORD`, and `JWT_SECRET` in `backend/.env`. Use the same username and password in the Staff Login section of the website.

This is an assignment-level login. For a production system, use proper user password hashing, rate limiting, HTTPS, secure token handling, and audit logs.

## 5. API endpoints

### Public
- `GET /api/health`
- `GET /api/menu`
- `GET /api/menu/:id`
- `POST /api/orders`
- `GET /api/orders/:id` (limited public order view)

### Staff-authenticated
- `POST /api/staff/login`
- `GET /api/orders`
- `GET /api/staff/summary`
- `POST /api/menu`
- `PUT /api/menu/:id`
- `DELETE /api/menu/:id`
- `PATCH /api/orders/:id/status`

### Order statuses
`Pending` → `Preparing` → `Ready` → `Collected`

## 6. Deployment

### Upstash Redis
Ensure your Upstash Redis database is active and accessible. Copy your `REDIS_URL` into your backend hosting provider's environment variables.

### Backend on Render
- Create a Web Service connected to the GitHub repository.
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add environment variables from `backend/.env.example`, using your `REDIS_URL`, secrets, and configuration settings.
- Set `FRONTEND_ORIGIN` to the deployed frontend URL.
- Test `https://YOUR-BACKEND-URL/api/health`.

### Frontend on Vercel or Netlify
- Import the same GitHub repository.
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` to the deployed backend URL, without a trailing slash.
- Deploy and test the full workflow.

## 7. GitHub safety and final testing

Never commit `.env`, Redis passwords, or JWT secrets. Keep `.env.example` values as placeholders only.

Before submission:
- Test invalid inputs and failed requests.
- Test placing an order and confirm its ID starts with `V`.
- Test staff-only actions without logging in; they should fail.
- Restart the backend and confirm menu and orders persist in Upstash Redis.
- Capture screenshots of the menu, cart, confirmation, staff dashboard, and Upstash Redis Data Browser.
- Complete the group contribution report honestly.