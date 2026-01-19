"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const { login, logout, authenticated } = usePrivy();
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-red-600 border-2 border-red-800 flex items-center justify-center shadow-lg shadow-red-900/50">
              <span className="text-yellow-400 text-sm font-black" style={{ transform: "rotate(-10deg)" }}>
                UNO
              </span>
            </div>
            <span className="text-xl font-bold text-white">Confidential UNO</span>
          </div>
          <nav className="flex items-center gap-4">
            {authenticated && isConnected && address ? (
              <>
                {/* Wallet Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowWalletMenu(!showWalletMenu)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-all"
                  >
                    <div className="size-2 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-300 font-mono">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    <svg className={`size-4 text-gray-400 transition-transform ${showWalletMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showWalletMenu && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowWalletMenu(false)} />
                      {/* Menu */}
                      <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-20 overflow-hidden">
                        <div className="p-3 border-b border-gray-700">
                          <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
                          <p className="text-sm text-white font-mono truncate">{address}</p>
                        </div>
                        <div className="p-1">
                          <button
                            onClick={copyAddress}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            {copied ? (
                              <>
                                <svg className="size-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Address
                              </>
                            )}
                          </button>
                          <button
                            onClick={async () => {
                              setShowWalletMenu(false);
                              await logout();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Disconnect Wallet
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Link
                  href="/games"
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-900/30 hover:shadow-red-800/50 hover:scale-105"
                >
                  Play Now
                </Link>
              </>
            ) : authenticated ? (
              <button
                onClick={async () => await logout()}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-all border border-gray-700"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={login}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/30 hover:shadow-amber-800/50 hover:scale-105 flex items-center gap-2"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Connect Wallet
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center pt-24 pb-16 px-6 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-green-600/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left - Content */}
          <div className="space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/80 rounded-full border border-gray-700">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-gray-300">Powered by Inco</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-black text-white leading-tight">
                Play <span className="text-red-500">UNO</span> with
                <br />
                <span className="bg-gradient-to-r from-yellow-400 via-green-400 to-blue-400 bg-clip-text text-transparent">
                  Encrypted Cards
                </span>
              </h1>
              <p className="text-xl text-gray-400 max-w-xl">
                The classic card game, reimagined for blockchain. Your cards stay private until you play them.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/games"
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-red-900/40 hover:shadow-red-800/60 hover:scale-105 flex items-center justify-center gap-2"
                >
                  Start Playing
                </Link>
            </div>
          </div>

          {/* Right - Card Display */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-80 h-80 lg:w-96 lg:h-96">
              {/* Floating cards */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 rotate-[-15deg] hover:rotate-[-5deg] transition-transform duration-500">
                <Image src="/red/red_5.png" alt="Red 5" width={120} height={180} className="drop-shadow-2xl" />
              </div>
              <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-4 rotate-[-25deg] hover:rotate-[-15deg] transition-transform duration-500">
                <Image src="/blue/blue_7.png" alt="Blue 7" width={120} height={180} className="drop-shadow-2xl" />
              </div>
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-4 rotate-[25deg] hover:rotate-[15deg] transition-transform duration-500">
                <Image src="/green/green_3.png" alt="Green 3" width={120} height={180} className="drop-shadow-2xl" />
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-4 rotate-[10deg] hover:rotate-[0deg] transition-transform duration-500">
                <Image src="/yellow/yellow_9.png" alt="Yellow 9" width={120} height={180} className="drop-shadow-2xl" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hover:scale-110 transition-transform duration-500">
                <Image src="/wild/wild_wild.png" alt="Wild Card" width={140} height={210} className="drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
 
    <section className="py-20 px-6 bg-gray-900/40 border-t border-gray-700/40">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            Why Confidential UNO?
          </h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
            A privacy-first UNO experience where your hand stays confidential, while gameplay
            stays verifiable and rule-enforced on-chain.
          </p>
        </div>

        {/* Layout */}
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          {/* Left: Feature Cards */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-700/60 hover:border-red-500/40 transition-colors">
              <div className="size-12 rounded-xl bg-red-500/15 flex items-center justify-center mb-6">
                <div className="size-5 rounded-full bg-red-500/60" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3">
                Confidential Hands
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your cards remain encrypted and access-controlled using Inco’s confidential
                execution layer and only you reveal what you play.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-700/60 hover:border-yellow-500/40 transition-colors">
              <div className="size-12 rounded-xl bg-yellow-500/15 flex items-center justify-center mb-6">
                <div className="size-5 rounded-full bg-yellow-500/60" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3">
                Rule-Enforced Gameplay
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Moves are validated by the smart contract, so players can’t skip turns, play
                invalid cards, or break core UNO mechanics.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-900/30 rounded-2xl p-8 border border-gray-700/60 hover:border-green-500/40 transition-colors sm:col-span-2">
              <div className="size-12 rounded-xl bg-green-500/15 flex items-center justify-center mb-6">
                <div className="size-5 rounded-full bg-green-500/60" />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3">
                On-Chain & Verifiable
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Each game runs on-chain, keeping match state consistent and auditable without
                exposing private hands.
              </p>

              <div className="mt-4 text-xs text-gray-500">
                Network: Base Sepolia (testnet)
              </div>
            </div>
          </div>

          {/* Right: Dealer */}
          <div className="relative flex justify-center lg:justify-start lg:pl-45 lg:ml-30">
            {/* Glow behind */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[520px] w-[520px] rounded-full blur-3xl opacity-30 bg-gradient-to-r from-red-500/25 via-yellow-500/15 to-green-500/25" />
            </div>

            {/* Dealer Image */}
            <div className="relative w-[420px] h-[520px]">
              <Image
                src="/dealer.png"
                alt="Confidential UNO dealer"
                fill
                priority
                className="object-contain scale-[3.4] origin-center"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
{/* How it Works */}
<section className="py-20 px-6 overflow-hidden">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold text-white text-center mb-3">
      How It Works
    </h2>
    <p className="text-center text-gray-400 max-w-2xl mx-auto mb-14">
      A simple on-chain flow — private hands, verifiable moves, and rule-enforced gameplay.
    </p>

    {/* Desktop: Arrow Flow */}
    <div className="hidden md:flex items-stretch justify-between gap-0">
      {[
        {
          step: "01",
          title: "Connect Wallet",
          desc: "Authenticate with your wallet to access confidential gameplay.",
          accent: "hover:border-red-500/60 hover:shadow-[0_0_40px_rgba(239,68,68,0.25)]",
          glow: "group-hover:bg-red-500/10",
        },
        {
          step: "02",
          title: "Create or Join",
          desc: "Start a new match or join an open lobby with other players.",
          accent: "hover:border-yellow-500/60 hover:shadow-[0_0_40px_rgba(234,179,8,0.25)]",
          glow: "group-hover:bg-yellow-500/10",
        },
        {
          step: "03",
          title: "Play Securely",
          desc: "Hands stay private — only your played card becomes visible.",
          accent: "hover:border-green-500/60 hover:shadow-[0_0_40px_rgba(34,197,94,0.25)]",
          glow: "group-hover:bg-green-500/10",
        },
        {
          step: "04",
          title: "Win On-Chain",
          desc: "Empty your hand first. The contract validates the full game flow.",
          accent: "hover:border-blue-500/60 hover:shadow-[0_0_40px_rgba(59,130,246,0.25)]",
          glow: "group-hover:bg-blue-500/10",
        },
      ].map((item, idx) => (
        <div
          key={item.step}
          className={`group relative flex-1 min-h-[170px] border border-gray-700/60 bg-gray-900/25 transition-all duration-300 ${item.accent}`}
          style={{
            clipPath:
              idx === 3
                ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 6% 50%)"
                : "polygon(0% 0%, 94% 0%, 100% 50%, 94% 100%, 0% 100%, 6% 50%)",
          }}
        >
          {/* inner content */}
          <div className="relative h-full p-7">
            {/* subtle hover glow overlay */}
            <div
              className={`pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${item.glow}`}
            />

            <div className="relative flex items-start justify-between mb-5">
              <span className="text-xs tracking-[0.25em] text-gray-500">
                STEP {item.step}
              </span>

              <div className="size-9 rounded-xl border border-gray-700/60 bg-gray-800/40 flex items-center justify-center">
                <div className="size-2.5 rounded-full bg-gray-500/70 group-hover:bg-white/80 transition-colors" />
              </div>
            </div>

            <h3 className="relative text-lg font-semibold text-white mb-2">
              {item.title}
            </h3>
            <p className="relative text-sm text-gray-400 leading-relaxed max-w-[240px]">
              {item.desc}
            </p>
          </div>

          {/* connector overlap (so arrows interlock) */}
          {idx !== 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-transparent" />
          )}
        </div>
      ))}
    </div>

    {/* Mobile: Stacked cards */}
    <div className="md:hidden flex flex-col gap-6">
      {[
        {
          step: "01",
          title: "Connect Wallet",
          desc: "Authenticate with your wallet to access confidential gameplay.",
        },
        {
          step: "02",
          title: "Create or Join",
          desc: "Start a new match or join an open lobby with other players.",
        },
        {
          step: "03",
          title: "Play Securely",
          desc: "Hands stay private — only your played card becomes visible.",
        },
        {
          step: "04",
          title: "Win On-Chain",
          desc: "Empty your hand first. The contract validates the full game flow.",
        },
      ].map((item) => (
        <div
          key={item.step}
          className="bg-gray-900/25 border border-gray-700/60 rounded-2xl p-7"
        >
          <div className="text-xs tracking-[0.25em] text-gray-500 mb-4">
            STEP {item.step}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {item.title}
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>

{/* Footer */}
<footer className="py-8 px-6 border-t border-gray-800">
  <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="size-8 rounded-lg bg-red-600 border border-red-800 flex items-center justify-center">
        <span
          className="text-yellow-400 text-xs font-black"
          style={{ transform: "rotate(-10deg)" }}
        >
          UNO
        </span>
      </div>
      <span className="text-gray-400">Confidential UNO © 2026</span>
    </div>

    <div className="flex items-center gap-6 text-gray-500 text-sm">
      <span>Built with Inco Network</span>
      <span>•</span>
      <span>Base Sepolia</span>
    </div>
  </div>
</footer>


    </div>
  );
}
