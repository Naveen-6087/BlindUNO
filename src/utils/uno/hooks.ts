"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useWalletClient,
} from "wagmi";
import { UNO_GAME_ADDRESS, UNO_GAME_ABI } from "./constants";
import { type UnoCard, cardIdToCard, type GameState, GameStatus } from "./types";
import { batchDecrypt, type IncoSession } from "./incoClient";
import type { HexString } from "@inco/js";

// Re-export for use in UnoGame component
export type SessionKeyParams = IncoSession | null;

// Hook to fetch active games
export function useActiveGames() {
  return useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getActiveGames",
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });
}

// Hook to fetch not started games (lobbies)
export function useNotStartedGames() {
  return useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getNotStartedGames",
    query: {
      refetchInterval: 5000,
    },
  });
}

// Hook to fetch game state using getGame function
export function useGameState(gameId: bigint | null) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getGame",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: gameId !== null,
      refetchInterval: 3000, // More frequent updates for active game
    },
  });

  // Transform data to GameState
  // getGame returns: (id, players, status, startTime, endTime, gameHash, moveCount, topCard, topCardId, deckRemaining, currentPlayerIndex, direction, currentColor, winner, pendingDraws)
  const gameState: GameState | null =
    data && gameId
      ? {
          id: data[0] as bigint,
          status: data[2] as GameStatus,
          players: data[1] as readonly `0x${string}`[],
          currentPlayerIndex: data[10] as bigint,
          direction: (data[11] as number) === 1, // 1 = clockwise (true), -1 = counter-clockwise (false)
          deckRemaining: Number(data[9]),
          moveCount: Number(data[6]),
          topCard: data[7] ? (data[7] as bigint) : null,
          topCardId: Number(data[8]), // Plaintext top card ID from contract
          currentColor: Number(data[12]),
          winner: data[13] as `0x${string}` | null,
          pendingDraws: Number(data[14]),
          gameHash: data[5] ? `0x${(data[5] as bigint).toString(16)}` as `0x${string}` : null,
        }
      : null;

  return { data: gameState, isLoading, error, refetch };
}

// Hook to fetch and decrypt player's hand
export function usePlayerHand(
  gameId: bigint | null,
  sessionKey: SessionKeyParams
) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [hand, setHand] = useState<UnoCard[]>([]);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  
  // Track last decrypted handles to avoid re-decrypting unchanged data
  const lastDecryptedHandlesRef = useRef<string>("");

  // Hook to fetch hand size - using getPlayerHandSize
  const { data: handSize, refetch: refetchHandSize } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getPlayerHandSize",
    args: gameId && address ? [gameId, address] : undefined,
    query: {
      enabled: gameId !== null && !!address,
      refetchInterval: 5000,
    },
  });
  
  // Generate contract calls for all cards in hand
  const cardContractCalls = gameId && address && handSize ? 
    Array.from({ length: Number(handSize) }, (_, i) => ({
      address: UNO_GAME_ADDRESS,
      abi: UNO_GAME_ABI,
      functionName: "getCardFromHand" as const,
      args: [gameId, address, i] as const,
    })) : [];

  // Fetch all card handles from the contract
  const { data: cardHandlesData, refetch: refetchCardHandles } = useReadContracts({
    contracts: cardContractCalls,
    query: {
      enabled: cardContractCalls.length > 0,
      refetchInterval: 5000,
    },
  });

  // Decrypt hand when card handles are available
  const decryptHand = useCallback(async () => {
    if (!gameId || !address || !cardHandlesData || cardHandlesData.length === 0) {
      return;
    }
    
    // Extract successful card handles
    const cardHandles: HexString[] = cardHandlesData
      .filter(result => result.status === 'success' && result.result)
      .map(result => `0x${(result.result as bigint).toString(16).padStart(64, '0')}` as HexString);
    
    if (cardHandles.length === 0) {
      setHand([]);
      return;
    }
    
    // Create a hash of handles to check if we need to re-decrypt
    const handlesHash = cardHandles.join(',');
    if (handlesHash === lastDecryptedHandlesRef.current && hand.length > 0) {
      // Handles haven't changed, skip decryption
      return;
    }

    setIsDecrypting(true);
    setDecryptError(null);

    try {
      // Batch decrypt all card handles using session or wallet
      const decryptedValues = await batchDecrypt(
        cardHandles,
        sessionKey, // sessionKey is already IncoSession | null
        walletClient ?? null
      );
      
      // Convert decrypted values to cards
      const cards: UnoCard[] = decryptedValues
        .filter((v): v is bigint => v !== null)
        .map(cardId => cardIdToCard(Number(cardId % BigInt(108)))); // Mod 108 to ensure valid card ID
      
      setHand(cards);
      lastDecryptedHandlesRef.current = handlesHash;
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : "Failed to decrypt hand");
      console.error("Hand decryption error:", err);
    } finally {
      setIsDecrypting(false);
    }
  }, [gameId, address, sessionKey, cardHandlesData, walletClient, hand.length]);

  // Trigger decryption when card handles change
  useEffect(() => {
    if ((sessionKey || walletClient) && cardHandlesData && cardHandlesData.length > 0) {
      decryptHand();
    } else if (!cardHandlesData || cardHandlesData.length === 0) {
      setHand([]);
    }
  }, [sessionKey, cardHandlesData, decryptHand, walletClient]);

  const refetchHand = useCallback(() => {
    lastDecryptedHandlesRef.current = ""; // Clear cache to force re-decrypt
    refetchHandSize();
    refetchCardHandles();
  }, [refetchHandSize, refetchCardHandles]);

  return {
    hand,
    handSize: Number(handSize ?? 0),
    isDecrypting,
    decryptError,
    refetchHand,
  };
}

