# 🎴 Confidential UNO

A fully on-chain UNO card game with **private hands** powered by [Inco Network](https://inco.org) confidential computing on Base Sepolia.

## ✨ Features

- **Private Card Hands**: Your cards are encrypted on-chain using Inco's confidential computing - only you can see them
- **Provably Fair**: Deck shuffling uses cryptographic randomness via `shuffledRange`
- **Multiplayer**: 2-10 players per game
- **Full UNO Rules**: Skip, Reverse, Draw 2, Wild, Wild Draw 4, UNO calls & penalties
- **Session Keys**: Sign once to create a session key - decrypt cards without signing each time
- **Wallet Connect**: Connect with Privy (supports email, social, and wallet connections)

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** with App Router
- **React 19** with Tailwind CSS
- **Privy** for wallet connection
- **wagmi + viem** for blockchain interactions
- **shadcn/ui** components

### Smart Contracts
- **Solidity** with Hardhat
- **Inco Lightning SDK** for confidential computing
- **EList** for encrypted on-chain lists
- Deployed on **Base Sepolia**

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install frontend dependencies
npm install

# Install contract dependencies
cd contracts && pnpm install
```

### Environment Setup

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_GAME_CONTRACT_ADDRESS=0xCE1Bbb81E30CeC15a2Cf9E9DA33F3C2D5d5869Fa
```

### Development

```bash
# Run the frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play!

## 📁 Project Structure

```
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Landing page
│   │   └── games/        # Game lobby & gameplay
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── uno/          # UNO game components
│   └── utils/            # Utilities & hooks
│       └── uno/          # Game logic & Inco client
├── contracts/            # Smart contracts (Hardhat)
│   ├── contracts/        # Solidity source
│   ├── ignition/         # Deployment modules
│   └── test/             # Contract tests
└── public/               # Static assets
```

## 🎮 How It Works

### Inco Confidential Computing

Inco provides **on-chain confidentiality** without FHE (Fully Homomorphic Encryption) overhead. Instead, it uses a network of covalidators to:

1. **Encrypt data** - Card values are stored encrypted on-chain
2. **Process privately** - Game logic runs on encrypted values
3. **Selective reveal** - Only card owners can decrypt their hands via signed requests

### Game Flow

1. **Create Game** → Shuffles 108-card deck cryptographically
2. **Join Game** → Players join, receive 7 encrypted cards each
3. **Start Game** → Host starts when 2+ players are ready
4. **Play** → On your turn, play matching cards or draw
5. **UNO!** → Call UNO when you have 1 card left
6. **Win** → First player to empty their hand wins!

## 📜 Smart Contract

**ConfidentialUnoGame** is deployed at:

| Network | Address |
|---------|---------|
| Base Sepolia | [`0xCE1Bbb81E30CeC15a2Cf9E9DA33F3C2D5d5869Fa`](https://sepolia.basescan.org/address/0xCE1Bbb81E30CeC15a2Cf9E9DA33F3C2D5d5869Fa) |

See [contracts/README.md](contracts/README.md) for contract documentation.

## 📄 License

MIT
