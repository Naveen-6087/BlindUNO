import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Contract address
const CONTRACT_ADDRESS = "0xCE1Bbb81E30CeC15a2Cf9E9DA33F3C2D5d5869Fa"; // Update after deployment

// Contract ABI (only what we need for testing)
const CONTRACT_ABI = [
  {
    name: "createGame",
    type: "function",
    inputs: [{ name: "_creator", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    name: "deleteGame",
    type: "function",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getNotStartedGames",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    name: "getGameState",
    type: "function",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "players", type: "address[]" },
          { name: "status", type: "uint8" },
          { name: "topCardId", type: "uint16" },
          { name: "currentPlayerIndex", type: "uint256" },
          { name: "direction", type: "int8" },
          { name: "currentColor", type: "uint8" },
          { name: "winner", type: "address" },
          { name: "gameHash", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    name: "GameDeleted",
    type: "event",
    inputs: [{ name: "gameId", type: "uint256", indexed: true }],
  },
] as const;

async function main() {
  // Setup
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not found in environment");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC),
  }).extend(publicActions);

  console.log("Testing deleteGame function...");
  console.log("Account:", account.address);
  console.log("Contract:", CONTRACT_ADDRESS);
  console.log("");

  // Step 1: Get the fee
  console.log("Step 1: Getting encryption fee...");
  const feeResult = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: [
      {
        name: "getEncryptionFee",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ],
    functionName: "getEncryptionFee",
  });
  console.log("Fee:", feeResult.toString());

  // Step 2: Create a game
  console.log("\nStep 2: Creating a new game...");
  const createTxHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "createGame",
    args: [account.address],
    value: feeResult,
  });
  console.log("Create TX Hash:", createTxHash);

  // Wait for the transaction
  const createReceipt = await client.waitForTransactionReceipt({ hash: createTxHash });
  console.log("Create TX Status:", createReceipt.status);

  // Step 3: Get not started games to find the game ID
  console.log("\nStep 3: Getting not started games...");
  const notStartedGames = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getNotStartedGames",
  });
  console.log("Not started games:", notStartedGames.map(id => id.toString()));

  if (notStartedGames.length === 0) {
    console.log("No games to delete!");
    return;
  }

  // Get the latest game (should be the one we just created)
  const gameIdToDelete = notStartedGames[notStartedGames.length - 1];
  console.log("Game ID to delete:", gameIdToDelete.toString());

  // Step 4: Verify game exists
  console.log("\nStep 4: Verifying game exists...");
  const gameState = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getGameState",
    args: [gameIdToDelete],
  });
  console.log("Game ID:", gameState.id.toString());
  console.log("Players:", gameState.players);
  console.log("Status:", gameState.status);

  // Step 5: Delete the game
  console.log("\nStep 5: Deleting the game...");
  const deleteTxHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "deleteGame",
    args: [gameIdToDelete],
  });
  console.log("Delete TX Hash:", deleteTxHash);

  // Wait for the transaction
  const deleteReceipt = await client.waitForTransactionReceipt({ hash: deleteTxHash });
  console.log("Delete TX Status:", deleteReceipt.status);

  // Step 6: Verify game is deleted
  console.log("\nStep 6: Verifying game is deleted...");
  const notStartedGamesAfter = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getNotStartedGames",
  });
  console.log("Not started games after delete:", notStartedGamesAfter.map(id => id.toString()));

  // Check if the game is no longer in the list
  const gameStillExists = notStartedGamesAfter.some(id => id === gameIdToDelete);
  if (gameStillExists) {
    console.log("❌ ERROR: Game still exists in the list!");
  } else {
    console.log("✅ SUCCESS: Game was deleted successfully!");
  }

  // Try to read the game state (should fail or return empty)
  console.log("\nStep 7: Trying to read deleted game state...");
  try {
    const deletedGameState = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getGameState",
      args: [gameIdToDelete],
    });
    console.log("Deleted game ID:", deletedGameState.id.toString());
    if (deletedGameState.id === 0n) {
      console.log("✅ Game state is cleared (ID = 0)");
    } else {
      console.log("❌ Game state still has data");
    }
  } catch (error) {
    console.log("✅ Could not read deleted game (expected)");
  }

  console.log("\n=== Test Complete ===");
}

main().catch(console.error);
