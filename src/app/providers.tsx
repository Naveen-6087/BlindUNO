"use client";

import { type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionKeyProvider } from "@/utils/uno/sessionContext";

// Create a query client
const queryClient = new QueryClient();

// Configure wagmi
const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        // Appearance configuration
        appearance: {
          theme: "light",
          accentColor: "#d97706", // amber-600 to match game theme
          showWalletLoginFirst: true,
        },
        // Login methods
        loginMethods: ["wallet", "email", "google"],
        // Default chain
        defaultChain: baseSepolia,
        // Supported chains
        supportedChains: [baseSepolia],
        // Embedded wallet configuration
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <SessionKeyProvider>{children}</SessionKeyProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
