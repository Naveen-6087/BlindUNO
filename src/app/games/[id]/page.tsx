"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import { GameHeader } from "@/components/uno/GameHeader";
import { GameBoard, GameBoardSkeleton } from "@/components/uno/GameBoard";
import { GameLobby } from "@/components/uno/GameLobby";
import { GameResults } from "@/components/uno/GameResults";
import { useSessionKeyContext } from "@/utils/uno/sessionContext";
import {
  useGameState,
  usePlayerHand,
  useTopCard,
  useFees,
  useUnoActions,
  useUnoCallActions,
  useUnoStatus,
  useAllPlayerHandSizes,
  useUnoWindow,
} from "@/utils/uno/hooks";
import { GameStatus, type UnoCard } from "@/utils/uno/types";

// Color picker for wild cards
function ColorPicker({
  onSelect,
  onCancel,
}: {
  onSelect: (color: number) => void;
  onCancel: () => void;
}) {
  const colors = [
    { name: "Red", value: 0, bg: "bg-red-500 hover:bg-red-600" },
    { name: "Yellow", value: 1, bg: "bg-yellow-500 hover:bg-yellow-600" },
    { name: "Green", value: 2, bg: "bg-green-500 hover:bg-green-600" },
    { name: "Blue", value: 3, bg: "bg-blue-500 hover:bg-blue-600" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-xl">
        <h3 className="mb-4 text-center text-xl font-bold text-white">
          Choose a Color
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => onSelect(color.value)}
              className={`${color.bg} rounded-lg px-8 py-4 font-bold text-white transition-colors`}
            >
              {color.name}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-lg bg-gray-600 py-2 text-white hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const gameId = useMemo(() => {
    if (!params.id) return null;
    try {
      return BigInt(params.id as string);
    } catch {
      return null;
    }
  }, [params.id]);

  const [error, setError] = useState<string | null>(null);
  const [pendingWildCard, setPendingWildCard] = useState<{
    card: UnoCard;
    cardIndex: number;
  } | null>(null);

  // Session key context
  const {
    sessionKey,
    isCreatingSession,
    sessionError,
    createSession,
    revokeSession,
    isSessionValid,
  } = useSessionKeyContext();

  const [sessionValidityCheck, setSessionValidityCheck] = useState(0);

  useEffect(() => {
    if (!sessionKey) return;
    const interval = setInterval(() => {
      setSessionValidityCheck((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionKey]);

  const sessionKeyParams = useMemo(() => {
    if (sessionKey && sessionKey.expiresAt > new Date()) {
      return sessionKey;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, sessionValidityCheck]);

  // Redirect to home if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  // Redirect to games list if no valid game ID
  useEffect(() => {
    if (params.id && gameId === null) {
      router.push("/games");
    }
  }, [params.id, gameId, router]);

  // Fetch current game state
  const { data: gameState, isLoading: gameStateLoading } = useGameState(gameId);

  // Fetch player hand
  const { hand, isDecrypting, refetchHand } = usePlayerHand(
    gameState?.status === GameStatus.Started ? gameId : null,
    sessionKeyParams
  );

  // Fetch top card
  const { topCard, isDecrypting: topCardDecrypting } = useTopCard(
    gameState?.topCardId ?? null,
    gameState?.status ?? null,
    sessionKeyParams
  );

  // Fetch fees
  const { data: fees } = useFees();

  // Contract actions
  const {
    startGame,
    playCard,
    drawCard,
    isStarting,
    isPlaying,
    isDrawing,
  } = useUnoActions();

  // UNO call and penalty actions
  const { callUno, penalizeUno, isCallingUno, isPenalizing } =
    useUnoCallActions();
  const { hasCalledUno, refetchHasCalledUno } = useUnoStatus(gameId);
  const { handSizes, refetch: refetchHandSizes } =
    useAllPlayerHandSizes(gameId);
  const { isWindowOpen, windowPlayer, refetch: refetchUnoWindow } =
    useUnoWindow(gameId);

  const canPenalizeOpponent = useMemo(() => {
    if (!isWindowOpen || !windowPlayer || !address) return false;
    return windowPlayer.toLowerCase() !== address.toLowerCase();
  }, [isWindowOpen, windowPlayer, address]);

  // Handlers
  const handleStartGame = useCallback(async () => {
    if (!gameId) return;
    setError(null);
    try {
      await startGame(gameId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    }
  }, [gameId, startGame]);

  const handlePlayCard = useCallback(
    async (card: UnoCard, cardIndex: number) => {
      if (!gameId || !address) return;
      setError(null);

      if (card.color === "wild") {
        setPendingWildCard({ card, cardIndex });
        return;
      }

      try {
        const chosenColor = getCardColor(card);
        await playCard(gameId, cardIndex, card.id, chosenColor);
        setTimeout(() => refetchHand(), 2000);
      } catch (err) {
        console.error("Play card error:", err);
        setError(err instanceof Error ? err.message : "Failed to play card");
      }
    },
    [gameId, address, playCard, refetchHand]
  );

  const handleWildColorSelect = useCallback(
    async (color: number) => {
      if (!gameId || !pendingWildCard) return;
      try {
        await playCard(
          gameId,
          pendingWildCard.cardIndex,
          pendingWildCard.card.id,
          color
        );
        setTimeout(() => refetchHand(), 2000);
      } catch (err) {
        console.error("Play wild card error:", err);
        setError(err instanceof Error ? err.message : "Failed to play card");
      } finally {
        setPendingWildCard(null);
      }
    },
    [gameId, pendingWildCard, playCard, refetchHand]
  );

  const handleWildColorCancel = useCallback(() => {
    setPendingWildCard(null);
  }, []);

  const getCardColor = (card: UnoCard): number => {
    switch (card.color) {
      case "red":
        return 0;
      case "yellow":
        return 1;
      case "green":
        return 2;
      case "blue":
        return 3;
      default:
        return 0;
    }
  };

  const handleDrawCard = useCallback(async () => {
    if (!gameId) return;
    setError(null);
    try {
      await drawCard(gameId, true);
      setTimeout(() => refetchHand(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draw card");
    }
  }, [gameId, drawCard, refetchHand]);

  const handleCallUno = useCallback(async () => {
    if (!gameId) return;
    setError(null);
    try {
      await callUno(gameId);
      setTimeout(() => refetchHasCalledUno(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to call UNO");
    }
  }, [gameId, callUno, refetchHasCalledUno]);

  const handlePenalizeUno = useCallback(async () => {
    if (!gameId || !windowPlayer) return;
    setError(null);
    try {
      await penalizeUno(gameId, windowPlayer);
      setTimeout(() => {
        refetchHandSizes();
        refetchUnoWindow();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to penalize player");
    }
  }, [gameId, windowPlayer, penalizeUno, refetchHandSizes, refetchUnoWindow]);

  const handlePlayAgain = useCallback(() => {
    router.push("/games");
  }, [router]);

  const handleBack = useCallback(() => {
    router.push("/games");
  }, [router]);

  // Loading state
  if (!gameId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="h-dvh overflow-hidden bg-wood-table">
      {pendingWildCard && (
        <ColorPicker
          onSelect={handleWildColorSelect}
          onCancel={handleWildColorCancel}
        />
      )}

      <GameHeader
        currentGameId={gameId}
        encryptionFee={fees?.encryption ?? BigInt(0)}
        sessionActive={isSessionValid()}
        sessionExpiresAt={sessionKey?.expiresAt ?? null}
        onRevokeSession={sessionKey ? revokeSession : undefined}
        onBack={handleBack}
      />

      {error && (
        <div className="border-b-2 border-red-300 bg-red-100 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="h-[calc(100dvh-64px)] overflow-hidden">
        {gameStateLoading ? (
          <GameBoardSkeleton />
        ) : !gameState ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-white">
              <p className="mb-4 text-xl">Game not found</p>
              <button
                onClick={handleBack}
                className="rounded-lg bg-amber-600 px-6 py-3 font-semibold hover:bg-amber-500"
              >
                Back to Games
              </button>
            </div>
          </div>
        ) : gameState.status === GameStatus.NotStarted ? (
          <GameLobby
            gameId={gameState.id}
            players={gameState.players}
            currentUserAddress={address}
            onStartGame={handleStartGame}
            isStarting={isStarting}
          />
        ) : gameState.status === GameStatus.Ended ? (
          <GameResults
            gameId={gameState.id}
            players={gameState.players}
            winner={gameState.winner}
            currentUserAddress={address}
            gameHash={gameState.gameHash}
            onPlayAgain={handlePlayAgain}
          />
        ) : !sessionKeyParams && !isCreatingSession ? (
          <div className="relative flex h-full items-center justify-center">
            {/* Background image - full coverage */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
              style={{ backgroundImage: "url('/homePage/gaming.jpg')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a4d1a]/60 via-[#2d5a27]/50 to-[#1a4d1a]/60" />

            <div className="relative z-10 mx-4 max-w-md space-y-6 rounded-2xl border-2 border-amber-700 bg-white/95 p-10 text-center shadow-2xl">
              <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-100">
                <svg
                  className="size-10 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="mb-3 text-2xl font-bold text-amber-900">
                  Create Session Key
                </h2>
                <p className="text-amber-700">
                  Sign once to create a session key that allows decrypting all
                  your cards without signing each time.
                </p>
              </div>
              {sessionError && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {sessionError}
                </p>
              )}
              <button
                onClick={() => createSession()}
                disabled={isCreatingSession}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-colors hover:from-amber-500 hover:to-amber-400 disabled:from-amber-300 disabled:to-amber-300"
              >
                {isCreatingSession
                  ? "Creating Session..."
                  : "Create Session Key"}
              </button>
            </div>
          </div>
        ) : isCreatingSession ? (
          <div className="relative flex h-full items-center justify-center">
            {/* Background image - full coverage */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
              style={{ backgroundImage: "url('/homePage/gaming.jpg')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a4d1a]/60 via-[#2d5a27]/50 to-[#1a4d1a]/60" />

            <div className="relative z-10 space-y-6 rounded-2xl border-2 border-amber-700 bg-white/95 p-10 text-center shadow-2xl">
              <svg
                className="mx-auto size-16 animate-spin text-amber-600"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-lg font-bold text-amber-800">
                Creating session key...
              </p>
              <p className="text-sm text-amber-600">
                Please sign the message in your wallet
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full">
            <GameBoard
              gameState={gameState}
              playerHand={hand}
              topCard={topCard}
              currentPlayerAddress={address}
              onPlayCard={handlePlayCard}
              onDrawCard={handleDrawCard}
              onCallUno={handleCallUno}
              onPenalizeUno={handlePenalizeUno}
              isDrawing={isDrawing}
              isPlaying={isPlaying}
              isDecrypting={isDecrypting || topCardDecrypting}
              isCallingUno={isCallingUno}
              isPenalizing={isPenalizing}
              hasCalledUno={hasCalledUno}
              handSizes={handSizes}
              isUnoWindowOpen={isWindowOpen}
              unoWindowPlayer={windowPlayer}
            />
          </div>
        )}
      </div>
    </div>
  );
}
