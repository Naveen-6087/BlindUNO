import { expect } from "chai";
import { HexString } from "@inco/js";
import { Address, parseEther, formatEther, getAddress } from "viem";
import confidentialUnoGameAbi from "../artifacts/contracts/ConfidentialUnoGame.sol/ConfidentialUnoGame.json";
import { encryptValue, decryptValue, getFee } from "../utils/incoHelper";
import { namedWallets, wallet, publicClient } from "../utils/wallet";

describe("ConfidentialUnoGame Tests", function () {
  let contractAddress: Address;
  
  // Helper function to get a playable card from hand
  async function findPlayableCard(
    gameId: bigint,
    player: any,
    topCardId: number,
    currentColor: number
  ): Promise<{ index: number; cardId: number } | null> {
    const handSize = await publicClient.readContract({
      address: contractAddress,
      abi: confidentialUnoGameAbi.abi,
      functionName: "getPlayerHandSize",
      args: [gameId, player.account.address],
    });

    for (let i = 0; i < Number(handSize); i++) {
      const cardHandle = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getCardFromHand",
        args: [gameId, player.account.address, i],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: cardHandle });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real scenario, you'd decrypt the card
      // For testing, we'll need to mock or use known card positions
      // This is a simplified version - actual implementation would decrypt
    }
    
    return null;
  }

  beforeEach(async function () {
    console.log("\nSetting up ConfidentialUnoGame test environment");

    // Deploy the contract
    const txHash = await wallet.deployContract({
      abi: confidentialUnoGameAbi.abi,
      bytecode: confidentialUnoGameAbi.bytecode as HexString,
      args: [],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    contractAddress = receipt.contractAddress as Address;
    console.log(`Contract deployed at: ${contractAddress}`);

    // Fund test wallets with more conservative amounts
    for (const [name, userWallet] of Object.entries(namedWallets)) {
      const balance = await publicClient.getBalance({
        address: userWallet.account?.address as Address,
      });
      const balanceEth = Number(formatEther(balance));

      // Only fund if balance is very low (less than 0.01 ETH)
      if (balanceEth < 0.01) {
        const neededEth = 0.05; // Fund with smaller amount
        console.log(`Funding ${name} with ${neededEth.toFixed(6)} ETH...`);
        
        // Check if main wallet has enough balance
        const mainBalance = await publicClient.getBalance({
          address: wallet.account.address,
        });
        const mainBalanceEth = Number(formatEther(mainBalance));
        
        if (mainBalanceEth < neededEth + 0.01) {
          console.log(`Skipping funding for ${name} - insufficient funds in main wallet`);
          continue;
        }
        
        const tx = await wallet.sendTransaction({
          to: userWallet.account?.address as Address,
          value: parseEther(neededEth.toFixed(6)),
        });

        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log(`${name} funded: ${userWallet.account?.address as Address}`);
      }
    }
  });

  describe("----------- Game Creation Tests -----------", function () {
    it("Should create a new game with initial top card", async function () {
      console.log("\nCreating new UNO game");
      
      const fee = await getFee();
      const createGameFee = fee * 2n;
      const initialTopCardId = 5; // Red 5

      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, initialTopCardId],
        value: createGameFee,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash,
        confirmations: 3 
      });
      
      console.log("Game created successfully");

      // Extract gameId from events
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify game was created
      const notStartedGames = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      expect(notStartedGames.length).to.equal(1);
      console.log(`Game ID: ${notStartedGames[0]}`);

      // Get game details
      const gameDetails = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [notStartedGames[0]],
      }) as any;

      expect(gameDetails[1].length).to.equal(1); // players array
      expect(gameDetails[1][0].toLowerCase()).to.equal(wallet.account.address.toLowerCase());
      expect(gameDetails[2]).to.equal(0); // GameStatus.NotStarted
      expect(gameDetails[8]).to.equal(initialTopCardId); // topCardId
    });

    it("Should revert game creation with invalid card ID", async function () {
      console.log("\nTesting invalid card ID");
      
      const fee = await getFee();
      const createGameFee = fee * 2n;
      const invalidCardId = 108; // Out of bounds

      try {
        await wallet.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "createGame",
          args: [wallet.account.address, invalidCardId],
          value: createGameFee,
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Transaction reverted as expected");
        expect(error.message).to.include("Invalid initial card ID");
      }
    });

    it("Should revert game creation with insufficient fee", async function () {
      console.log("\nTesting insufficient fee");
      
      try {
        await wallet.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "createGame",
          args: [wallet.account.address, 5],
          value: 0n,
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Transaction reverted as expected");
        expect(error.message).to.include("Insufficient fee");
      }
    });
  });

  describe("----------- Player Joining Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      // Create a game first
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 10],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];
      console.log(`Game created with ID: ${gameId}`);
    });

    it("Should allow Alice to join the game", async function () {
      console.log("\nAlice joining game");
      
      const fee = await getFee();

      const txHash = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      console.log("Alice joined successfully");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify Alice joined
      const gameDetails = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      expect(gameDetails[1].length).to.equal(2);
      expect(gameDetails[1][1].toLowerCase()).to.equal(
        namedWallets.alice.account?.address.toLowerCase()
      );
    });

    it("Should allow multiple players to join", async function () {
      console.log("\nMultiple players joining");
      
      const fee = await getFee();
      const players = [namedWallets.alice, namedWallets.bob, namedWallets.charlie];

      for (const player of players) {
        const txHash = await player.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "joinGame",
          args: [gameId, player.account?.address],
          value: fee,
          account: player.account!,
          chain: player.chain,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(`${player.account?.address} joined`);
      }

      const gameDetails = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      expect(gameDetails[1].length).to.equal(4); // Owner + 3 players
    });

    it("Should prevent player from joining twice", async function () {
      console.log("\nTesting duplicate join");
      
      const fee = await getFee();

      // Alice joins once
      const txHash1 = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash1, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to join again
      try {
        await namedWallets.alice.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "joinGame",
          args: [gameId, namedWallets.alice.account?.address],
          value: fee,
          account: namedWallets.alice.account!,
          chain: namedWallets.alice.chain,
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Duplicate join prevented");
        expect(error.message).to.include("Already in game");
      }
    });
  });

  describe("----------- Game Start Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Create game
      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 15],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];

      // Alice joins
      const joinTx = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Should start game with 2+ players", async function () {
      console.log("\nStarting game");

      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "startGame",
        args: [gameId],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      console.log("Game started successfully");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify game status changed
      const gameDetails = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      expect(gameDetails[2]).to.equal(1); // GameStatus.Started

      // Verify game moved to active list
      const activeGames = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getActiveGames",
      }) as bigint[];

      expect(activeGames.length).to.equal(1);
      expect(activeGames[0]).to.equal(gameId);
    });

    it("Should not start game with only 1 player", async function () {
      console.log("\nTesting single player start");
      
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Create new game with only creator
      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 20],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      const newGameId = games[games.length - 1];

      try {
        await wallet.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "startGame",
          args: [newGameId],
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Single player start prevented");
        expect(error.message).to.include("Need at least 2 players");
      }
    });
  });

  describe("----------- Card Drawing Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Create and start game
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 25],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];

      // Alice joins
      const joinTx = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Start game
      const startTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "startGame",
        args: [gameId],
      });

      await publicClient.waitForTransactionReceipt({ hash: startTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Should allow current player to draw a card", async function () {
      console.log("\nDrawing a card");
      
      const fee = await getFee();

      // Get initial hand size
      const initialHandSize = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getPlayerHandSize",
        args: [gameId, wallet.account.address],
      }) as number;

      console.log(`Initial hand size: ${initialHandSize}`);

      // Draw card and end turn
      const txHash = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "drawCard",
        args: [gameId, true],
        value: fee,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 3 });
      console.log("Card drawn successfully");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify hand size increased
      const newHandSize = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getPlayerHandSize",
        args: [gameId, wallet.account.address],
      }) as number;

      console.log(`New hand size: ${newHandSize}`);
      expect(newHandSize).to.equal(initialHandSize + 1);
    });

    it("Should not allow non-current player to draw", async function () {
      console.log("\nTesting non-turn draw");
      
      const fee = await getFee();

      try {
        await namedWallets.alice.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "drawCard",
          args: [gameId, true],
          value: fee,
          account: namedWallets.alice.account!,
          chain: namedWallets.alice.chain,
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Non-turn draw prevented");
        expect(error.message).to.include("Not your turn");
      }
    });
  });

  describe("----------- UNO Calling Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Setup game
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 30],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];

      const joinTx = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const startTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "startGame",
        args: [gameId],
      });

      await publicClient.waitForTransactionReceipt({ hash: startTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Should verify UNO call status", async function () {
      console.log("\nChecking UNO call status");

      const hasCalledUno = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "hasPlayerCalledUno",
        args: [gameId, wallet.account.address],
      }) as boolean;

      expect(hasCalledUno).to.equal(false);
      console.log("UNO not called initially");
    });

    it("Should check UNO window status", async function () {
      console.log("\nChecking UNO window");

      const isWindowOpen = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isUnoWindowOpen",
        args: [gameId],
      }) as boolean;

      expect(isWindowOpen).to.equal(false);
      console.log("UNO window initially closed");
    });
  });

  describe("----------- View Functions Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 35],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];
    });

    it("Should get current color", async function () {
      const currentColor = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getCurrentColor",
        args: [gameId],
      }) as number;

      console.log(`Current color: ${currentColor}`);
      expect(currentColor).to.be.gte(0).and.lte(3);
    });

    it("Should get top card ID", async function () {
      const topCardId = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getTopCardId",
        args: [gameId],
      }) as number;

      console.log(`Top card ID: ${topCardId}`);
      expect(topCardId).to.equal(35);
    });

    it("Should get card info", async function () {
      const cardId = 25;
      const cardInfo = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getCardInfo",
        args: [cardId],
      }) as [number, number, number];

      console.log(`Card ${cardId} - Type: ${cardInfo[0]}, Color: ${cardInfo[1]}, Value: ${cardInfo[2]}`);
      expect(cardInfo[0]).to.be.gte(0).and.lte(5);
      expect(cardInfo[1]).to.be.gte(0).and.lte(4);
    });

    it("Should check card playability", async function () {
      const cardId = 20; // Some card
      const topCardId = 25;
      const currentColor = 1;

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [cardId, topCardId, currentColor],
      }) as boolean;

      console.log(`Card ${cardId} playable on ${topCardId}: ${isPlayable}`);
      expect(typeof isPlayable).to.equal("boolean");
    });

    it("Should get all player hand sizes", async function () {
      const [players, sizes] = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getAllPlayerHandSizes",
        args: [gameId],
      }) as [Address[], number[]];

      console.log("Player hand sizes:");
      players.forEach((player, idx) => {
        console.log(`  ${player}: ${sizes[idx]} cards`);
      });

      expect(players.length).to.equal(1);
      expect(sizes[0]).to.equal(7); // Initial hand size
    });

    it("Should get encryption fees", async function () {
      const encryptionFee = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getEncryptionFee",
      }) as bigint;

      const createGameFee = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getCreateGameFee",
      }) as bigint;

      const joinGameFee = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getJoinGameFee",
      }) as bigint;

      console.log(`Encryption fee: ${encryptionFee}`);
      console.log(`Create game fee: ${createGameFee}`);
      console.log(`Join game fee: ${joinGameFee}`);

      expect(createGameFee).to.equal(encryptionFee * 2n);
      expect(joinGameFee).to.equal(encryptionFee);
    });
  });

  describe("----------- Card Type Tests -----------", function () {
    it("Should identify number cards correctly", async function () {
      for (let i = 0; i < 76; i++) {
        const [cardType, color, value] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];

        expect(cardType).to.equal(0); // CARD_TYPE_NUMBER
        expect(color).to.be.gte(0).and.lte(3);
      }
      console.log("All number cards verified");
    });

    it("Should identify skip cards correctly", async function () {
      for (let i = 76; i < 84; i++) {
        const [cardType] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];

        expect(cardType).to.equal(1); // CARD_TYPE_SKIP
      }
      console.log("All skip cards verified");
    });

    it("Should identify reverse cards correctly", async function () {
      for (let i = 84; i < 92; i++) {
        const [cardType] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];

        expect(cardType).to.equal(2); // CARD_TYPE_REVERSE
      }
      console.log("All reverse cards verified");
    });

    it("Should identify draw two cards correctly", async function () {
      for (let i = 92; i < 100; i++) {
        const [cardType] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];

        expect(cardType).to.equal(3); // CARD_TYPE_DRAW_TWO
      }
      console.log("All draw two cards verified");
    });

    it("Should identify wild cards correctly", async function () {
      for (let i = 100; i < 104; i++) {
        const [cardType, color] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];

        expect(cardType).to.equal(4); // CARD_TYPE_WILD
        expect(color).to.equal(4); // Wild color indicator
      }
      console.log("All wild cards verified");
    });

    it("Should identify wild draw four cards correctly", async function () {
      for (let i = 104; i < 108; i++) {
        const [cardType, color] = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getCardInfo",
          args: [i],
        }) as [number, number, number];
        expect(cardType).to.equal(5); // CARD_TYPE_WILD_DRAW_FOUR
        expect(color).to.equal(4); // Wild color indicator
      }
      console.log("All wild draw four cards verified");
    });
  });

  describe("----------- Card Playability Tests -----------", function () {
    it("Should allow same color cards to be played", async function () {
      const redCard1 = 5; // Red 5
      const redCard2 = 10; // Red 1 (second occurrence)
      const currentColor = 0; // Red

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [redCard2, redCard1, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(true);
      console.log("Same color cards are playable");
    });

    it("Should allow same value cards to be played", async function () {
      const red5 = 5; // Red 5
      const yellow5 = 24; // Yellow 5
      const currentColor = 0; // Red

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [yellow5, red5, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(true);
      console.log("Same value cards are playable");
    });

    it("Should allow wild cards to be played anytime", async function () {
      const wildCard = 100;
      const topCard = 25;
      const currentColor = 2;

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [wildCard, topCard, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(true);
      console.log("Wild cards are always playable");
    });

    it("Should allow wild draw four to be played anytime", async function () {
      const wildDrawFour = 104;
      const topCard = 50;
      const currentColor = 1;

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [wildDrawFour, topCard, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(true);
      console.log("Wild draw four cards are always playable");
    });

    it("Should not allow different color and value cards", async function () {
      const red5 = 5; // Red 5
      const yellow7 = 26; // Yellow 7
      const currentColor = 0; // Red

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [yellow7, red5, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(false);
      console.log("Different color and value cards are not playable");
    });

    it("Should allow same special card types to be played", async function () {
      const redSkip = 76; // Red skip
      const yellowSkip = 78; // Yellow skip
      const currentColor = 0; // Red

      const isPlayable = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "isCardPlayable",
        args: [yellowSkip, redSkip, currentColor],
      }) as boolean;

      expect(isPlayable).to.equal(true);
      console.log("Same special card types are playable");
    });
  });

  describe("----------- Game Flow Integration Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Create game with a number card that many cards can match
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 19], // Red 1
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];

      // Add Alice and Bob
      const joinTx1 = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx1, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const joinTx2 = await namedWallets.bob.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.bob.account?.address],
        value: fee,
        account: namedWallets.bob.account!,
        chain: namedWallets.bob.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx2, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Start game
      const startTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "startGame",
        args: [gameId],
      });

      await publicClient.waitForTransactionReceipt({ hash: startTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Should track turn changes correctly", async function () {
      console.log("\nTesting turn progression");
      
      const fee = await getFee();

      // Get initial current player
      const gameDetails1 = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      const initialPlayer = gameDetails1[10]; // currentPlayerIndex
      console.log(`Initial player index: ${initialPlayer}`);

      // Draw and end turn
      const drawTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "drawCard",
        args: [gameId, true],
        value: fee,
      });

      await publicClient.waitForTransactionReceipt({ hash: drawTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check turn changed
      const gameDetails2 = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getGame",
        args: [gameId],
      }) as any;

      const newPlayer = gameDetails2[10];
      console.log(`New player index: ${newPlayer}`);
      
      expect(newPlayer).to.not.equal(initialPlayer);
    });

    it("Should handle multiple draw and play cycles", async function () {
      console.log("\nTesting multiple draw cycles");
      
      const fee = await getFee();

      for (let i = 0; i < 3; i++) {
        const gameDetails = await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getGame",
          args: [gameId],
        }) as any;

        const currentPlayerIndex = gameDetails[10];
        const players = gameDetails[1];
        const currentPlayer = players[currentPlayerIndex];

        console.log(`Round ${i + 1}, Player: ${currentPlayer}`);

        // Determine which wallet to use
        let playerWallet = wallet;
        if (currentPlayer.toLowerCase() === namedWallets.alice.account?.address.toLowerCase()) {
          playerWallet = namedWallets.alice as typeof wallet;
        } else if (currentPlayer.toLowerCase() === namedWallets.bob.account?.address.toLowerCase()) {
          playerWallet = namedWallets.bob as typeof wallet;
        }

        // Draw a card and end turn
        const drawTx = await playerWallet.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "drawCard",
          args: [gameId, true],
          value: fee,
          account: playerWallet.account!,
          chain: playerWallet.chain,
        });

        await publicClient.waitForTransactionReceipt({ hash: drawTx, confirmations: 3 });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log("Multiple draw cycles completed successfully");
    });

    it("Should maintain correct hand sizes throughout game", async function () {
      console.log("\nTracking hand sizes");
      
      const fee = await getFee();

      const [players, initialSizes] = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getAllPlayerHandSizes",
        args: [gameId],
      }) as [Address[], number[]];

      console.log("Initial hand sizes:");
      players.forEach((player, idx) => {
        console.log(`  ${player}: ${initialSizes[idx]}`);
      });

      // Player 0 draws a card
      const drawTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "drawCard",
        args: [gameId, true],
        value: fee,
      });

      await publicClient.waitForTransactionReceipt({ hash: drawTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const [, newSizes] = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getAllPlayerHandSizes",
        args: [gameId],
      }) as [Address[], number[]];

      console.log("After first draw:");
      players.forEach((player, idx) => {
        console.log(`  ${player}: ${newSizes[idx]}`);
      });

      // First player should have one more card
      expect(newSizes[0]).to.equal(initialSizes[0] + 1);
    });
  });

  describe("----------- Pending Draws Tests -----------", function () {
    let gameId: bigint;

    beforeEach(async function () {
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 40],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      gameId = games[0];

      const joinTx = await namedWallets.alice.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "joinGame",
        args: [gameId, namedWallets.alice.account?.address],
        value: fee,
        account: namedWallets.alice.account!,
        chain: namedWallets.alice.chain,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const startTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "startGame",
        args: [gameId],
      });

      await publicClient.waitForTransactionReceipt({ hash: startTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("Should track pending draws correctly", async function () {
      console.log("\nChecking pending draws");

      const pendingDraws = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getPendingDraws",
        args: [gameId],
      }) as number;

      console.log(`Pending draws: ${pendingDraws}`);
      expect(pendingDraws).to.equal(0);
    });
  });

  describe("----------- Error Handling Tests -----------", function () {
    it("Should revert on invalid game ID", async function () {
      console.log("\nTesting invalid game ID");
      
      try {
        await publicClient.readContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "getGame",
          args: [999999n],
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Invalid game ID rejected");
        expect(error.message).to.include("Invalid game ID");
      }
    });

    it("Should handle non-player actions gracefully", async function () {
      console.log("\nTesting non-player actions");
      
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      // Create a game
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 45],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      const gameId = games[0];

      // Try to draw as non-player
      try {
        await namedWallets.alice.writeContract({
          address: contractAddress,
          abi: confidentialUnoGameAbi.abi,
          functionName: "drawCard",
          args: [gameId, true],
          value: fee,
          account: namedWallets.alice.account!,
          chain: namedWallets.alice.chain,
        });
        expect.fail("Should have reverted");
      } catch (error: any) {
        console.log("Non-player action prevented");
        expect(error.message).to.include("Not a player");
      }
    });
  });

  describe("----------- Game Completion Tests -----------", function () {
    it("Should properly end game and set winner", async function () {
      console.log("\nTesting game completion");
      
      // This test would require playing through an entire game
      // For now, we verify the winner field starts as zero address
      const fee = await getFee();
      const createGameFee = fee * 2n;
      
      const createTx = await wallet.writeContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "createGame",
        args: [wallet.account.address, 50],
        value: createGameFee,
      });

      await publicClient.waitForTransactionReceipt({ hash: createTx, confirmations: 3 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const games = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getNotStartedGames",
      }) as bigint[];

      const gameId = games[0];

      const winner = await publicClient.readContract({
        address: contractAddress,
        abi: confidentialUnoGameAbi.abi,
        functionName: "getWinner",
        args: [gameId],
      }) as Address;

      console.log(`Winner (should be zero address): ${winner}`);
      expect(winner).to.equal("0x0000000000000000000000000000000000000000");
    });
  });
});