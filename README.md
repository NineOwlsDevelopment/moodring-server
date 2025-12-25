# MoodRing

<div align="center">
  <a href="https://moodring.io">
    <img src="client/public/icon.png" alt="MoodRing Logo" width="200"/>
  </a>
  <br />
  <br />
  <a href="https://moodring.io">🌐 Visit MoodRing.io</a>
</div>

<br />

A Solana-native prediction market platform with deep LMSR liquidity and instant settlement. Trade on future events with YES/NO binary option markets.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Blockchain**: Solana (Web3.js + Anchor)
- **Real-time**: WebSocket (Socket.io)
- **Wallet Integration**: Solana Wallet Adapter + Circle Wallets

## Features

- 🔐 Solana wallet integration (Phantom, Solflare, etc)
- 📊 Real-time prediction markets with LMSR liquidity
- 💼 Portfolio management and trading history
- 🎯 YES/NO binary markets
- 👨‍💼 Admin panel for market management
- ⚡ Real-time updates via WebSocket
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Solana wallet (for frontend)
- Circle API credentials (for user wallets)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/NineOwlsDevelopment/moodring-server
cd moodring-server
```

2. Install dependencies:

```bash
# Backend
cd src
yarn install

# Frontend
cd ../client
yarn install
```

3. Configure environment variables:

   - Backend: Copy `src/.env.production.example` to `src/.env`
   - Frontend: Create `client/.env` with your API URL

4. Run database migrations:

```bash
cd src/scripts
chmod+x migrate.sh
./migrate.sh
```

5. Start the development servers:

```bash
# Backend (from src/)
yarn run dev

# Frontend (from client/)
yarn run dev
```

## Demo Video

https://www.loom.com/share/1288ac9a99094b8ab9d22977756ada30

## Project Structure

```
moodring_app/
├── client/          # React frontend
├── src/             # Express backend
│   ├── controllers/ # Route controllers
│   ├── models/      # Database models
│   ├── routes/      # API routes
│   ├── services/    # Business logic
│   └── migrations/  # Database migrations
```

## License

ISC
