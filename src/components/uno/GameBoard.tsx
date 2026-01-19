"use client";

import { motion, useReducedMotion } from "motion/react";
import { Card, DrawPile, DiscardPile, MiniCard } from "./Card";
import { PlayerHand, PlayerHandSkeleton } from "./PlayerHand";
import { type UnoCard, type GameState, formatAddress, isBotAddress } from "@/utils/uno/types";
import { COLOR_NAMES } from "@/utils/uno/constants";

interface GameBoardProps {
  gameState: GameState;
  playerHand: UnoCard[];
  topCard: UnoCard | null;
  currentPlayerAddress: `0x${string}` | undefined;
  onPlayCard: (card: UnoCard, cardIndex: number) => void;
  onDrawCard: () => void;
  onCallUno: () => void;
  onPenalizeUno: () => void;
  isDrawing: boolean;
  isPlaying: boolean;
  isDecrypting: boolean;
  isCallingUno: boolean;
  isPenalizing: boolean;
  hasCalledUno: boolean;
  handSizes: Map<string, number>;
  isUnoWindowOpen: boolean;
  unoWindowPlayer: `0x${string}` | null;
}

// Helper to categorize opponents by position
function getOpponentPositions(
  players: `0x${string}`[],
  currentPlayerAddress: `0x${string}` | undefined
) {
  const opponents = players.filter(
    (p) => p.toLowerCase() !== currentPlayerAddress?.toLowerCase()
  );

  const count = opponents.length;

  if (count === 0) return { top: [], left: [], right: [] };
  if (count === 1) return { top: opponents, left: [], right: [] };
  if (count === 2) return { top: [opponents[0]], left: [], right: [opponents[1]] };
  if (count === 3) return { top: [opponents[0]], left: [opponents[1]], right: [opponents[2]] };

  // For 4+ opponents, distribute evenly
  const topCount = Math.ceil(count / 2);
  return {
    top: opponents.slice(0, topCount),
    left: opponents.slice(topCount, topCount + Math.floor((count - topCount) / 2)),
    right: opponents.slice(topCount + Math.floor((count - topCount) / 2)),
  };
}

