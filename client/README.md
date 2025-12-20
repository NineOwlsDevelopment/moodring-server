# MoodRing - Prediction Market Frontend

A Kalshi-style prediction market platform built on Solana with React, TypeScript, and Tailwind CSS.

## Features

- 🔐 Solana wallet integration (Phantom, Solflare)
- 📊 Real-time prediction markets
- 💼 Portfolio management
- 🎯 YES/NO binary markets
- 👨‍💼 Admin panel for market management
- 📱 Responsive design
- ⚡ Built with Vite for fast development

## Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router DOM v6
- **Blockchain**: Solana Web3.js + Anchor
- **Wallet**: Solana Wallet Adapter
- **HTTP Client**: Axios
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A Solana wallet (Phantom or Solflare)

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd moodring-client
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOLANA_NETWORK=devnet
VITE_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
```

5. Start the development server:

```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── MarketCard.tsx
│   └── TradeForm.tsx
├── contexts/         # React contexts (Wallet provider)
├── config/           # Configuration files (Solana, Axios)
├── data/             # Dummy data for development
├── layouts/          # Layout components (Public, Private, Admin)
├── pages/            # Page components
│   ├── Home.tsx
│   ├── Markets.tsx
│   ├── MarketDetail.tsx
│   ├── Portfolio.tsx
│   ├── Activity.tsx
│   └── admin/        # Admin pages
├── stores/           # Zustand stores
│   ├── walletStore.ts
│   ├── userStore.ts
│   └── marketStore.ts
├── utils/            # Utility functions
├── App.tsx           # Main app component with routing
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features Overview

### Public Routes

- **Home** (`/`) - Landing page with featured markets
- **Markets** (`/markets`) - Browse all markets with category filters
- **Market Detail** (`/market/:id`) - View market details and place trades

### Private Routes (Wallet Required)

- **Portfolio** (`/portfolio`) - View your positions and P&L
- **Activity** (`/activity`) - View your trading history

### Admin Routes (Admin Role Required)

- **Dashboard** (`/admin`) - Platform statistics
- **Markets** (`/admin/markets`) - Manage markets
- **Users** (`/admin/users`) - Manage users
- **Settings** (`/admin/settings`) - Platform settings

## Connecting to Your Backend

The project uses Axios for API calls. Configure your backend URL in `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

API client is configured in `src/config/axios.ts` with automatic token injection.

## Connecting to Solana Program

Update your Anchor program ID in `src/config/solana.ts`:

```typescript
export const PROGRAM_ID = "YOUR_ACTUAL_PROGRAM_ID";
```

The Anchor client setup is ready. Import IDL and initialize the program:

```typescript
import { Program } from "@coral-xyz/anchor";
import { getProvider } from "@/config/solana";

// Initialize your program
const provider = getProvider(wallet);
const program = new Program(IDL, PROGRAM_ID, provider);
```

## Customization

### Change to Admin Role

To test admin features, modify `src/contexts/WalletContextProvider.tsx`:

```typescript
setUser({
  address: publicKey.toBase58(),
  role: "admin", // Change from 'user' to 'admin'
  balance: 1000,
  joinedAt: new Date(),
});
```

### Add New Markets

Edit `src/data/dummyData.ts` to add new markets or modify existing ones.

### Styling

Tailwind CSS is configured with custom colors:

- Primary: Blue tones
- Success: Green tones (for YES)
- Danger: Red tones (for NO)

Customize in `tailwind.config.js`.

## Next Steps

1. **Integrate with your Anchor program**:

   - Add your program IDL
   - Implement trade execution
   - Add market creation
   - Implement market resolution

2. **Connect to backend**:

   - User authentication
   - Market data fetching
   - Transaction history
   - Real-time updates

3. **Add features**:
   - Market charts
   - Order book
   - Notifications
   - Advanced trading features

## License

MIT
