"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { usePrivy } from "@privy-io/react-auth";

import {
  useActiveGames,
  useNotStartedGames,
  useFees,
  useUnoActions,
  useGameState,
} from "@/utils/uno/hooks";
import { GameStatus } from "@/utils/uno/types";

const GAMES_PER_PAGE = 10;
const MY_GAMES_PER_PAGE = 10;

/* ---------- Pagination Component ---------- */

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  variant = "default",
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "default" | "compact";
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        title="First page"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Previous page"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex gap-1">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                currentPage === pageNum
                  ? variant === "default"
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white"
                    : "bg-gradient-to-r from-green-600 to-green-500 text-white"
                  : "border border-amber-700/50 bg-amber-900/40 text-amber-300 hover:bg-amber-800/50"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Next page"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
        title="Last page"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/* ---------- Rules Modal ---------- */

function RulesModal({
  isOpen,
  onClose,
  onAccept,
  gameId,
  isJoining,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  gameId: bigint | null;
  isJoining: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1c1c1e] to-[#0d0d0f] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-600">
              <span
                className="text-xs font-black text-yellow-400"
                style={{ transform: "rotate(-10deg)" }}
              >
                UNO
              </span>
            </div>
            <span className="text-lg font-bold text-white">Game Rules</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <svg
              className="size-5"
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

        {/* Scrollable Content */}
        <div className="space-y-4 overflow-y-auto p-6">
          {/* Playing Cards */}
          <Section title="Playing Cards" tag="Core Rules">
            <ul className="space-y-2 text-sm text-white/70">
              <RuleItem>
                Match the top card by{" "}
                <span className="font-semibold text-white">color</span> or{" "}
                <span className="font-semibold text-white">
                  number / symbol
                </span>
                .
              </RuleItem>
              <RuleItem>Wild cards can be played on any card.</RuleItem>
              <RuleItem>
                If you can&apos;t play, you must draw a card.
              </RuleItem>
            </ul>
          </Section>

          {/* Special Cards */}
          <Section title="Special Cards" tag="Actions">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RuleCard title="Skip">
                Next player loses their turn.
              </RuleCard>

              <RuleCard title="Reverse">
                Reverses the direction of play.
              </RuleCard>

              <RuleCard title="Draw Two (+2)">
                Next player draws 2 cards and is skipped.
              </RuleCard>

              <RuleCard title="Wild Draw Four (+4)">
                Choose a color. Next player draws 4 and is skipped.
              </RuleCard>
            </div>
          </Section>

          {/* UNO Call */}
          <Section title="UNO Call" tag="Penalty Rule">
            <ul className="space-y-2 text-sm text-white/70">
              <RuleItem>
                Call{" "}
                <span className="font-bold text-white">UNO</span>{" "}
                when you have{" "}
                <span className="font-semibold text-white">2 cards</span>{" "}
                (before playing to 1).
              </RuleItem>
              <RuleItem>
                If caught not calling UNO, you draw{" "}
                <span className="font-semibold text-white">2 penalty</span>{" "}
                cards.
              </RuleItem>
              <RuleItem>
                Use the <span className="font-semibold text-white">CATCH</span>{" "}
                button to penalize opponents.
              </RuleItem>
            </ul>
          </Section>

          {/* Blockchain Notice */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-200">
                Important
              </p>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200/80">
                On-chain
              </span>
            </div>
            <p className="text-sm leading-relaxed text-amber-100/70">
              This is a blockchain game. Each action requires a transaction
              and a small fee for encrypted computation. Your cards are private
              and encrypted — only you can see them.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-4 border-t border-white/10 bg-black/20 px-6 py-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Cancel
          </button>

          <button
            onClick={onAccept}
            disabled={isJoining}
            className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-green-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-green-500 hover:to-green-400 disabled:opacity-60"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24">
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
                Joining…
              </span>
            ) : (
              `Join Game #${gameId?.toString() ?? ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Section({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">{title}</p>
        {tag && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function RuleItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 size-1.5 rounded-full bg-white/30" />
      <span>{children}</span>
    </li>
  );
}

function RuleCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="mb-1 text-sm font-semibold text-white">{title}</p>
      <p className="text-sm text-white/60">{children}</p>
    </div>
  );
}

// Game Card Component for lobby - fetches its own game state
function GameCard({
  gameId,
  isActive,
  onJoin,
  onEnter,
  isJoining,
  joinFee,
  userAddress,
}: {
  gameId: bigint;
  isActive: boolean;
  onJoin: (gameId: bigint) => void;
  onEnter: (gameId: bigint) => void;
  isJoining: boolean;
  joinFee: bigint;
  userAddress?: `0x${string}`;
}) {
  // Fetch game state to check if user is already in game
  const { data: gameState } = useGameState(gameId);

  const isUserInGame = useMemo(() => {
    if (!userAddress || !gameState?.players) return false;
    return gameState.players.some(
      (p) => p.toLowerCase() === userAddress.toLowerCase()
    );
  }, [userAddress, gameState?.players]);

  const playerCount = gameState?.players?.length ?? 0;

  return (
    <div className="rounded-xl border border-amber-700/50 bg-gradient-to-br from-amber-900/40 to-amber-950/60 p-4 transition-all hover:border-amber-500/70 hover:shadow-lg hover:shadow-amber-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-12 items-center justify-center rounded-xl ${
              isActive
                ? "border border-green-500/50 bg-green-600/30"
                : "border border-amber-500/50 bg-amber-600/30"
            }`}
          >
            <div className="flex size-8 items-center justify-center rounded border border-red-800 bg-red-600">
              <span className="text-[8px] font-black text-yellow-400">UNO</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-amber-100">
              Game #{gameId.toString()}
            </h3>
            <p
              className={`text-sm ${
                isActive ? "text-green-400" : "text-amber-400"
              }`}
            >
              {isActive ? "In Progress" : `${playerCount}/6 Players`}
            </p>
          </div>
        </div>
        {!isActive &&
          (isUserInGame ? (
            <button
              onClick={() => onEnter(gameId)}
              className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-amber-500 hover:to-amber-400"
            >
              Enter Game
            </button>
          ) : (
            <button
              onClick={() => onJoin(gameId)}
              disabled={isJoining}
              className="rounded-lg bg-gradient-to-r from-green-600 to-green-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-600"
            >
              Join ({formatEther(joinFee)} ETH)
            </button>
          ))}
      </div>
    </div>
  );
}