export function GameBoard({
  gameState,
  playerHand,
  topCard,
  currentPlayerAddress,
  onPlayCard,
  onDrawCard,
  onCallUno,
  onPenalizeUno,
  isDrawing,
  isPlaying,
  isDecrypting,
  isCallingUno,
  isPenalizing,
  hasCalledUno,
  handSizes,
  isUnoWindowOpen,
  unoWindowPlayer,
}: GameBoardProps) {
  const shouldReduceMotion = useReducedMotion();

  const isCurrentTurn =
    currentPlayerAddress &&
    gameState.players[Number(gameState.currentPlayerIndex)]?.toLowerCase() ===
      currentPlayerAddress.toLowerCase();

  const currentTurnPlayer = gameState.players[Number(gameState.currentPlayerIndex)];
  
  // Check if we can penalize (window is open for an opponent)
  const canPenalizeOpponent = isUnoWindowOpen && 
    unoWindowPlayer && 
    unoWindowPlayer.toLowerCase() !== currentPlayerAddress?.toLowerCase();

  const { top, left, right } = getOpponentPositions([...gameState.players], currentPlayerAddress);
  
  // Get current color for wild card indicator
  const currentColor = gameState.currentColor; // 0=Red, 1=Yellow, 2=Green, 3=Blue
  const colorName = COLOR_NAMES[currentColor] ?? "Unknown";
  const colorClasses: Record<number, string> = {
    0: "bg-red-500 border-red-700 shadow-red-500/50",
    1: "bg-yellow-500 border-yellow-700 shadow-yellow-500/50",
    2: "bg-green-500 border-green-700 shadow-green-500/50",
    3: "bg-blue-500 border-blue-700 shadow-blue-500/50",
  };
  const currentColorClass = colorClasses[currentColor] ?? "bg-gray-500";

  // Helper to get hand size for a player
  const getHandSize = (player: `0x${string}`) => handSizes.get(player.toLowerCase()) ?? 7;

  // Get glow color based on current color
  const glowColors: Record<number, string> = {
    0: "from-red-500/40 via-red-500/20", // Red
    1: "from-yellow-500/40 via-yellow-500/20", // Yellow
    2: "from-green-500/40 via-green-500/20", // Green
    3: "from-blue-500/40 via-blue-500/20", // Blue
  };
  const currentGlow = glowColors[currentColor] ?? "from-green-500/40 via-green-500/20";

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Pool table background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/table.png')" }}
      />
      {/* Fallback gradient overlay - reduced opacity to show more table */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a4d1a]/60 via-[#2d5a27]/50 to-[#1a4d1a]/60" />
      
      {/* Dynamic color glow at bottom based on current turn color */}
      <div className={`absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t ${currentGlow} to-transparent pointer-events-none z-0 transition-all duration-500`} />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
      {/* Top opponents area */}
      <div className="flex-shrink-0 p-4">
        <div className="flex items-start justify-center gap-6 flex-wrap">
          {top.map((player) => {
            const isTheirTurn =
              gameState.players[Number(gameState.currentPlayerIndex)]?.toLowerCase() ===
              player.toLowerCase();
            const playerHandSize = getHandSize(player);
            const isVulnerable = isUnoWindowOpen && unoWindowPlayer?.toLowerCase() === player.toLowerCase();

            return (
              <motion.div
                key={player}
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-xl backdrop-blur-sm
                  ${isVulnerable 
                    ? "bg-orange-500/30 border-2 border-orange-400 shadow-lg ring-4 ring-orange-400/50 animate-pulse" 
                    : isTheirTurn 
                      ? "bg-green-500/20 border-2 border-green-400 shadow-lg shadow-green-500/20" 
                      : "bg-black/30 border border-white/20"
                  }
                `}
              >
                <span className={`text-xs font-medium ${isVulnerable ? "text-orange-200" : isTheirTurn ? "text-green-200" : "text-white/80"}`}>
                  {isBotAddress(player) ? "🤖 BOT" : formatAddress(player)}
                </span>
                <MiniCard count={playerHandSize} />
                <span className="text-xs text-white/70 font-bold">{playerHandSize} cards</span>
                {isTheirTurn && !isVulnerable && (
                  <span className="text-xs text-green-300 font-medium animate-pulse">Playing...</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Middle section: left opponents + center + right opponents */}
      <div className="grid grid-cols-[80px_1fr_80px] flex-1 min-h-0">
        {/* Left opponents */}
        <div className="flex flex-col items-center justify-center gap-4 p-2">
          {left.map((player) => {
            const isTheirTurn =
              gameState.players[Number(gameState.currentPlayerIndex)]?.toLowerCase() ===
              player.toLowerCase();
            const playerHandSize = getHandSize(player);
            const isVulnerable = isUnoWindowOpen && unoWindowPlayer?.toLowerCase() === player.toLowerCase();

            return (
              <motion.div
                key={player}
                initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg backdrop-blur-sm
                  ${isVulnerable 
                    ? "bg-orange-500/30 border-2 border-orange-400 ring-2 ring-orange-400/50 animate-pulse" 
                    : isTheirTurn 
                      ? "bg-green-500/20 border border-green-400" 
                      : "bg-black/30 border border-white/10"
                  }
                `}
              >
                <span className={`text-[10px] font-medium truncate max-w-[70px] ${isVulnerable ? "text-orange-200" : isTheirTurn ? "text-green-200" : "text-white/80"}`}>
                  {isBotAddress(player) ? "🤖" : formatAddress(player)}
                </span>
                <MiniCard count={playerHandSize} vertical />
                <span className="text-[10px] text-white/70 font-bold">{playerHandSize}</span>
                {isTheirTurn && !isVulnerable && (
                  <div className="size-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Center play area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 min-h-0 relative">
          {/* Current color indicator (for wild cards) */}
          <div className="flex items-center gap-2 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full">
            <span className="text-sm text-white/80 font-medium">Current Color:</span>
            <div className={`px-3 py-1 rounded-full border-2 shadow-lg ${currentColorClass}`}>
              <span className="text-white font-bold text-sm drop-shadow">{colorName}</span>
            </div>
          </div>

          {/* Draw and Discard piles */}
          <div className="flex items-center gap-12">
            <DrawPile
              count={gameState.deckRemaining}
              onClick={onDrawCard}
              disabled={!isCurrentTurn || isDrawing || isPlaying}
              isDrawing={isDrawing}
            />
            <DiscardPile topCard={topCard} moveCount={gameState.moveCount} />
          </div>

          {/* Turn indicator */}
          <div className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full shadow-lg transition-all duration-300 ${
            isCurrentTurn 
              ? "bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/30" 
              : "bg-black/40 backdrop-blur-sm"
          }`}>
            {isCurrentTurn ? (
              <>
                <div className="size-2.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-sm font-semibold">Your Turn - Play a Card!</span>
              </>
            ) : (
              <>
                <div className="size-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-white/90 text-sm">
                  Waiting for {isBotAddress(currentTurnPlayer) ? "Bot" : formatAddress(currentTurnPlayer)}...
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right opponents */}
        <div className="flex flex-col items-center justify-center gap-4 p-2 w-24 flex-shrink-0">
          {right.map((player) => {
            const isTheirTurn =
              gameState.players[Number(gameState.currentPlayerIndex)]?.toLowerCase() ===
              player.toLowerCase();
            const playerHandSize = getHandSize(player);
            const isVulnerable = isUnoWindowOpen && unoWindowPlayer?.toLowerCase() === player.toLowerCase();

            return (
              <motion.div
                key={player}
                initial={shouldReduceMotion ? {} : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-lg backdrop-blur-sm
                  ${isVulnerable 
                    ? "bg-orange-500/30 border-2 border-orange-400 ring-2 ring-orange-400/50 animate-pulse" 
                    : isTheirTurn 
                      ? "bg-green-500/20 border border-green-400" 
                      : "bg-black/30 border border-white/10"
                  }
                `}
              >
                <span className={`text-[10px] font-medium truncate max-w-[70px] ${isVulnerable ? "text-orange-200" : isTheirTurn ? "text-green-200" : "text-white/80"}`}>
                  {isBotAddress(player) ? "🤖" : formatAddress(player)}
                </span>
                <MiniCard count={playerHandSize} vertical />
                <span className="text-[10px] text-white/70 font-bold">{playerHandSize}</span>
                {isTheirTurn && !isVulnerable && (
                  <div className="size-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom: Current player's hand with UNO/CATCH buttons */}
      <div className="flex-shrink-0 h-40 px-4 bg-gradient-to-t from-black/50 via-black/30 to-transparent relative">
        {/* UNO button - left side */}
        <motion.button
          className={`
            absolute left-6 top-2 z-20
            w-16 h-16 rounded-full
            flex items-center justify-center
            text-white font-black text-sm tracking-tight
            transition-all duration-200
            border-4
            ${hasCalledUno 
              ? "bg-gradient-to-b from-green-500 to-green-700 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]" 
              : "bg-gradient-to-b from-red-500 to-red-700 border-red-400 hover:from-red-400 hover:to-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-110 active:scale-95"
            }
            ${isCallingUno ? "opacity-50 cursor-wait" : ""}
          `}
          onClick={onCallUno}
          disabled={isCallingUno || hasCalledUno}
          whileHover={!hasCalledUno ? { scale: 1.1 } : {}}
          whileTap={!hasCalledUno ? { scale: 0.95 } : {}}
        >
          {hasCalledUno ? (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            "UNO"
          )}
        </motion.button>

        {/* CATCH button - right side */}
        <motion.button
          className={`
            absolute right-6 top-2 z-20
            w-16 h-16 rounded-full
            flex flex-col items-center justify-center gap-0.5
            text-white font-bold text-xs
            transition-all duration-200
            border-4
            ${canPenalizeOpponent 
              ? "bg-gradient-to-b from-orange-500 to-orange-700 border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:from-orange-400 hover:to-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-110 active:scale-95 animate-pulse" 
              : "bg-gradient-to-b from-gray-500 to-gray-700 border-gray-400 opacity-40 cursor-not-allowed"
            }
            ${isPenalizing ? "opacity-50 cursor-wait" : ""}
          `}
          onClick={onPenalizeUno}
          disabled={isPenalizing || !canPenalizeOpponent}
          whileHover={canPenalizeOpponent ? { scale: 1.1 } : {}}
          whileTap={canPenalizeOpponent ? { scale: 0.95 } : {}}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>CATCH</span>
        </motion.button>

        {/* Cards */}
        {isDecrypting ? (
          <PlayerHandSkeleton />
        ) : (
          <PlayerHand
            cards={playerHand}
            onPlayCard={onPlayCard}
            isCurrentTurn={isCurrentTurn ?? false}
            disabled={isPlaying || isDrawing}
          />
        )}
      </div>
      </div> {/* Close content z-10 div */}
    </div>
  );
}

// Loading skeleton for the game board
export function GameBoardSkeleton() {
  return (
    <div className="relative grid grid-rows-[auto_1fr_auto] h-full overflow-hidden">
      {/* Pool table background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/table.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a4d1a]/95 via-[#2d5a27]/90 to-[#1a4d1a]/95" />
      
      <div className="relative z-10 grid grid-rows-[auto_1fr_auto] h-full">
      {/* Top opponents skeleton */}
      <div className="flex-shrink-0 p-4">
        <div className="flex items-center justify-center gap-6">
          {Array.from({ length: 1 }).map((_, i) => (
            <div key={i} className="w-32 h-24 bg-white/20 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>

      {/* Center skeleton */}
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-12">
          <div className="w-20 h-[120px] bg-red-400/30 rounded-lg animate-pulse" />
          <div className="w-20 h-[120px] bg-amber-400/30 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Bottom skeleton */}
      <div className="flex-shrink-0 p-4">
        <PlayerHandSkeleton />
      </div>
      </div>
    </div>
  );
}
