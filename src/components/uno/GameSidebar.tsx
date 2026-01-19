"use client";

import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GameSidebarProps {
  activeGameIds: readonly bigint[];
  notStartedGameIds: readonly bigint[];
  currentGameId: bigint | null;
  onSelectGame: (gameId: bigint) => void;
  onCreateGame: () => void;
  onJoinGame: (gameId: bigint) => void;
  createGameFee: bigint;
  joinGameFee: bigint;
  isCreating: boolean;
  isJoining: boolean;
  userAddress: `0x${string}` | undefined;
}

export function GameSidebar({
  activeGameIds,
  notStartedGameIds,
  currentGameId,
  onSelectGame,
  onCreateGame,
  onJoinGame,
  createGameFee,
  joinGameFee,
  isCreating,
  isJoining,
  userAddress,
}: GameSidebarProps) {
  return (
    <aside className="w-72 border-r-2 border-amber-800 flex flex-col h-full max-h-screen overflow-hidden bg-wood-panel">
      {/* Create Game Section */}
      <div className="p-4 border-b-2 border-amber-700/50 flex-shrink-0">
        <h2 className="text-sm font-bold text-amber-100 mb-3 text-balance drop-shadow">Create Game</h2>

        <div className="space-y-3">
          <Button
            onClick={() => onCreateGame()}
            disabled={isCreating || !userAddress}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white shadow-md"
          >
            {isCreating ? (
              <>
                <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Multiplayer Game"
            )}
          </Button>

          <p className="text-xs text-amber-200/80 tabular-nums">
            Fee: {formatEther(createGameFee)} ETH
          </p>
        </div>
      </div>

      {/* Games List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="pb-4">
        {/* Waiting Games (Lobbies) */}
        {notStartedGameIds.length > 0 && (
          <div className="p-4 border-b-2 border-amber-700/30">
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider mb-3">
              Open Lobbies ({notStartedGameIds.length})
            </h3>
            <div className="space-y-2">
              {notStartedGameIds.map((gameId) => {
                const isSelected = currentGameId === gameId;

                return (
                  <Card
                    key={gameId.toString()}
                    onClick={() => onSelectGame(gameId)}
                    className={`
                      cursor-pointer transition-all
                      ${isSelected
                        ? "bg-amber-100 border-2 border-amber-500 shadow-md"
                        : "bg-white/70 border-amber-200 hover:border-amber-400 hover:shadow-sm"
                      }
                    `}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-amber-900 tabular-nums font-semibold">
                          Game #{gameId.toString()}
                        </span>
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                          Waiting
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-amber-700">Tap to view</span>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onJoinGame(gameId);
                          }}
                          disabled={isJoining}
                          className="h-6 px-2 text-xs bg-green-600 hover:bg-green-500"
                        >
                          {isJoining ? "..." : "Join"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-amber-200/70 mt-2 tabular-nums">
              Join fee: {formatEther(joinGameFee)} ETH
            </p>
          </div>
        )}

        {/* Active Games */}
        {activeGameIds.length > 0 && (
          <div className="p-4">
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider mb-3">
              Active Games ({activeGameIds.length})
            </h3>
            <div className="space-y-2">
              {activeGameIds.map((gameId) => {
                const isSelected = currentGameId === gameId;

                return (
                  <Card
                    key={gameId.toString()}
                    onClick={() => onSelectGame(gameId)}
                    className={`
                      cursor-pointer transition-all
                      ${isSelected
                        ? "bg-amber-100 border-2 border-amber-500 shadow-md"
                        : "bg-white/70 border-amber-200 hover:border-amber-400 hover:shadow-sm"
                      }
                    `}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-amber-900 tabular-nums font-semibold">
                          Game #{gameId.toString()}
                        </span>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          Active
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs text-amber-700">Tap to play</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {activeGameIds.length === 0 && notStartedGameIds.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-amber-200/80 text-sm text-pretty">No active games found</p>
            <p className="text-amber-200/60 text-xs mt-1 text-pretty">Create a new game to get started</p>
          </div>
        )}
        </div>
      </ScrollArea>
    </aside>
  );
}
