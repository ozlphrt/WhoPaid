# WhoPaid 💳✨

> Fast, mobile-first multi-currency group expense tracker and settlement manager designed for trips, holidays, and shared households.

[![Live Demo](https://img.shields.io/badge/Live_Demo-WhoPaid-10b981?style=for-the-badge)](https://ozlphrt.github.io/WhoPaid/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-18181b?style=for-the-badge&logo=github)](https://github.com/ozlphrt/WhoPaid)

---

## 🚀 Live Demo

You and your friends can test the live application directly in your browser or install it as a PWA on mobile:

👉 **[https://ozlphrt.github.io/WhoPaid/](https://ozlphrt.github.io/WhoPaid/)**

---

## ✨ Features

- **Mobile-First Luxury UI**: Dual theme support (**☀️ Light Mode** and **🌙 Neutral Space Gray Dark Mode**) with one-tap toggle.
- **Smart Settlements**: Greedy min-transfers algorithm to settle group debts with the fewest possible transactions.
- **Household / Couple Grouping**: Combined balances for couples (e.g., *Ozalp + Betül*, *Erhan + Janna*).
- **Multi-Currency & Real-Time FX**: Automatic ECB historical rates via Frankfurter API with offline fallback tables and human-readable format (`1 EUR = 48.00 TRY`).
- **Flexible Splitting**: Equal split, custom percentage/amount splits, and multi-payer support.
- **Exclusion Lists & Participation Review**: Audit non-participating members across expenses (by persona or by expense) directly in the Trip Summary tab.
- **Offline First & PWA**: IndexedDB storage via Dexie.js with cloud sync status indicator and offline support.
- **Audit History & Activity Log**: Full chronological feed of expenses, edits, deletions, and settlements.
- **Export & Reports**: Instant PDF summary reports and CSV transaction exports.

---

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Pure Vanilla CSS Design System with CSS variables & responsive layout
- **Backend**: Supabase Auth + PostgreSQL + Realtime
- **Offline Cache**: Dexie.js (IndexedDB)
- **Icons**: Custom SVG Glyphs + Lucide Icons
- **PWA**: vite-plugin-pwa + Workbox

---

## 💻 Local Development

```bash
# Clone repository
git clone https://github.com/ozlphrt/WhoPaid.git

# Navigate into directory
cd WhoPaid

# Install dependencies
npm install

# Configure the public Supabase client values
copy .env.example .env.local

# Apply supabase/migrations/202608210001_initial_schema.sql to the project

# Start local dev server
npm run dev
```

## 🔐 Security and testing

Run the unit suite with `npm test` and the production build with `npm run build`.

See [SECURITY.md](./SECURITY.md) for the PostgreSQL access model and deployment checklist.