// Hook to get top card from plaintext topCardId (no decryption needed!)
export function useTopCard(
  topCardId: number | null,
  gameStatus: GameStatus | null,
  _sessionKey: SessionKeyParams // kept for backward compatibility but not used
) {
  const [topCard, setTopCard] = useState<UnoCard | null>(null);

  useEffect(() => {
    if (topCardId === null || topCardId === undefined || gameStatus !== GameStatus.Started) {
      setTopCard(null);
      return;
    }
    
    // topCardId is now a plaintext value from the contract!
    const cardId = topCardId % 108;
    if (cardId >= 0 && cardId < 108) {
      setTopCard(cardIdToCard(cardId));
    }
  }, [topCardId, gameStatus]);

  return { topCard, isDecrypting: false };
}

// Hook for game fees
export function useFees() {
  // Get fee for creating a game (no bot param anymore)
  const { data: createGameFee } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getCreateGameFee",
    args: [],
  });

  const { data: joinGame } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getJoinGameFee",
  });

  const { data: encryption } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getEncryptionFee",
  });

  return {
    data: {
      createGame: (createGameFee as bigint) ?? BigInt(0),
      joinGame: (joinGame as bigint) ?? BigInt(0),
      encryption: (encryption as bigint) ?? BigInt(0),
    },
  };
}

