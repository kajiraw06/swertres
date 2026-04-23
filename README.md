# 🎱 Swertres Online — 3D Lotto Betting System

A complete online betting platform for Swertres (3D Lotto) that:
- Lets bettors place bets and pay via **GCash**
- Automatically fetches winning numbers from the **official PCSO website**
- Automatically credits winners after each draw

---

## ⚠️ IMPORTANT LEGAL NOTICE

Operating this system requires that your father is a **duly authorized PCSO agent or cooperative operator**.
Unauthorized operation of a numbers game is illegal in the Philippines under RA 9287.
Obtain proper authorization from PCSO before going live.

---

## 📁 Project Structure

```
Swertres/
├── backend/          ← Node.js + Express API server
├── frontend/         ← React web app (mobile-friendly)
└── database/
    └── schema.sql    ← MySQL database schema
```

---

## 🛠️ Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v18 or later |
| MySQL | v8 or later |
| npm | v9 or later |

---

## 🚀 Setup Guide

### Step 1 — Install MySQL & create the database

```sql
-- Run in MySQL Workbench or terminal:
mysql -u root -p < database/schema.sql
```

### Step 2 — Configure the backend

```bash
cd backend
copy .env.example .env
```

Edit `.env` and fill in:
- `DB_PASSWORD` — your MySQL root password
- `JWT_SECRET` — any long random string (e.g. 64 random characters)
- `PAYMONGO_SECRET_KEY` — from your PayMongo dashboard (see below)
- `PAYMONGO_WEBHOOK_SECRET` — from your PayMongo webhook settings
- `ADMIN_PHONE`, `ADMIN_PASSWORD`, `ADMIN_NAME` — your admin login

### Step 3 — Install dependencies & setup database

```bash
cd backend
npm install
npm run setup-db     # creates tables + admin account
```

### Step 4 — Start the backend

```bash
npm run dev          # development (auto-restart)
# or
npm start            # production
```

Backend runs on **http://localhost:5000**

### Step 5 — Setup the frontend

```bash
cd frontend
npm install
npm start
```

Frontend opens at **http://localhost:3000**

---

## 💚 GCash Payment Setup (PayMongo)

1. Go to **https://dashboard.paymongo.com** and create a free account
2. Get your **Secret Key** (`sk_test_...`) and **Public Key** (`pk_test_...`)
3. Go to **Developers → Webhooks**, add a webhook URL:
   ```
   https://YOUR-DOMAIN.com/api/payments/webhook
   ```
   Enable the `source.chargeable` event
4. Copy the **Webhook Secret** (`whsec_...`)
5. Paste all three into your `.env` file

> For local testing, use [ngrok](https://ngrok.com) to expose your localhost to the internet for webhooks.

---

## 🕐 How the System Works

### Betting Flow
1. Bettor registers with their phone number
2. They deposit money via GCash (minimum ₱50)
3. They pick 3 digits + draw time (2PM / 5PM / 9PM) + bet type
4. Their wallet is deducted immediately

### Result Checking (Automatic)
- The system has scheduled jobs that run at **2:05 PM, 5:05 PM, and 9:05 PM** daily
- It fetches the official results from **https://www.pcso.gov.ph/searchlottoresult.aspx**
- Winners are automatically detected and prize money is credited to their wallet

### Bet Types & Prizes (per ₱10 bet)
| Type | Condition | Prize |
|------|-----------|-------|
| **Straight** | Exact 3-digit match (e.g. 1-2-3) | ₱4,500 |
| **Rambolito** | Any order match (e.g. 3-2-1, 2-1-3) | ₱750–₱1,500 |

### Bet Cutoff Times
| Draw | Cutoff |
|------|--------|
| 2PM  | 1:30 PM |
| 5PM  | 4:30 PM |
| 9PM  | 8:30 PM |

---

## 👨‍💼 Admin Features

Login with the admin account to access `/admin`:
- View live dashboard (total users, bets today, deposits today)
- Search and manage bettors
- Enable/disable accounts
- Manually credit balance (for cash payments in person)
- View all bets by date

---

## 🔗 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/register | Register new bettor |
| POST | /api/auth/login | Login |
| GET  | /api/auth/me | Get current user info |
| GET  | /api/bets | Get my bets |
| POST | /api/bets | Place a bet |
| GET  | /api/bets/available-draws | Today's open draws |
| GET  | /api/draws | Get results by date |
| GET  | /api/draws/recent | Last 7 days results |
| POST | /api/payments/deposit | Create GCash deposit link |
| GET  | /api/payments/history | Transaction history |
| POST | /api/payments/webhook | PayMongo webhook |
| GET  | /api/admin/dashboard | Admin stats |
| GET  | /api/admin/users | Manage users |
| POST | /api/admin/credit | Manually credit user |

---

## 🔒 Security Features

- Passwords are hashed with bcrypt
- JWT authentication on all protected routes
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- PayMongo webhook signature verification
- SQL injection prevention via Sequelize ORM
- Input validation on all endpoints

---

## 📱 Going Live (Deployment Tips)

1. Deploy backend to a VPS (e.g. DigitalOcean, Hostinger VPS)
2. Build frontend: `cd frontend && npm run build` then serve with nginx
3. Use PM2 to keep backend running: `pm2 start backend/server.js`
4. Get an SSL certificate (Let's Encrypt is free)
5. Set `NODE_ENV=production` and use production PayMongo keys (`sk_live_...`)
6. Point PayMongo webhook to your live HTTPS domain
