"use client";

import { formatAddress, isBotAddress } from "@/utils/uno/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface GameLobbyProps {
  gameId: bigint;
  players: readonly `0x${string}`[];
  currentUserAddress: `0x${string}` | undefined;
  onStartGame: () => void;
  isStarting: boolean;
}

export function GameLobby({
  gameId,
  players,
  currentUserAddress,
  onStartGame,
  isStarting,
}: GameLobbyProps) {
  const isHost = players[0]?.toLowerCase() === currentUserAddress?.toLowerCase();
  const canStart = players.length >= 2;

  return (
    <div className="relative h-full">
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/waitingroom1.jpg')" }}
      />
      {/* Green overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a3d1a]/85 via-[#1a4d1a]/80 to-[#1a3d1a]/85" />
      
      {/* Content - scrollable */}
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="max-w-md w-full mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white drop-shadow-lg text-balance">Game Lobby</h2>
          <Badge variant="outline" className="mt-2 font-mono tabular-nums text-white bg-black/30 border-white/40">
            Game #{gameId.toString()}
          </Badge>
        </div>

        {/* Players list */}
        <Card className="bg-white/90 border-2 border-amber-700 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-900">
              Players ({players.length}/10)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {players.map((player, index) => {
              const isCurrentUser = player.toLowerCase() === currentUserAddress?.toLowerCase();
              const isBot = isBotAddress(player);

              return (
                <div
                  key={player}
                  className={`
                    flex items-center justify-between p-3 rounded-lg
                    ${isCurrentUser
                      ? "bg-amber-100 border-2 border-amber-500"
                      : "bg-amber-50 border border-amber-200"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className={`size-8 ${isBot ? "bg-red-600 border-2 border-red-800" : "bg-amber-600"}`}>
                      <AvatarFallback className={`text-sm font-bold ${isBot ? "text-yellow-400 bg-red-600" : "text-white bg-amber-600"}`}>
                        {isBot ? "B" : index + 1}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className={`font-mono text-sm ${isCurrentUser ? "text-amber-900 font-semibold" : "text-amber-800"}`}>
                        {isBot ? "Bot Player" : formatAddress(player)}
                      </p>
                      <div className="flex gap-2">
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-amber-200 text-amber-700">Host</Badge>
                        )}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-green-200 text-green-700">You</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="size-3 rounded-full bg-green-500 animate-pulse" />
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.min(4, 10 - players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center justify-between p-3 rounded-lg bg-amber-50/50 border border-dashed border-amber-300"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <span className="text-amber-500 text-sm">Waiting for player...</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="space-y-3">
          {isHost && (
            <Button
              onClick={onStartGame}
              disabled={!canStart || isStarting}
              className="w-full py-6 bg-green-600 hover:bg-green-500 text-white font-bold text-lg shadow-lg"
            >
              {isStarting ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Starting Game...
                </>
              ) : canStart ? (
                "Start Game"
              ) : (
                "Need at least 2 players"
              )}
            </Button>
          )}

          {!isHost && (
            <div className="text-center py-4">
              <Badge variant="outline" className="flex items-center justify-center gap-2 text-amber-700 bg-white/80 px-4 py-2 border-amber-300 shadow">
                <div className="size-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-pretty">Waiting for host to start the game...</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Share Game Info */}
        <Card className="bg-white/70 border-amber-300 shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Invite Friends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-amber-700">
              Share the Game ID <span className="font-bold">#{gameId.toString()}</span> with friends so they can search and join!
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
