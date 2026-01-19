"use client";

import { formatEther } from "viem";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useBalance } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GameHeaderProps {
  currentGameId: bigint | null;
  encryptionFee: bigint;
  sessionActive?: boolean;
  sessionExpiresAt?: Date | null;
  onRevokeSession?: () => void;
  onBack?: () => void;
}

export function GameHeader({
  currentGameId,
  encryptionFee,
  sessionActive = false,
  sessionExpiresAt,
  onRevokeSession,
  onBack,
}: GameHeaderProps) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  
  // Get the first connected wallet
  const activeWallet = wallets[0];
  const walletAddress = activeWallet?.address as `0x${string}` | undefined;
  
  // Get wallet balance
  const { data: balance } = useBalance({
    address: walletAddress,
    chainId: baseSepolia.id,
  });

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate time remaining for session
  const getTimeRemaining = () => {
    if (!sessionExpiresAt) return null;
    const now = new Date();
    const diff = sessionExpiresAt.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    if (minutes >= 60) {
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };
  return (
    <TooltipProvider>
      <header className="flex items-center justify-between px-6 py-4 border-b-2 border-amber-800 bg-wood-panel">
        {/* Logo / Title */}
        <div className="flex items-center gap-4">
          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-black/20 text-amber-200 transition-colors"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          
          <div className="flex items-center gap-2">
            <div className="size-10 rounded-lg bg-red-600 border-2 border-red-800 flex items-center justify-center shadow-md">
              <span
                className="text-yellow-400 font-black text-sm"
                style={{ transform: "rotate(-10deg)" }}
              >
                UNO
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-100 drop-shadow text-balance">Confidential UNO</h1>
              <p className="text-xs text-amber-200/80">Powered by Inco</p>
            </div>
          </div>

          {/* Current game indicator */}
          {currentGameId && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-black/20 border-amber-200/50">
              <div className="size-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-amber-100 font-mono tabular-nums">
                Game #{currentGameId.toString()}
              </span>
            </Badge>
          )}

          {/* Session key indicator */}
          {sessionActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 border-green-300">
                  <svg className="size-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Session Active</span>
                  {sessionExpiresAt && (
                    <span className="text-xs text-green-600 tabular-nums">
                      ({getTimeRemaining()})
                    </span>
                  )}
                  {onRevokeSession && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRevokeSession();
                      }}
                      className="ml-1 p-0.5 text-green-600 hover:text-red-600 transition-colors"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Session key for seamless gameplay. Click X to revoke.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Right side - Wallet & Info */}
        <div className="flex items-center gap-4">
          {/* Fee indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden md:flex flex-col items-end cursor-help">
                <span className="text-xs text-amber-200/80">Network Fee</span>
                <span className="text-sm text-amber-100 font-mono tabular-nums">
                  {formatEther(encryptionFee)} ETH
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Fee paid to Inco network for FHE encryption</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-8 hidden md:block" />

          {/* Wallet connect with Privy */}
          {!ready ? (
            <Button variant="secondary" disabled>
              Loading...
            </Button>
          ) : !authenticated ? (
            <Button onClick={login} className="bg-amber-600 hover:bg-amber-500 text-white shadow-md">
              Connect Wallet
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {/* Chain indicator */}
              <Badge variant="secondary" className="hidden sm:flex items-center gap-2 px-3 py-2 bg-black/20 border-amber-200/50">
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: "#0052FF",
                  }}
                />
                <span className="text-sm text-amber-100">Base Sepolia</span>
              </Badge>

              {/* Account dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 bg-black/20 hover:bg-black/30 border-amber-200/50">
                    <span className="text-sm text-amber-100 font-mono">
                      {walletAddress ? formatAddress(walletAddress) : user?.email?.address || "Connected"}
                    </span>
                    {balance && (
                      <span className="hidden sm:inline text-sm text-amber-200/80 tabular-nums">
                        {parseFloat(formatEther(balance.value)).toFixed(4)} ETH
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {walletAddress && (
                    <DropdownMenuItem
                      onClick={() => navigator.clipboard.writeText(walletAddress)}
                      className="cursor-pointer"
                    >
                      <svg className="size-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Address
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => window.open(`https://sepolia.basescan.org/address/${walletAddress}`, "_blank")}
                    className="cursor-pointer"
                  >
                    <svg className="size-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Explorer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                    <svg className="size-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
}
