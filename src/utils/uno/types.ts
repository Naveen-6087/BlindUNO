// UNO Game Types and Utilities

// Game status enum matching the contract
export enum GameStatus {
  NotStarted = 0,
  Started = 1,
  Ended = 2,
}

// UNO card colors
export type CardColor = "red" | "yellow" | "green" | "blue" | "wild";

// UNO card values
export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

// UNO card interface
export interface UnoCard {
  id: number;
  color: CardColor;
  value: CardValue;
}

// Game state interface
export interface GameState {
  id: bigint;
  status: GameStatus;
  players: readonly `0x${string}`[];
  currentPlayerIndex: bigint;
  deckRemaining: number;
  direction: boolean; // true = clockwise
  topCard: bigint | null;
  topCardId: number; // Plaintext top card ID for validation
  currentColor: number; // 0=Red, 1=Yellow, 2=Green, 3=Blue
  winner: `0x${string}` | null;
  pendingDraws: number; // Cards next player must draw
  moveCount: number;
  gameHash: `0x${string}` | null;
}

// Player game info
export interface PlayerGameInfo {
  isInGame: boolean;
  handSize: number;
  hasDrawn: boolean;
}

// Card ID to Card mapping - UNO deck has 108 cards
// Contract Card Encoding (matching ConfidentialUnoGame.sol):
// - Cards 0-75: Number cards (4 colors × 19 cards each)
//   - Color = cardId / 19 (0=Red, 1=Yellow, 2=Green, 3=Blue)
//   - Value = 0 appears once, 1-9 appear twice (so 19 cards per color)
// - Cards 76-83: Skip cards (2 per color) - color = (cardId - 76) / 2
// - Cards 84-91: Reverse cards (2 per color) - color = (cardId - 84) / 2
// - Cards 92-99: Draw Two cards (2 per color) - color = (cardId - 92) / 2
// - Cards 100-103: Wild cards (4 total) - no color
// - Cards 104-107: Wild Draw Four cards (4 total) - no color

const COLORS: CardColor[] = ["red", "yellow", "green", "blue"];

export function cardIdToCard(cardId: number): UnoCard {
  // Wild Draw Four: 104-107
  if (cardId >= 104) {
    return { id: cardId, color: "wild", value: "wild4" };
  }

  // Wild: 100-103
  if (cardId >= 100) {
    return { id: cardId, color: "wild", value: "wild" };
  }

  // Draw Two: 92-99 (2 per color)
  if (cardId >= 92) {
    const colorIndex = Math.floor((cardId - 92) / 2);
    return { id: cardId, color: COLORS[colorIndex], value: "draw2" };
  }

  // Reverse: 84-91 (2 per color)
  if (cardId >= 84) {
    const colorIndex = Math.floor((cardId - 84) / 2);
    return { id: cardId, color: COLORS[colorIndex], value: "reverse" };
  }

  // Skip: 76-83 (2 per color)
  if (cardId >= 76) {
    const colorIndex = Math.floor((cardId - 76) / 2);
    return { id: cardId, color: COLORS[colorIndex], value: "skip" };
  }

  // Number cards: 0-75 (19 per color)
  // Each color has: 0 (once), 1-9 (twice each) = 19 cards
  const colorIndex = Math.floor(cardId / 19);
  const posInColor = cardId % 19;
  const color = COLORS[colorIndex];

  let value: CardValue;
  if (posInColor === 0) {
    value = "0";
  } else if (posInColor <= 9) {
    value = posInColor.toString() as CardValue;
  } else {
    // 10-18 map to 1-9 (second occurrence)
    value = (posInColor - 9).toString() as CardValue;
  }

  return { id: cardId, color, value };
}

// Card to ID - reverse mapping (matching contract encoding)
// This function is mostly for reference - the card.id already contains the correct ID
export function cardToId(card: UnoCard): number {
  // For cards, the id is already stored correctly
  return card.id;
}

// Color styling for cards
export const CARD_COLORS: Record<CardColor, { bg: string; border: string; text: string; shadow: string }> = {
  red: {
    bg: "bg-red-500",
    border: "border-red-700",
    text: "text-white",
    shadow: "shadow-red-500/30",
  },
  yellow: {
    bg: "bg-yellow-400",
    border: "border-yellow-600",
    text: "text-yellow-900",
    shadow: "shadow-yellow-500/30",
  },
  green: {
    bg: "bg-green-500",
    border: "border-green-700",
    text: "text-white",
    shadow: "shadow-green-500/30",
  },
  blue: {
    bg: "bg-blue-500",
    border: "border-blue-700",
    text: "text-white",
    shadow: "shadow-blue-500/30",
  },
  wild: {
    bg: "bg-gray-900",
    border: "border-gray-700",
    text: "text-white",
    shadow: "shadow-gray-500/30",
  },
};

// Display values for special cards
export const CARD_VALUE_DISPLAY: Record<CardValue, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  skip: "⊘",
  reverse: "⟲",
  draw2: "+2",
  wild: "W",
  wild4: "+4",
};

// Format address for display
export function formatAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Check if address is a bot (contract-defined bot address pattern)
export function isBotAddress(address: `0x${string}`): boolean {
  // The contract uses address(0xB07) for bots
  const botAddressHex = "0x0000000000000000000000000000000000000b07";
  return address.toLowerCase() === botAddressHex;
}

// Check if a card can be played on top of another card
export function canPlayCard(card: UnoCard, topCard: UnoCard): boolean {
  // Wild cards can always be played
  if (card.color === "wild") return true;

  // Same color
  if (card.color === topCard.color) return true;

  // Same value
  if (card.value === topCard.value) return true;

  return false;
}
