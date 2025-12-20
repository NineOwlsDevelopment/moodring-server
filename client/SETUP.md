# MoodRing Setup Guide

This guide will help you set up and run the MoodRing prediction market frontend.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000/api

# Solana Configuration
VITE_SOLANA_NETWORK=devnet
VITE_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Configuration Details

### Solana Network

The app is configured for Solana devnet by default. To change:

1. Update `VITE_SOLANA_NETWORK` in `.env`
2. Update `NETWORK` in `src/config/solana.ts`

Available networks:
- `devnet` - For development
- `testnet` - For testing
- `mainnet-beta` - For production

### Program ID

Replace `YOUR_PROGRAM_ID_HERE` in:
1. `.env` file (`VITE_PROGRAM_ID`)
2. `src/config/solana.ts` (`PROGRAM_ID`)

### Wallet Adapters

Configured wallets:
- Phantom
- Solflare

To add more wallets, edit `src/contexts/WalletContextProvider.tsx`:

```typescript
const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    // Add more wallet adapters here
  ],
  []
);
```

## Testing Admin Features

To test admin functionality:

1. Open `src/contexts/WalletContextProvider.tsx`
2. Change the role in the WalletSync component:

```typescript
setUser({
  address: publicKey.toBase58(),
  role: 'admin', // Change to 'admin'
  balance: 1000,
  joinedAt: new Date(),
});
```

3. Connect your wallet
4. Navigate to `/admin` to access admin panel

## Integrating with Your Anchor Program

### 1. Add Your IDL

Create a folder for your IDL:

```bash
mkdir -p src/idl
```

Copy your program's IDL JSON file to `src/idl/your_program.json`

### 2. Initialize Program

In your component or service file:

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { initProgram } from '@/utils/anchor';
import idl from '@/idl/your_program.json';

function YourComponent() {
  const wallet = useWallet();
  
  const program = initProgram(wallet, idl as any);
  
  // Use program for transactions
}
```

### 3. Implement Trade Logic

Update `src/components/TradeForm.tsx` to use your program:

```typescript
import { initProgram, placeTrade } from '@/utils/anchor';
import idl from '@/idl/your_program.json';

const handleTrade = async () => {
  const program = initProgram(wallet, idl as any);
  const marketPubkey = new PublicKey(market.id);
  
  try {
    const signature = await placeTrade(
      program,
      marketPubkey,
      side,
      numAmount
    );
    
    console.log('Trade successful:', signature);
    // Update UI
  } catch (error) {
    console.error('Trade failed:', error);
  }
};
```

## Connecting to Backend

### API Configuration

The Axios client is configured in `src/config/axios.ts`:

- Base URL: From `VITE_API_URL` env variable
- Timeout: 10 seconds
- Auto token injection from localStorage

### Making API Calls

```typescript
import api from '@/config/axios';

// GET request
const markets = await api.get('/markets');

// POST request
const result = await api.post('/markets', {
  title: 'New Market',
  description: 'Description',
});

// With authentication
localStorage.setItem('auth_token', 'your_token');
const profile = await api.get('/user/profile');
```

### Expected Backend Endpoints

Your backend should implement these endpoints:

```
GET    /api/markets              # Get all markets
GET    /api/markets/:id          # Get market by ID
POST   /api/markets              # Create market (admin)
PUT    /api/markets/:id          # Update market (admin)
POST   /api/markets/:id/resolve  # Resolve market (admin)

GET    /api/user/profile         # Get user profile
GET    /api/user/positions       # Get user positions
GET    /api/user/activity        # Get user activity

POST   /api/trades               # Place trade
GET    /api/trades               # Get trades
```

## Customizing Dummy Data

Edit `src/data/dummyData.ts` to:

- Add new markets
- Modify existing markets
- Change user positions
- Update categories

Example:

```typescript
export const dummyMarkets: Market[] = [
  {
    id: '9',
    title: 'Your Custom Market',
    description: 'Market description',
    category: 'crypto',
    endDate: new Date('2025-12-31'),
    volume: 500000,
    yesPrice: 0.50,
    noPrice: 0.50,
    yesShares: 250000,
    noShares: 250000,
    resolved: false,
  },
  // ... more markets
];
```

## Styling Customization

### Colors

Edit `tailwind.config.js` to change theme colors:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        // Your primary color shades
      },
      success: {
        // Your success color shades (for YES)
      },
      danger: {
        // Your danger color shades (for NO)
      },
    },
  },
},
```

### Global Styles

Edit `src/index.css` for global styles and utility classes.

## Production Build

### Build the App

```bash
npm run build
```

Output will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

### Deploy

Deploy the `dist/` folder to your hosting service:

- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

## Troubleshooting

### Wallet Connection Issues

1. Ensure you have Phantom or Solflare installed
2. Check browser console for errors
3. Try refreshing the page
4. Clear browser cache

### Build Errors

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure Node.js version is 18+

### Type Errors

1. Run `npm run build` to see TypeScript errors
2. Check `tsconfig.json` configuration
3. Ensure all dependencies are properly installed

## Development Tips

### Hot Module Replacement

Vite supports HMR - changes will reflect immediately without full page reload.

### Console Logging

Check browser console for:
- Wallet connection status
- Transaction signatures
- API responses
- Errors

### Browser Extensions

Useful extensions for development:
- React DevTools
- Redux DevTools (works with Zustand)
- Solana Wallet adapter

## Support

For issues or questions:
1. Check the README.md
2. Review the code comments
3. Check Solana documentation
4. Review Anchor documentation

## Next Steps

1. ✅ Install dependencies and start dev server
2. ✅ Configure environment variables
3. ✅ Test wallet connection
4. ✅ Browse dummy markets
5. ⬜ Add your Anchor program IDL
6. ⬜ Implement trade logic
7. ⬜ Connect to backend API
8. ⬜ Deploy to production