// Hook for game actions (write operations)
export function useUnoActions() {
  const { address } = useAccount();
  const { data: fees } = useFees();

  // Create game
  const {
    writeContract: writeCreateGame,
    data: createGameHash,
    isPending: isCreating,
    reset: resetCreate,
  } = useWriteContract();

  const { isSuccess: createSuccess } = useWaitForTransactionReceipt({
    hash: createGameHash,
  });

  // Join game
  const {
    writeContract: writeJoinGame,
    data: joinGameHash,
    isPending: isJoining,
    reset: resetJoin,
  } = useWriteContract();

  const { isSuccess: joinSuccess } = useWaitForTransactionReceipt({
    hash: joinGameHash,
  });

  // Start game
  const {
    writeContract: writeStartGame,
    data: startGameHash,
    isPending: isStarting,
    reset: resetStart,
  } = useWriteContract();

  const { isSuccess: startSuccess } = useWaitForTransactionReceipt({
    hash: startGameHash,
  });

  // Play card (commit move)
  const {
    writeContract: writePlayCard,
    data: playCardHash,
    isPending: isPlaying,
    reset: resetPlay,
  } = useWriteContract();

  const { isSuccess: playSuccess } = useWaitForTransactionReceipt({
    hash: playCardHash,
  });

  // Draw card
  const {
    writeContract: writeDrawCard,
    data: drawCardHash,
    isPending: isDrawing,
    reset: resetDraw,
  } = useWriteContract();

  const { isSuccess: drawSuccess } = useWaitForTransactionReceipt({
    hash: drawCardHash,
  });

  // Action functions
  const createGame = useCallback(
    async (initialTopCardId?: number): Promise<bigint | null> => {
      if (!address) {
        console.error("No wallet address connected");
        throw new Error("Wallet not connected");
      }

      try {
        const fee = fees.createGame;
        
        // Generate a random initial top card ID if not provided
        // This will be used for validation - the actual encrypted deck is shuffled on-chain
        const topCardId = initialTopCardId ?? Math.floor(Math.random() * 108);

        writeCreateGame({
          address: UNO_GAME_ADDRESS,
          abi: UNO_GAME_ABI,
          functionName: "createGame",
          args: [address, topCardId],
          value: fee,
        });

        // TODO: Parse game ID from event logs
        // For now, return a placeholder
        return null;
      } catch (err) {
        console.error("Create game error:", err);
        throw err;
      }
    },
    [writeCreateGame, fees, address]
  );

  const joinGame = useCallback(
    async (gameId: bigint) => {
      if (!address) {
        console.error("No wallet address connected");
        throw new Error("Wallet not connected");
      }

      writeJoinGame({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "joinGame",
        args: [gameId, address], // FIXED: Pass gameId and joinee address
        value: fees.joinGame,
      });
    },
    [writeJoinGame, fees, address]
  );

  const startGame = useCallback(
    async (gameId: bigint) => {
      writeStartGame({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "startGame",
        args: [gameId],
        value: fees.encryption,
      });
    },
    [writeStartGame, fees]
  );

  const playCard = useCallback(
    async (gameId: bigint, cardIndex: number, revealedCardId: number, chosenColor: number = 0) => {
      // The contract takes card index, revealed card ID, and chosen color
      // cardIndex: index of the card in the player's hand (0-based)
      // revealedCardId: the decrypted card ID (0-107) from the player's hand
      // chosenColor: color for wild cards (0=Red, 1=Yellow, 2=Green, 3=Blue)
      
      writePlayCard({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "commitMove",
        args: [gameId, cardIndex, revealedCardId, chosenColor],
        value: fees.encryption * BigInt(2), // Contract requires 2x fee for commitMove
      });
    },
    [writePlayCard, fees]
  );

  const drawCard = useCallback(
    async (gameId: bigint, endTurn: boolean = true) => {
      writeDrawCard({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "drawCard",
        args: [gameId, endTurn],
        value: fees.encryption,
      });
    },
    [writeDrawCard, fees]
  );

  // Delete game
  const {
    writeContract: writeDeleteGame,
    data: deleteGameHash,
    isPending: isDeleting,
    reset: resetDelete,
  } = useWriteContract();

  const { isSuccess: deleteSuccess } = useWaitForTransactionReceipt({
    hash: deleteGameHash,
  });

  const deleteGame = useCallback(
    async (gameId: bigint) => {
      writeDeleteGame({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "deleteGame",
        args: [gameId],
      });
    },
    [writeDeleteGame]
  );

  return {
    createGame,
    joinGame,
    startGame,
    playCard,
    drawCard,
    deleteGame,
    isCreating,
    isJoining,
    isStarting,
    isPlaying,
    isDrawing,
    isDeleting,
    createSuccess,
    joinSuccess,
    startSuccess,
    playSuccess,
    drawSuccess,
    deleteSuccess,
    resetCreate,
    resetJoin,
    resetStart,
    resetPlay,
    resetDraw,
    resetDelete,
  };
}