// Active Game Card Component - only shows if user is in the game
function ActiveGameCard({
  gameId,
  onEnter,
  userAddress,
}: {
  gameId: bigint;
  onEnter: (gameId: bigint) => void;
  userAddress?: `0x${string}`;
}) {
  const { data: gameState } = useGameState(gameId);

  const isUserInGame = useMemo(() => {
    if (!userAddress || !gameState?.players) return false;
    return gameState.players.some(
      (p) => p.toLowerCase() === userAddress.toLowerCase()
    );
  }, [userAddress, gameState?.players]);

  // Only render if user is in the game
  if (!isUserInGame) return null;

  return (
    <div
      onClick={() => onEnter(gameId)}
      className="cursor-pointer rounded-xl border border-green-700/50 bg-gradient-to-br from-green-900/40 to-green-950/60 p-4 transition-all hover:border-green-500/70 hover:shadow-lg hover:shadow-green-900/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl border border-green-500/50 bg-green-600/30">
            <span className="text-2xl">♦</span>
          </div>
          <div>
            <h3 className="font-bold text-green-100">
              Game #{gameId.toString()}
            </h3>
            <p className="text-sm text-green-400">In Progress</p>
          </div>
        </div>
        <button className="rounded-lg bg-gradient-to-r from-green-600 to-green-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-green-500 hover:to-green-400">
          Continue Game
        </button>
      </div>
    </div>
  );
}

