# Confidential UNO - Smart Contracts

A confidential UNO card game built with the **Inco Lightning SDK** for privacy-preserving gameplay on Base Sepolia.

## Overview

This contract implements a fully on-chain UNO game where:
- **Card hands are encrypted** and only visible to their owners
- **Deck shuffling** uses Inco's cryptographic `shuffledRange` 
- **Game moves** are validated on encrypted values
- **No FHE** - Inco uses covalidator network for efficient confidential computing

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file:

```env
PRIVATE_KEY_BASE_SEPOLIA=your_private_key
BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
```

### 3. Compile Contracts
```bash
pnpm hardhat compile
```

### 4. Deploy to Base Sepolia
```bash
npx hardhat ignition deploy ignition/modules/ConfidentialUnoGame.ts --network baseSepolia
```

### 5. Run Tests (Local)
```bash
docker compose up -d  # Start local Anvil + covalidator
pnpm hardhat test --network anvil
```

## Deployed Contract

| Network | Address | Explorer |
|---------|---------|----------|
| Base Sepolia | `0x5a81f4F50A6ACCA3965E4098E32f75E532556cDc` | [BaseScan](https://sepolia.basescan.org/address/0x5a81f4F50A6ACCA3965E4098E32f75E532556cDc) |

### Previous Versions
| Version | Address | Notes |
|---------|---------|-------|
| v2 | `0xCCC606643887db32cc6a398236346389Db36A088` | Fixed initial dealing ACL |
| v1 | `0xDb1b390A5197A92dD44E8De6A20fDb04d53ab605` | Initial deployment |

## How Inco Works

### What is Inco?
Inco provides **on-chain confidentiality** through a network of covalidators. Unlike FHE (Fully Homomorphic Encryption), Inco doesn't require expensive computation on encrypted data. Instead:

1. **Encrypted storage** - Values are stored encrypted on-chain (`euint256`)
2. **Covalidator network** - Trusted nodes process confidential operations
3. **Attested decryption** - Only authorized users can decrypt via signed requests
4. **EList** - Native encrypted lists for storing hands, decks, etc.

### Key Inco Features Used

| Feature | Usage |
|---------|-------|
| `euint256` | Encrypted card values |
| `elist` | Encrypted deck and player hands |
| `shuffledRange` | Cryptographic deck shuffling |
| `attestedDecrypt` | Player hand decryption |
| ACL (Access Control) | Grant decrypt permissions |

## Card Encoding

Cards are encoded as numbers 0-107:

| Range | Type | Count |
|-------|------|-------|
| 0-75 | Number cards | 76 (4 colors × 19 each) |
| 76-83 | Skip cards | 8 (2 per color) |
| 84-91 | Reverse cards | 8 (2 per color) |
| 92-99 | Draw Two cards | 8 (2 per color) |
| 100-103 | Wild cards | 4 |
| 104-107 | Wild Draw Four | 4 |

**Color mapping**: `cardId / 19` → 0=Red, 1=Yellow, 2=Green, 3=Blue

## Contract Functions

### Game Management
| Function | Description |
|----------|-------------|
| `createGame()` | Create game with shuffled deck |
| `joinGame(gameId)` | Join lobby, receive 7 cards |
| `startGame(gameId)` | Begin gameplay (host only) |
| `endGame(gameId)` | Force end game |

### Gameplay
| Function | Description |
|----------|-------------|
| `commitMove(gameId, handIndex, chosenColor)` | Play a card |
| `drawCard(gameId)` | Draw from deck |
| `callUno(gameId)` | Call UNO before last card |
| `penalizeUno(gameId)` | Penalize player who forgot UNO |

### View Functions
| Function | Description |
|----------|-------------|
| `getGame(gameId)` | Get public game state |
| `getPlayerHandSize(gameId, player)` | Get hand size |
| `getCardFromHand(gameId, player, index)` | Get encrypted card handle |
| `getUnoWindow(gameId)` | Check UNO penalty window |

### Fee Calculation
| Function | Description |
|----------|-------------|
| `getGameCreationFee()` | Fee to create game |
| `getJoinGameFee()` | Fee to join game |
| `getDrawCardFee()` | Fee to draw a card |
| `getCommitMoveFee()` | Fee to play a card |

## Events

```solidity
event GameCreated(uint256 indexed gameId, address creator, uint16 initialTopCardId);
event PlayerJoined(uint256 indexed gameId, address player);
event GameStarted(uint256 indexed gameId);
event MoveCommitted(uint256 indexed gameId, address player, uint16 cardId, uint8 cardType, uint8 chosenColor, address nextPlayer);
event CardDrawn(uint256 indexed gameId, address player);
event UnoCall(uint256 indexed gameId, address player);
event UnoPenalty(uint256 indexed gameId, address penalized, address penalizer);
event GameEnded(uint256 indexed gameId, address winner);
```

## Development

### Local Testing Setup

```bash
# Start local infrastructure
docker compose up -d

# Run all tests
pnpm hardhat test --network anvil

# Run specific test
pnpm hardhat test test/ConfidentialERC20.test.ts --network anvil
```

### Useful Commands

```bash
# Compile with size output
pnpm hardhat compile --force

# Deploy with verbose output
npx hardhat ignition deploy ignition/modules/ConfidentialUnoGame.ts --network baseSepolia --verbose

# Verify on BaseScan
npx hardhat verify --network baseSepolia CONTRACT_ADDRESS
```

## Security Considerations

1. **ACL Permissions** - The contract grants decrypt permissions only to:
   - Card owners (for their hand)
   - All players (for top card)

2. **Random Shuffling** - Deck uses Inco's `shuffledRange` which provides cryptographic randomness from the covalidator network

3. **Turn Validation** - All moves are validated on-chain (correct turn, valid card match)

## License

MIT
