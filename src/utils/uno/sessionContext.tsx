"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  createSessionKeypair,
  createSessionVoucher,
  type IncoSession,
  type IncoKeypair,
  SESSION_DURATION_MS,
} from "./incoClient";

// Re-export types for external use
export type { IncoSession, IncoKeypair };

interface SessionKeyContextValue {
  sessionKey: IncoSession | null;
  isCreatingSession: boolean;
  sessionError: string | null;
  createSession: () => Promise<void>;
  revokeSession: () => void;
  isSessionValid: () => boolean;
}

const SessionKeyContext = createContext<SessionKeyContextValue | null>(null);

export function SessionKeyProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [sessionKey, setSessionKey] = useState<IncoSession | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const createSession = useCallback(async () => {
    if (!isConnected || !address) {
      setSessionError("Wallet not connected");
      return;
    }

    if (!walletClient) {
      setSessionError("Wallet client not available");
      return;
    }

    setIsCreatingSession(true);
    setSessionError(null);

    try {
      // 1. Generate a new session keypair using Inco SDK
      const keypair = createSessionKeypair();

      // 2. Create session voucher using Inco SDK
      // This will prompt the user to sign an EIP-712 message
      const { rawVoucher, expiresAt } = await createSessionVoucher(walletClient, keypair);

      // 3. Create session object
      const newSession: IncoSession = {
        keypair,
        rawVoucher,
        expiresAt,
      };

      // 4. Store session
      setSessionKey(newSession);

      console.log("Session created successfully, expires at:", expiresAt);
    } catch (err) {
      console.error("Session creation error:", err);
      setSessionError(
        err instanceof Error ? err.message : "Failed to create session"
      );
    } finally {
      setIsCreatingSession(false);
    }
  }, [isConnected, address, walletClient]);

  const revokeSession = useCallback(() => {
    setSessionKey(null);
    console.log("Session revoked");
  }, []);

  const isSessionValid = useCallback(() => {
    if (!sessionKey) return false;
    return sessionKey.expiresAt > new Date();
  }, [sessionKey]);

  return (
    <SessionKeyContext.Provider
      value={{
        sessionKey,
        isCreatingSession,
        sessionError,
        createSession,
        revokeSession,
        isSessionValid,
      }}
    >
      {children}
    </SessionKeyContext.Provider>
  );
}

export function useSessionKeyContext() {
  const context = useContext(SessionKeyContext);
  if (!context) {
    throw new Error(
      "useSessionKeyContext must be used within a SessionKeyProvider"
    );
  }
  return context;
}
