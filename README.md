# 🏪 Merchant POS - Point of Sale System

A modern, full-featured merchant POS web application (similar to PetPooja) built with **Next.js 14**, **Vercel Postgres**, and **Google Drive integration**. Designed for easy deployment on **Vercel**.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

---

## ✨ Features

### Core Features
- **🍽️ Menu Management** - Add, edit, delete menu items with category, price, and availability
- **🛒 Checkout System** - Interactive cart, quantity controls, auto-calculated totals
- **🧾 Bill Generation** - Professional invoice view with print support
- **🔐 Admin Login** - JWT-based authentication with HTTP-only cookies
- **📊 Dashboard** - Daily revenue, orders count, items sold, average order value

### Data & Reports
- **📈 Sales Reports** - Date-wise transaction reports with expandable order details
- **📥 Excel Export** - Download daily reports as styled `.xlsx` files (`orders_YYYY-MM-DD.xlsx`)
- **☁️ Google Drive Sync** - Auto-upload Excel files to Google Drive with retry mechanism
- **⏰ Daily Cron Job** - Automatic nightly sync via Vercel Cron

### Technical Highlights
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Serverless Architecture** - Fully deployable on Vercel
- **Vercel Postgres** - Persistent data storage with zero-config
- **Type-Safe** - Full TypeScript implementation

---

## 📁 Project Structure

```
merchant-pos/
├── app/
│   ├── api/
│   │   ├── auth/login/route.ts        # POST - Admin login
│   │   ├── auth/logout/route.ts       # POST - Logout
│   │   ├── menu/route.ts              # GET all items, POST new item
│   │   ├── menu/[id]/route.ts         # GET/PUT/DELETE specific item
│   │   ├── orders/route.ts            # GET orders, POST create order
│   │   ├── orders/[id]/route.ts       # GET specific order
│   │   ├── reports/daily/route.ts     # GET daily summary
│   │   ├── reports/export/route.ts    # GET download Excel
│   │   └── sync/google-drive/route.ts # POST manual sync, GET cron sync
│   ├── login/page.tsx                 # Login page
│   ├── dashboard/page.tsx             # Dashboard with stats
│   ├── menu/page.tsx                  # Menu management (CRUD)
│   ├── checkout/page.tsx              # POS checkout with cart
│   ├── reports/page.tsx               # Sales reports
│   ├── layout.tsx                     # Root layout
│   └── globals.css                    # Tailwind + custom styles
├── components/
│   └── Navbar.tsx                     # Sidebar navigation
├── lib/
│   ├── db.ts                          # Database queries (Postgres)
│   ├── auth.ts                        # JWT authentication utilities
│   ├── excel.ts                       # Excel generation (ExcelJS)
│   └── google-drive.ts               # Google Drive API client
├── scripts/
│   ├── migrate.mjs                    # Database migration script
│   └── seed.mjs                       # Seed admin user & sample menu
├── middleware.ts                      # Route protection
├── vercel.json                        # Cron job configuration
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A Vercel account (for Postgres)
- (Optional) Google Cloud project for Drive integration

### 1. Clone & Install

```bash
cd merchant-pos
npm install
```

### 2. Setup Vercel Postgres

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new project or select existing one
3. Go to **Storage** → **Create Database** → **Postgres**
4. Copy the environment variables

Alternatively, use the Vercel CLI:
```bash
npm i -g vercel
vercel link
vercel env pull .env.local
```

### 3. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

**Required variables:**
```env
# Vercel Postgres (auto-filled if using Vercel CLI)
POSTGRES_URL="postgres://..."

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Admin credentials for initial setup
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
```

**Optional (for Google Drive sync):**
```env
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="your-google-drive-folder-id"
CRON_SECRET="your-cron-secret"
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Seed Initial Data

```bash
npm run db:seed
```

This creates:
- Admin user (username: `admin`, password: `admin123`)
- 22 sample menu items across 5 categories

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploy to Vercel

### One-Click Deploy

1. Push your code to GitHub/GitLab
2. Go to [Vercel](https://vercel.com/new)
3. Import your repository
4. Add environment variables in the settings
5. Deploy!

### CLI Deploy

```bash
vercel deploy --prod
```

### Post-Deploy Setup

After first deployment, run migrations against production:
```bash
vercel env pull .env.local  # Get production env vars
npm run db:migrate
npm run db:seed
```

---

## ☁️ Google Drive Setup (Optional)

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create OAuth 2.0 Client ID**
5. Set redirect URI to `https://developers.google.com/oauthplayground`

### 2. Get Refresh Token

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click ⚙️ Settings → Check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In Step 1, select `https://www.googleapis.com/auth/drive.file`
5. Authorize → Exchange code for tokens
6. Copy the **Refresh Token**

### 3. Create Google Drive Folder

1. Create a folder in Google Drive for your POS reports
2. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

### 4. Update Environment Variables

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="your-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="your-folder-id"
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username/password |
| POST | `/api/auth/logout` | Clear auth cookie |

### Menu Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/menu` | Get all menu items |
| POST | `/api/menu` | Add new item (auth required) |
| GET | `/api/menu/[id]` | Get single item |
| PUT | `/api/menu/[id]` | Update item (auth required) |
| DELETE | `/api/menu/[id]` | Delete item (auth required) |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders?page=1&date=YYYY-MM-DD` | Get orders |
| POST | `/api/orders` | Create new order (auth required) |
| GET | `/api/orders/[id]` | Get order details |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily?date=YYYY-MM-DD` | Daily summary |
| GET | `/api/reports/export?date=YYYY-MM-DD` | Download Excel |

### Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/google-drive?date=YYYY-MM-DD` | Sync to Drive |

---

## 🗄️ Database Schema

```sql
-- users: Admin authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin'
);

-- menu_items: Restaurant menu
CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  available BOOLEAN DEFAULT true
);

-- orders: Customer orders
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- order_items: Items in each order
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  menu_item_id INTEGER REFERENCES menu_items(id),
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL
);
```

---

## 📋 Excel File Format

Each exported file follows the naming convention: `orders_YYYY-MM-DD.xlsx`

**Orders Sheet:**
| Order ID | Items | Quantity | Total Amount (₹) | Timestamp |
|----------|-------|----------|-------------------|-----------|
| ORD-20260425-0001 | Butter Chicken x2, Naan x4 | 6 | ₹940 | 25/04/2026, 12:30 PM |

**Summary Sheet:**
| Metric | Value |
|--------|-------|
| Date | 2026-04-25 |
| Total Orders | 15 |
| Total Revenue (₹) | 12,500 |
| Items Sold | 47 |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Next.js 14 (App Router) |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| Backend | Next.js API Routes (Serverless) |
| Database | Vercel Postgres |
| Auth | JWT + HTTP-only cookies |
| Excel | ExcelJS |
| Cloud Sync | Google Drive API v3 |
| Deployment | Vercel |
| Cron | Vercel Cron Jobs |

---

## 📄 License

MIT License. Free to use for personal and commercial projects.
