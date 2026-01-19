"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Card } from "./Card";
import { type UnoCard } from "@/utils/uno/types";

interface PlayerHandProps {
  cards: UnoCard[];
  onPlayCard: (card: UnoCard, cardIndex: number) => void;
  isCurrentTurn: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PlayerHand({
  cards,
  onPlayCard,
  isCurrentTurn,
  isLoading = false,
  disabled = false,
}: PlayerHandProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleCardClick = (card: UnoCard, index: number) => {
    if (disabled || !isCurrentTurn) return;

    if (selectedCard === index) {
      // Double click to play - pass the index
      onPlayCard(card, index);
      setSelectedCard(null);
    } else {
      // First click to select
      setSelectedCard(index);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-full">
          <div className="size-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-amber-800">Decrypting your hand...</span>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-amber-800/60 bg-white/60 px-4 py-2 rounded-full">No cards in hand</span>
      </div>
    );
  }

  // Calculate fan layout
  const cardCount = cards.length;
  const maxFanAngle = 40; // Total spread angle
  const fanAngle = Math.min(6, maxFanAngle / Math.max(cardCount - 1, 1)); // Degrees between cards
  const totalAngle = (cardCount - 1) * fanAngle;
  const startAngle = -totalAngle / 2;

  // Calculate overlap based on card count
  const baseOverlap = 50; // Base overlap in pixels
  const overlap = cardCount > 10 ? 35 : cardCount > 7 ? 40 : baseOverlap;

  return (
    <div className="h-full flex flex-col justify-start pt-2">
      {/* Cards container with fanned layout */}
      <div className="relative flex justify-center items-start">
        <div
          className="relative flex justify-center"
          style={{
            width: `${Math.min(cardCount * overlap + 64, 700)}px`,
          }}
        >
          {cards.map((card, index) => {
            const rotation = startAngle + index * fanAngle;
            const isSelected = selectedCard === index;

            return (
              <motion.div
                key={`${card.id}-${index}`}
                initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: isSelected ? -24 : 0,
                  scale: isSelected ? 1.05 : 1,
                }}
                whileHover={
                  !disabled && isCurrentTurn && !shouldReduceMotion
                    ? { y: -12, transition: { duration: 0.15 } }
                    : {}
                }
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute cursor-pointer"
                style={{
                  left: `${index * overlap}px`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "bottom center",
                  zIndex: isSelected ? 100 : index,
                }}
              >
                <Card
                  card={card}
                  onClick={() => handleCardClick(card, index)}
                  isSelected={isSelected}
                  disabled={disabled || !isCurrentTurn}
                  size="md"
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Help text - only show on selection */}
      {isCurrentTurn && selectedCard !== null && (
        <p className="text-xs text-white/80 text-center bg-black/30 backdrop-blur-sm mx-auto px-4 py-1.5 rounded-full w-fit">
          Tap again to play
        </p>
      )}
    </div>
  );
}

// Skeleton loading state for the hand
export function PlayerHandSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <div className="h-4 w-20 bg-amber-200/50 rounded animate-pulse" />
        <div className="h-6 w-20 bg-amber-200/50 rounded-full animate-pulse" />
      </div>
      <div className="flex justify-center gap-[-20px] pb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="w-16 h-24 rounded-lg bg-red-400/40 animate-pulse shadow"
            style={{
              marginLeft: i > 0 ? "-30px" : 0,
              transform: `rotate(${-18 + i * 6}deg)`,
              zIndex: i,
            }}
          />
        ))}
      </div>
    </div>
  );
}