// Hook for UNO call and penalty actions
export function useUnoCallActions() {
  const { data: fees } = useFees();

  // Call UNO
  const {
    writeContract: writeCallUno,
    data: callUnoHash,
    isPending: isCallingUno,
    reset: resetCallUno,
  } = useWriteContract();

  const { isSuccess: callUnoSuccess } = useWaitForTransactionReceipt({
    hash: callUnoHash,
  });

  // Penalize UNO
  const {
    writeContract: writePenalizeUno,
    data: penalizeHash,
    isPending: isPenalizing,
    reset: resetPenalize,
  } = useWriteContract();

  const { isSuccess: penalizeSuccess } = useWaitForTransactionReceipt({
    hash: penalizeHash,
  });

  const callUno = useCallback(
    async (gameId: bigint) => {
      writeCallUno({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "callUno",
        args: [gameId],
      });
    },
    [writeCallUno]
  );

  const penalizeUno = useCallback(
    async (gameId: bigint, target: `0x${string}`) => {
      writePenalizeUno({
        address: UNO_GAME_ADDRESS,
        abi: UNO_GAME_ABI,
        functionName: "penalizeUno",
        args: [gameId, target],
        value: fees.encryption * BigInt(2), // 2 cards penalty requires 2x encryption fee
      });
    },
    [writePenalizeUno, fees]
  );

  return {
    callUno,
    penalizeUno,
    isCallingUno,
    isPenalizing,
    callUnoSuccess,
    penalizeSuccess,
    resetCallUno,
    resetPenalize,
  };
}

// Hook for checking UNO status and penalties
export function useUnoStatus(gameId: bigint | null) {
  const { address } = useAccount();

  // Check if current player has called UNO
  const { data: hasCalledUno, refetch: refetchHasCalledUno } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "hasPlayerCalledUno",
    args: gameId && address ? [gameId, address] : undefined,
    query: {
      enabled: gameId !== null && !!address,
      refetchInterval: 3000,
    },
  });

  return {
    hasCalledUno: hasCalledUno ?? false,
    refetchHasCalledUno,
  };
}

// Hook to get all player hand sizes
export function useAllPlayerHandSizes(gameId: bigint | null) {
  const { data, refetch } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getAllPlayerHandSizes",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: gameId !== null,
      refetchInterval: 3000,
    },
  });

  // Transform data to a map of player address to hand size
  const handSizes: Map<string, number> = new Map();
  if (data && Array.isArray(data) && data.length >= 2) {
    const players = data[0] as readonly `0x${string}`[];
    const sizes = data[1] as readonly number[];
    for (let i = 0; i < players.length; i++) {
      handSizes.set(players[i].toLowerCase(), Number(sizes[i]));
    }
  }

  return { handSizes, refetch };
}

// Hook to check if a player can be penalized
export function useCanPenalize(gameId: bigint | null, target: `0x${string}` | null) {
  const { data, refetch } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "canPenalizePlayer",
    args: gameId && target ? [gameId, target] : undefined,
    query: {
      enabled: gameId !== null && !!target,
      refetchInterval: 2000, // Check more frequently
    },
  });

  return { canPenalize: data ?? false, refetch };
}

// Hook to get UNO challenge window status
export function useUnoWindow(gameId: bigint | null) {
  const { data: isOpen, refetch: refetchIsOpen } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "isUnoWindowOpen",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: gameId !== null,
      refetchInterval: 2000, // Check frequently for quick challenges
    },
  });

  const { data: windowPlayer, refetch: refetchPlayer } = useReadContract({
    address: UNO_GAME_ADDRESS,
    abi: UNO_GAME_ABI,
    functionName: "getUnoWindowPlayer",
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: gameId !== null,
      refetchInterval: 2000,
    },
  });

  const refetch = useCallback(() => {
    refetchIsOpen();
    refetchPlayer();
  }, [refetchIsOpen, refetchPlayer]);

  return {
    isWindowOpen: isOpen ?? false,
    windowPlayer: windowPlayer as `0x${string}` | null,
    refetch,
  };
}