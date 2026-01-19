// UNO Game Constants

// UNO Game Contract address on Inco 
export const UNO_GAME_ADDRESS = "0xCE1Bbb81E30CeC15a2Cf9E9DA33F3C2D5d5869Fa" as const;

// Session Verifier address for Inco
export const SESSION_VERIFIER_ADDRESS = "0xc34569efc25901bdd6b652164a2c8a7228b23005" as const;

// Base Sepolia Chain ID
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Inco Lightning RPC endpoint 
export const INCO_RPC_URL = "https://testnet.inco.org" as const;

// Contract ABI for ConfidentialUnoGame - MULTIPLAYER ONLY (no bot)
export const UNO_GAME_ABI = [
  // ============ View Functions ============
  {
    type: "function",
    name: "DECK_SIZE",
    inputs: [],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "INITIAL_HAND_SIZE",
    inputs: [],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_PLAYERS",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveGames",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNotStartedGames",
    inputs: [],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "players", type: "address[]" },
      { name: "status", type: "uint8" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "gameHash", type: "uint256" },
      { name: "moveCount", type: "uint16" },
      { name: "topCard", type: "uint256" },
      { name: "topCardId", type: "uint16" },
      { name: "deckRemaining", type: "uint16" },
      { name: "currentPlayerIndex", type: "uint256" },
      { name: "direction", type: "int8" },
      { name: "currentColor", type: "uint8" },
      { name: "winner", type: "address" },
      { name: "pendingDraws", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHandSize",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllPlayerHandSizes",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "sizes", type: "uint16[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPlayerHand",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCardFromHand",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
      { name: "index", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  // getDeck removed for security - deck structure should not be exposed
  {
    type: "function",
    name: "getMoves",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCurrentColor",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTopCardId",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasPlayerCalledUno",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "canPenalizePlayer",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "target", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isUnoWindowOpen",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUnoWindowPlayer",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  // ============ Fee Functions ============
  {
    type: "function",
    name: "getEncryptionFee",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getCreateGameFee",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getJoinGameFee",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "pure",
  },
  // ============ Game Actions ============
  {
    type: "function",
    name: "createGame",
    inputs: [
      { name: "_creator", type: "address" },
      { name: "initialTopCardId", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "joinGame",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "_joinee", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "deleteGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startGame",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "commitMove",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "cardIndex", type: "uint16" },
      { name: "revealedCardId", type: "uint16" },
      { name: "chosenColor", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "drawCard",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "endTurn", type: "bool" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "callUno",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "penalizeUno",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "target", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "isCardPlayable",
    inputs: [
      { name: "cardId", type: "uint16" },
      { name: "topCardId", type: "uint16" },
      { name: "currentColor", type: "uint8" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "getCardInfo",
    inputs: [{ name: "cardId", type: "uint16" }],
    outputs: [
      { name: "cardType", type: "uint8" },
      { name: "color", type: "uint8" },
      { name: "value", type: "uint8" },
    ],
    stateMutability: "pure",
  },
  // ============ Events ============
  {
    type: "event",
    name: "GameCreated",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: false },
      { name: "initialTopCardId", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerJoined",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameDeleted",
    inputs: [{ name: "gameId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "GameStarted",
    inputs: [{ name: "gameId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "MoveCommitted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "cardId", type: "uint16", indexed: false },
      { name: "cardType", type: "uint8", indexed: false },
      { name: "chosenColor", type: "uint8", indexed: false },
      { name: "pendingDraws", type: "uint8", indexed: false },
      { name: "skipNext", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CardDrawn",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "cardsDrawn", type: "uint16", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CardsForceDrawn",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "cardsDrawn", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GameEnded",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TurnChanged",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "newPlayer", type: "address", indexed: true },
      { name: "pendingDraws", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DirectionChanged",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "newDirection", type: "int8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PlayerSkipped",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "skippedPlayer", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UnoCalled",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UnoPenalty",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "cardsPenalty", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "UnoWindowOpened",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "UnoWindowClosed",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "DeckReshuffled",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "cardsReshuffled", type: "uint16", indexed: false },
    ],
  },
] as const;

// Color names for display
export const COLOR_NAMES = ["Red", "Yellow", "Green", "Blue", "Wild"] as const;
export const COLOR_HEX = {
  red: "#EF4444",
  yellow: "#EAB308",
  green: "#22C55E",
  blue: "#3B82F6",
  wild: "#6B7280",
} as const;