// My Games Card Component
function MyGameCard({
  gameId,
  onEnter,
  onDelete,
  userAddress,
  isDeleting,
}: {
  gameId: bigint;
  onEnter: (gameId: bigint) => void;
  onDelete?: (gameId: bigint) => void;
  userAddress?: `0x${string}`;
  isDeleting?: boolean;
}) {
  const { data: gameState } = useGameState(gameId);
  const playerCount = gameState?.players?.length ?? 0;
  const status = gameState?.status ?? GameStatus.NotStarted;

  // Check if user is in this game
  const isUserInGame = useMemo(() => {
    if (!userAddress || !gameState?.players) return false;
    return gameState.players.some(
      (p) => p.toLowerCase() === userAddress.toLowerCase()
    );
  }, [userAddress, gameState?.players]);

  // Check if user is the host (first player in the array is the creator)
  const isHost = useMemo(() => {
    if (!userAddress || !gameState?.players || gameState.players.length === 0)
      return false;
    return gameState.players[0].toLowerCase() === userAddress.toLowerCase();
  }, [userAddress, gameState?.players]);

  // Only render if user is in the game
  if (!isUserInGame) return null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:shadow-lg ${
        status === GameStatus.Started
          ? "border-green-700/50 bg-gradient-to-br from-green-900/40 to-green-950/60 hover:border-green-500/70 hover:shadow-green-900/20"
          : "border-amber-700/50 bg-gradient-to-br from-amber-900/40 to-amber-950/60 hover:border-amber-500/70 hover:shadow-amber-900/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onEnter(gameId)}>
          <div
            className={`flex size-12 items-center justify-center rounded-xl ${
              status === GameStatus.Started
                ? "border border-green-500/50 bg-green-600/30"
                : "border border-amber-500/50 bg-amber-600/30"
            }`}
          >
            <div className="flex size-8 items-center justify-center rounded border border-red-800 bg-red-600">
              <span className="text-[8px] font-black text-yellow-400">UNO</span>
            </div>
          </div>
          <div>
            <h3
              className={`font-bold ${
                status === GameStatus.Started
                  ? "text-green-100"
                  : "text-amber-100"
              }`}
            >
              Game #{gameId.toString()}
            </h3>
            <div className="flex items-center gap-2">
              <p
                className={`text-sm ${
                  status === GameStatus.Started
                    ? "text-green-400"
                    : "text-amber-400"
                }`}
              >
                {status === GameStatus.Started
                  ? "In Progress"
                  : `${playerCount}/6 Players`}
              </p>
              {isHost && (
                <span className="rounded border border-purple-500/50 bg-purple-600/30 px-2 py-0.5 text-xs text-purple-300">
                  Host
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete button - only show for host on NotStarted games */}
          {isHost && status === GameStatus.NotStarted && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(gameId);
              }}
              disabled={isDeleting}
              className="rounded-lg bg-red-600/20 border border-red-500/50 p-2.5 text-red-400 transition-all hover:bg-red-600/40 hover:text-red-300 disabled:opacity-50"
              title="Delete Game"
            >
              {isDeleting ? (
                <svg className="size-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => onEnter(gameId)}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all ${
              status === GameStatus.Started
                ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                : "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
            }`}
          >
            {status === GameStatus.Started ? "Continue" : "Enter Lobby"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GamesPage() {
  const { address, isConnected } = useAccount();
  const { login } = usePrivy();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [rulesModal, setRulesModal] = useState<{
    isOpen: boolean;
    gameId: bigint | null;
  }>({ isOpen: false, gameId: null });

  // Search and pagination state
  const [searchGameId, setSearchGameId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // My Games pagination state
  const [myWaitingPage, setMyWaitingPage] = useState(1);
  const [myActivePage, setMyActivePage] = useState(1);

  // Tab state: 'my-games' or 'browse'
  const [activeTab, setActiveTab] = useState<"my-games" | "browse">("my-games");

  // Redirect to home if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  // Fetch game lists
  const { data: activeGameIds = [] } = useActiveGames();
  const { data: notStartedGameIds = [] } = useNotStartedGames();

  // Sort games by recent first (higher game IDs are newer)
  const sortedActiveGameIds = useMemo(
    () => [...activeGameIds].sort((a, b) => Number(b - a)),
    [activeGameIds]
  );

  const sortedNotStartedGameIds = useMemo(
    () => [...notStartedGameIds].sort((a, b) => Number(b - a)),
    [notStartedGameIds]
  );

  // Search filter
  const searchedNotStartedGames = useMemo(() => {
    if (!searchGameId.trim()) return sortedNotStartedGameIds;
    const searchNum = parseInt(searchGameId.trim(), 10);
    if (isNaN(searchNum)) return sortedNotStartedGameIds;
    return sortedNotStartedGameIds.filter((id) =>
      id.toString().includes(searchGameId.trim())
    );
  }, [sortedNotStartedGameIds, searchGameId]);

  // Pagination for waiting games (page-based)
  const totalPages = Math.ceil(searchedNotStartedGames.length / GAMES_PER_PAGE);
  const paginatedWaitingGames = useMemo(() => {
    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    return searchedNotStartedGames.slice(startIndex, startIndex + GAMES_PER_PAGE);
  }, [searchedNotStartedGames, currentPage]);

  const totalWaitingGames = searchedNotStartedGames.length;

  // Fetch fees
  const { data: fees } = useFees();

  // Contract actions
  const { createGame, joinGame, deleteGame, isCreating, isJoining, isDeleting } = useUnoActions();

  // Handlers
  const handleCreateGame = useCallback(async () => {
    setError(null);
    try {
      const gameId = await createGame();
      if (gameId) {
        // Navigate to the new game page
        router.push(`/games/${gameId.toString()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    }
  }, [createGame, router]);

  const handleShowRules = useCallback((gameId: bigint) => {
    setRulesModal({ isOpen: true, gameId });
  }, []);

  const handleEnterGame = useCallback(
    (gameId: bigint) => {
      router.push(`/games/${gameId.toString()}`);
    },
    [router]
  );

  const handleJoinGame = useCallback(async () => {
    if (!rulesModal.gameId) return;
    setError(null);
    try {
      await joinGame(rulesModal.gameId);
      setRulesModal({ isOpen: false, gameId: null });
      // Navigate to the game page after joining
      router.push(`/games/${rulesModal.gameId.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    }
  }, [joinGame, rulesModal.gameId, router]);

  const handleDeleteGame = useCallback(async (gameId: bigint) => {
    setError(null);
    try {
      await deleteGame(gameId);
      // The game list will refresh automatically due to the contract read refetch
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete game");
    }
  }, [deleteGame]);

  // Games lobby view
  return (
    <div className="relative min-h-dvh">
      {/* Background image with high opacity */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/homepage/waitingroom1.png')" }}
      />
      {/* Green overlay on top of background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#1a3d1a]/90 via-[#1a4d1a]/85 to-[#1a3d1a]/90" />

      {/* Content wrapper */}
      <div className="relative z-10">
        {/* Rules Modal */}
        <RulesModal
          isOpen={rulesModal.isOpen}
          onClose={() => setRulesModal({ isOpen: false, gameId: null })}
          onAccept={handleJoinGame}
          gameId={rulesModal.gameId}
          isJoining={isJoining}
        />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-amber-800/50 bg-gradient-to-b from-amber-950/95 to-amber-950/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="rounded-lg p-2 transition-colors hover:bg-amber-900/50"
                title="Back to Home"
              >
                <svg
                  className="size-5 text-amber-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </Link>
              <Link href="/" className="group flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl border-2 border-red-800 bg-red-600 shadow-lg shadow-red-900/50 transition-transform group-hover:scale-105">
                  <span
                    className="text-sm font-black text-yellow-400"
                    style={{ transform: "rotate(-10deg)" }}
                  >
                    UNO
                  </span>
                </div>
                <div>
                  <span className="text-xl font-bold text-amber-100">
                    Confidential UNO
                  </span>
                  <p className="text-xs text-amber-400/70">Powered by Inco</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-1.5">
                <div className="size-2 animate-pulse rounded-full bg-blue-400" />
                <span className="text-sm font-medium text-blue-300">
                  Base Sepolia
                </span>
              </div>
              {address && (
                <div className="rounded-lg border border-amber-700/50 bg-amber-900/50 px-4 py-2">
                  <span className="font-mono text-sm text-amber-200">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {/* Error banner */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-700 bg-red-900/70 px-4 py-3 shadow-lg">
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-200">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-300 hover:text-red-100"
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

          {/* Create Game Section */}
          <section className="mb-8">
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-700/50 bg-gradient-to-r from-amber-900/60 via-amber-900/40 to-amber-950/60 p-8 shadow-2xl">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-yellow-600/20 blur-3xl" />

              {/* Decorative cards */}
              <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 gap-2 md:flex">
                <Image
                  src="/red/red_7.png"
                  alt=""
                  width={60}
                  height={90}
                  className="rotate-[-10deg] opacity-50"
                />
                <Image
                  src="/blue/blue_5.png"
                  alt=""
                  width={60}
                  height={90}
                  className="rotate-[5deg] opacity-50"
                />
                <Image
                  src="/green/green_3.png"
                  alt=""
                  width={60}
                  height={90}
                  className="rotate-[15deg] opacity-50"
                />
              </div>

              <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h2 className="mb-2 text-3xl font-bold text-amber-100">
                    Ready to Play?
                  </h2>
                  <p className="text-amber-300/80">
                    Create a new game and invite your friends to join!
                  </p>
                  {fees && (
                    <p className="mt-2 text-sm text-amber-500">
                      Creation fee: {formatEther(fees.createGame)} ETH
                    </p>
                  )}
                </div>
                <button
                  onClick={handleCreateGame}
                  disabled={isCreating}
                  className="flex items-center gap-3 rounded-xl border-2 border-red-400/30 bg-gradient-to-r from-red-600 to-red-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:from-red-500 hover:to-red-400 hover:shadow-red-900/50 disabled:from-gray-600 disabled:to-gray-600"
                >
                  {isCreating ? (
                    <>
                      <svg className="size-5 animate-spin" viewBox="0 0 24 24">
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">+</span>
                      Create New Game
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Tab Navigation */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setActiveTab("my-games")}
              className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === "my-games"
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-900/30"
                  : "border border-amber-700/40 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50"
              }`}
            >
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              My Games
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === "browse"
                  ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-900/30"
                  : "border border-amber-700/40 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50"
              }`}
            >
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Browse Games
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "my-games" ? (
            /* My Games Tab */
            <div className="space-y-8">
              {/* My Lobby Games */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-amber-100">
                    <svg
                      className="size-6 text-amber-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Waiting to Start
                    <span className="ml-2 text-sm font-normal text-amber-400/70">
                      (Games you&apos;re in)
                    </span>
                  </h2>
                  {sortedNotStartedGameIds.length > MY_GAMES_PER_PAGE && (
                    <span className="text-sm text-amber-400/70">
                      Page {myWaitingPage} of {Math.ceil(sortedNotStartedGameIds.length / MY_GAMES_PER_PAGE)}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sortedNotStartedGameIds.length === 0 ? (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-900/30 p-8 text-center sm:col-span-2">
                      <p className="text-amber-400/70">
                        No games in lobby. Create or join one!
                      </p>
                    </div>
                  ) : (
                    sortedNotStartedGameIds
                      .slice((myWaitingPage - 1) * MY_GAMES_PER_PAGE, myWaitingPage * MY_GAMES_PER_PAGE)
                      .map((gameId) => (
                        <MyGameCard
                          key={gameId.toString()}
                          gameId={gameId}
                          onEnter={handleEnterGame}
                          userAddress={address}
                          onDelete={handleDeleteGame}
                          isDeleting={isDeleting}
                        />
                      ))
                  )}
                </div>
                <PaginationControls
                  currentPage={myWaitingPage}
                  totalPages={Math.ceil(sortedNotStartedGameIds.length / MY_GAMES_PER_PAGE)}
                  onPageChange={setMyWaitingPage}
                  variant="default"
                />
              </section>

              {/* My Active Games */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-bold text-amber-100">
                    <svg
                      className="size-6 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    In Progress
                    <span className="ml-2 text-sm font-normal text-amber-400/70">
                      (Active games you&apos;re playing)
                    </span>
                  </h2>
                  {sortedActiveGameIds.length > MY_GAMES_PER_PAGE && (
                    <span className="text-sm text-amber-400/70">
                      Page {myActivePage} of {Math.ceil(sortedActiveGameIds.length / MY_GAMES_PER_PAGE)}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sortedActiveGameIds.length === 0 ? (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-900/30 p-8 text-center sm:col-span-2">
                      <p className="text-amber-400/70">
                        No active games you&apos;re participating in.
                      </p>
                    </div>
                  ) : (
                    sortedActiveGameIds
                      .slice((myActivePage - 1) * MY_GAMES_PER_PAGE, myActivePage * MY_GAMES_PER_PAGE)
                      .map((gameId) => (
                        <ActiveGameCard
                          key={gameId.toString()}
                          gameId={gameId}
                          onEnter={handleEnterGame}
                          userAddress={address}
                        />
                      ))
                  )}
                </div>
                <PaginationControls
                  currentPage={myActivePage}
                  totalPages={Math.ceil(sortedActiveGameIds.length / MY_GAMES_PER_PAGE)}
                  onPageChange={setMyActivePage}
                  variant="compact"
                />
              </section>
            </div>
          ) : (
            /* Browse Games Tab */
            <div className="space-y-6">
              {/* Search and Info Bar */}
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search game #..."
                    value={searchGameId}
                    onChange={(e) => {
                      setSearchGameId(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-xl border border-amber-700/50 bg-amber-900/40 px-4 py-3 pl-11 text-amber-100 placeholder-amber-500/60 transition-colors focus:border-amber-500 focus:outline-none"
                  />
                  <svg
                    className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-amber-500/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {totalWaitingGames > 0 && (
                  <div className="whitespace-nowrap rounded-xl border border-amber-700/40 bg-amber-900/30 px-4 py-3 text-sm text-amber-400/70">
                    Showing{" "}
                    {Math.min(currentPage * GAMES_PER_PAGE, totalWaitingGames)}{" "}
                    of {totalWaitingGames} games
                  </div>
                )}
              </div>

              {/* Games List */}
              <div className="grid gap-3 sm:grid-cols-2">
                {paginatedWaitingGames.length === 0 ? (
                  <div className="rounded-xl border border-amber-700/40 bg-amber-900/30 p-12 text-center sm:col-span-2">
                    <svg
                      className="mx-auto mb-4 size-12 text-amber-500/50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <p className="text-lg text-amber-400/70">
                      {searchGameId
                        ? `No games found matching "${searchGameId}"`
                        : "No games waiting for players. Create one!"}
                    </p>
                  </div>
                ) : (
                  paginatedWaitingGames.map((gameId) => (
                    <GameCard
                      key={gameId.toString()}
                      gameId={gameId}
                      isActive={false}
                      onJoin={handleShowRules}
                      onEnter={handleEnterGame}
                      isJoining={isJoining}
                      joinFee={fees?.joinGame ?? BigInt(0)}
                      userAddress={address}
                    />
                  ))
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="First page"
                  >
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Previous page"
                  >
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`h-10 w-10 rounded-lg font-medium transition-colors ${
                            currentPage === pageNum
                              ? "bg-gradient-to-r from-green-600 to-green-500 text-white"
                              : "border border-amber-700/50 bg-amber-900/40 text-amber-300 hover:bg-amber-800/50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Next page"
                  >
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-amber-700/50 bg-amber-900/40 p-2 text-amber-300 transition-colors hover:bg-amber-800/50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Last page"
                  >
                    <svg
                      className="size-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
