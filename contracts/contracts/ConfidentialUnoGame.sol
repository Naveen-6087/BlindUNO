// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Inco Lightning SDK for confidential computing
import {euint256, ebool, e, inco} from "@inco/lightning/src/Lib.sol";

// Import EList preview features for encrypted lists
import {ePreview, elist, ETypes} from "@inco/lightning-preview/src/Preview.Lib.sol";

/**
 * @title ConfidentialUnoGame
 * @notice A confidential UNO game contract - MULTIPLAYER ONLY (no bot)
 * @dev Implements full UNO game logic with encrypted cards and ON-CHAIN VALIDATION
 *
 * Card Encoding (0-107):
 * - Cards 0-75: Number cards (4 colors × 19 cards each)
 *   - Color = cardId / 19 (0=Red, 1=Yellow, 2=Green, 3=Blue)
 *   - Value = cardId % 19 (0 once, 1-9 twice per color)
 * - Cards 76-83: Skip cards (2 per color)
 * - Cards 84-91: Reverse cards (2 per color)  
 * - Cards 92-99: Draw Two cards (2 per color)
 * - Cards 100-103: Wild cards (4 total)
 * - Cards 104-107: Wild Draw Four cards (4 total)
 */
contract ConfidentialUnoGame {
    using e for *;

    uint256 private _gameIdCounter;
    uint256[] private _activeGames;
    uint256[] private _notStartedGames;

    uint16 public constant DECK_SIZE = 108;
    uint16 public constant INITIAL_HAND_SIZE = 7;
    uint256 public constant MAX_PLAYERS = 10;

    // Card type boundaries
    uint16 public constant NUMBER_CARDS_END = 76;
    uint16 public constant SKIP_START = 76;
    uint16 public constant SKIP_END = 84;
    uint16 public constant REVERSE_START = 84;
    uint16 public constant REVERSE_END = 92;
    uint16 public constant DRAW_TWO_START = 92;
    uint16 public constant DRAW_TWO_END = 100;
    uint16 public constant WILD_START = 100;
    uint16 public constant WILD_END = 104;
    uint16 public constant WILD_DRAW_FOUR_START = 104;
    uint16 public constant WILD_DRAW_FOUR_END = 108;

    // Card types for events
    uint8 public constant CARD_TYPE_NUMBER = 0;
    uint8 public constant CARD_TYPE_SKIP = 1;
    uint8 public constant CARD_TYPE_REVERSE = 2;
    uint8 public constant CARD_TYPE_DRAW_TWO = 3;
    uint8 public constant CARD_TYPE_WILD = 4;
    uint8 public constant CARD_TYPE_WILD_DRAW_FOUR = 5;

    enum GameStatus { NotStarted, Started, Ended }

    struct Game {
        uint256 id;
        address[] players;
        GameStatus status;
        uint256 startTime;
        uint256 endTime;
        euint256 gameHash;
        elist deck;
        elist moves;
        euint256 topCard;
        uint16 topCardId;
        uint16 deckIndex;
        uint256 currentPlayerIndex;
        int8 direction;
        uint8 currentColor;
        address winner;
        uint8 pendingDraws;
        bool skipNextPlayer;
    }

    mapping(uint256 => Game) private games;
    mapping(uint256 => mapping(address => elist)) private playerHands;
    
    // UNO call tracking
    mapping(uint256 => mapping(address => bool)) private hasCalledUno;
    mapping(uint256 => mapping(address => bool)) private unoPenaltyApplied;
    
    // UNO challenge window tracking
    // When a player plays down to 1 card, a challenge window opens
    // The window closes when: 1) another player successfully plays, 2) the player starts their next turn
    mapping(uint256 => bool) private unoWindowOpen;
    mapping(uint256 => address) private unoWindowPlayer;

    event GameCreated(uint256 indexed gameId, address creator, uint16 initialTopCardId);
    event PlayerJoined(uint256 indexed gameId, address player);
    event GameStarted(uint256 indexed gameId);
    event MoveCommitted(
        uint256 indexed gameId, 
        address indexed player, 
        uint16 cardId,
        uint8 cardType,
        uint8 chosenColor,
        uint8 pendingDraws,
        bool skipNext
    );
    event CardDrawn(uint256 indexed gameId, address indexed player, uint16 cardsDrawn);
    event CardsForceDrawn(uint256 indexed gameId, address indexed player, uint8 cardsDrawn);
    event GameEnded(uint256 indexed gameId, address winner);
    event TurnChanged(uint256 indexed gameId, address indexed newPlayer, uint8 pendingDraws);
    event DirectionChanged(uint256 indexed gameId, int8 newDirection);
    event PlayerSkipped(uint256 indexed gameId, address indexed skippedPlayer);
    event UnoCalled(uint256 indexed gameId, address indexed player);
    event UnoPenalty(uint256 indexed gameId, address indexed player, uint8 cardsPenalty);
    event UnoWindowOpened(uint256 indexed gameId, address indexed player);
    event UnoWindowClosed(uint256 indexed gameId, address indexed player);
    event DeckReshuffled(uint256 indexed gameId, uint16 cardsReshuffled);

    modifier validateGame(uint256 _gameId, GameStatus requiredStatus) {
        require(_gameId > 0 && _gameId <= _gameIdCounter, "Invalid game ID");
        Game storage game = games[_gameId];
        require(game.status == requiredStatus, "Game is not in the required status");
        _;
    }

    modifier onlyPlayer(uint256 _gameId) {
        Game storage game = games[_gameId];
        bool isPlayer = false;
        for (uint256 i = 0; i < game.players.length; i++) {
            if (game.players[i] == msg.sender) {
                isPlayer = true;
                break;
            }
        }
        require(isPlayer, "Not a player in this game");
        _;
    }

    /**
     * @notice Create a new multiplayer game
     * @param _creator Creator address
     * @param initialTopCardId The ID of the initial top card
     */
    function createGame(
        address _creator,
        uint16 initialTopCardId
    ) external payable returns (uint256) {
        uint256 requiredFee = inco.getFee() * 2;
        require(msg.value >= requiredFee, "Insufficient fee");
        require(initialTopCardId < DECK_SIZE, "Invalid initial card ID");

        _gameIdCounter++;
        uint256 newGameId = _gameIdCounter;

        // Create shuffled deck
        elist shuffledDeck = ePreview.shuffledRange(0, DECK_SIZE);
        inco.allow(elist.unwrap(shuffledDeck), address(this));

        // Initialize empty moves list
        elist emptyMoves = ePreview.newEList(ETypes.Uint256);
        inco.allow(elist.unwrap(emptyMoves), address(this));

        // Initialize game
        Game storage game = games[newGameId];
        game.id = newGameId;
        
        address[] memory initialPlayers = new address[](1);
        initialPlayers[0] = _creator;
        game.players = initialPlayers;
        
        game.status = GameStatus.NotStarted;
        game.startTime = block.timestamp;
        game.currentPlayerIndex = 0;
        game.deck = shuffledDeck;
        game.moves = emptyMoves;
        game.deckIndex = 0;
        game.direction = 1;
        game.pendingDraws = 0;
        game.skipNextPlayer = false;

        // Deal initial hand to creator
        uint16 deckPos = _dealHandToPlayer(newGameId, _creator, shuffledDeck, 0);
        game.deckIndex = deckPos;

        // Set initial top card
        euint256 topCard = ePreview.getEuint256(shuffledDeck, deckPos);
        game.deckIndex = deckPos + 1;
        game.topCard = topCard;
        game.topCardId = initialTopCardId;
        
        // Set initial color
        if (initialTopCardId >= WILD_START) {
            game.currentColor = 0; // Default to red for wild
        } else {
            game.currentColor = _getCardColor(initialTopCardId);
        }

        inco.allow(euint256.unwrap(topCard), address(this));
        inco.allow(euint256.unwrap(topCard), _creator);

        _notStartedGames.push(newGameId);
        emit GameCreated(newGameId, _creator, initialTopCardId);

        return newGameId;
    }

    /**
     * @notice Join an existing game
     */
    function joinGame(
        uint256 gameId, 
        address _joinee
    ) external payable validateGame(gameId, GameStatus.NotStarted) {
        Game storage game = games[gameId];
        require(game.players.length < MAX_PLAYERS, "Game is full");
        require(msg.value >= inco.getFee(), "Insufficient fee");

        // Check not already in game
        for (uint256 i = 0; i < game.players.length; i++) {
            require(game.players[i] != _joinee, "Already in game");
        }

        require(game.deckIndex + INITIAL_HAND_SIZE < DECK_SIZE, "Not enough cards");

        game.players.push(_joinee);

        // Deal hand
        uint16 deckPos = _dealHandToPlayer(gameId, _joinee, game.deck, game.deckIndex);
        game.deckIndex = deckPos;

        // Allow joinee to see top card
        inco.allow(euint256.unwrap(game.topCard), _joinee);

        emit PlayerJoined(gameId, _joinee);
    }

    /**
     * @notice Start the game (requires 2+ players)
     */
    function startGame(uint256 gameId) external payable validateGame(gameId, GameStatus.NotStarted) {
        Game storage game = games[gameId];
        require(game.players.length >= 2, "Need at least 2 players");

        // Allow all players to see top card
        for (uint256 i = 0; i < game.players.length; i++) {
            inco.allow(euint256.unwrap(game.topCard), game.players[i]);
        }

        game.status = GameStatus.Started;
        
        // Move from notStarted to active
        _removeFromNotStartedGames(gameId);
        _activeGames.push(gameId);
        
        emit GameStarted(gameId);
    }

    /**
     * @dev Deal hand to a single player
     */
    function _dealHandToPlayer(
        uint256 gameId,
        address player,
        elist deck,
        uint16 startPos
    ) internal returns (uint16 nextPos) {
        elist hand = ePreview.slice(deck, startPos, startPos + INITIAL_HAND_SIZE);
        inco.allow(elist.unwrap(hand), address(this));
        inco.allow(elist.unwrap(hand), player);

        for (uint16 j = 0; j < INITIAL_HAND_SIZE; j++) {
            euint256 card = ePreview.getEuint256(hand, j);
            inco.allow(euint256.unwrap(card), player);
            inco.allow(euint256.unwrap(card), address(this));
        }

        playerHands[gameId][player] = hand;
        return startPos + INITIAL_HAND_SIZE;
    }

    /**
     * @notice Play a card - WITH ON-CHAIN VALIDATION
     */
    function commitMove(
        uint256 gameId,
        uint16 cardIndex,
        uint16 revealedCardId,
        uint8 chosenColor
    ) external payable validateGame(gameId, GameStatus.Started) onlyPlayer(gameId) {
        require(msg.value >= inco.getFee() * 2, "Fee required");

        Game storage game = games[gameId];
        require(game.players[game.currentPlayerIndex] == msg.sender, "Not your turn");
        require(chosenColor <= 3, "Invalid color");
        require(revealedCardId < DECK_SIZE, "Invalid card ID");

        // Close UNO challenge window if it was open for a DIFFERENT player
        // (another player successfully played, window closes)
        if (unoWindowOpen[gameId] && unoWindowPlayer[gameId] != msg.sender) {
            unoWindowOpen[gameId] = false;
            emit UnoWindowClosed(gameId, unoWindowPlayer[gameId]);
        }
        
        // Close window if the player who opened it is now playing (their next turn started)
        if (unoWindowOpen[gameId] && unoWindowPlayer[gameId] == msg.sender) {
            unoWindowOpen[gameId] = false;
            emit UnoWindowClosed(gameId, msg.sender);
        }

        elist currentHand = playerHands[gameId][msg.sender];
        uint16 handSize = ePreview.length(currentHand);

        require(cardIndex < handSize, "Card index out of bounds");
        require(
            _isCardPlayableInternal(revealedCardId, game.topCardId, game.currentColor),
            "Card not playable"
        );

        uint8 cardType = _getCardType(revealedCardId);

        // Get the card being played
        euint256 playedCard = ePreview.getEuint256(currentHand, cardIndex);
        inco.allow(euint256.unwrap(playedCard), address(this));

        // Remove card from hand - FIXED for last card case
        elist newHand;
        if (handSize == 1) {
            // Last card - create empty list
            newHand = ePreview.newEList(ETypes.Uint256);
        } else {
            newHand = _removeCardFromHand(currentHand, cardIndex, handSize);
        }
        
        inco.allow(elist.unwrap(newHand), address(this));
        inco.allow(elist.unwrap(newHand), msg.sender);

        uint16 newHandSize = ePreview.length(newHand);
        if (newHandSize > 0) {
            _grantHandACL(newHand, newHandSize, msg.sender);
        }
        playerHands[gameId][msg.sender] = newHand;

        // Open UNO challenge window if player just went from 2 to 1 card
        // They should have called UNO before playing - if they didn't, they can be challenged
        if (handSize == 2 && newHandSize == 1) {
            // Only open window if they DIDN'T call UNO
            if (!hasCalledUno[gameId][msg.sender]) {
                unoWindowOpen[gameId] = true;
                unoWindowPlayer[gameId] = msg.sender;
                emit UnoWindowOpened(gameId, msg.sender);
            }
        }

        // Reset UNO call status after playing (for next time)
        hasCalledUno[gameId][msg.sender] = false;
        // Reset penalty applied flag since they're in a new state now
        unoPenaltyApplied[gameId][msg.sender] = false;

        // Update top card
        game.topCard = playedCard;
        game.topCardId = revealedCardId;

        // Update current color
        if (cardType == CARD_TYPE_WILD || cardType == CARD_TYPE_WILD_DRAW_FOUR) {
            game.currentColor = chosenColor;
        } else {
            game.currentColor = _getCardColor(revealedCardId);
        }

        // Allow all players to see the new top card
        for (uint256 i = 0; i < game.players.length; i++) {
            inco.allow(euint256.unwrap(playedCard), game.players[i]);
        }

        // Append to moves history
        elist newMoves = ePreview.append(game.moves, playedCard);
        inco.allow(elist.unwrap(newMoves), address(this));
        game.moves = newMoves;

        // Apply special card effects
        _applyCardEffect(gameId, cardType);

        // Check win condition
        if (newHandSize == 0) {
            game.status = GameStatus.Ended;
            game.endTime = block.timestamp;
            game.winner = msg.sender;
            _removeFromActiveGames(gameId);
            emit GameEnded(gameId, msg.sender);
            return;
        }

        emit MoveCommitted(
            gameId, 
            msg.sender, 
            revealedCardId,
            cardType,
            game.currentColor, 
            game.pendingDraws, 
            game.skipNextPlayer
        );

        // Advance to next player
        _advanceToNextPlayer(gameId);
    }

    /**
     * @notice Call UNO when you have 2 cards (before playing down to 1)
     */
    function callUno(uint256 gameId) external validateGame(gameId, GameStatus.Started) onlyPlayer(gameId) {
        uint16 handSize = ePreview.length(playerHands[gameId][msg.sender]);
        require(handSize == 2, "Must have exactly 2 cards to call UNO");
        
        hasCalledUno[gameId][msg.sender] = true;
        emit UnoCalled(gameId, msg.sender);
    }

    /**
     * @notice Penalize a player who didn't call UNO
     * @dev Can only be called during the challenge window (after player plays to 1 card, before next play/turn)
     */
    function penalizeUno(
        uint256 gameId, 
        address target
    ) external payable validateGame(gameId, GameStatus.Started) onlyPlayer(gameId) {
        require(msg.sender != target, "Cannot penalize yourself");
        require(msg.value >= inco.getFee() * 2, "Fee required for penalty");
        
        // Must be during the challenge window
        require(unoWindowOpen[gameId], "Challenge window not open");
        require(unoWindowPlayer[gameId] == target, "Target not in challenge window");
        require(!unoPenaltyApplied[gameId][target], "Penalty already applied");
        
        // Close the window and apply penalty
        unoWindowOpen[gameId] = false;
        unoPenaltyApplied[gameId][target] = true;
        
        // Apply penalty - draw 2 cards
        _forceDrawCards(gameId, target, 2);
        
        emit UnoWindowClosed(gameId, target);
        emit UnoPenalty(gameId, target, 2);
    }

    /**
     * @dev Remove card from hand (handles edge cases)
     */
    function _removeCardFromHand(
        elist currentHand,
        uint16 cardIndex,
        uint16 handSize
    ) internal returns (elist newHand) {
        if (cardIndex == 0) {
            // Remove first card
            newHand = ePreview.slice(currentHand, 1, handSize);
        } else if (cardIndex == handSize - 1) {
            // Remove last card
            newHand = ePreview.slice(currentHand, 0, cardIndex);
        } else {
            // Remove middle card
            elist leftPart = ePreview.slice(currentHand, 0, cardIndex);
            elist rightPart = ePreview.slice(currentHand, cardIndex + 1, handSize);
            newHand = ePreview.concat(leftPart, rightPart);
            inco.allow(elist.unwrap(leftPart), address(this));
            inco.allow(elist.unwrap(rightPart), address(this));
        }
        return newHand;
    }

    /**
     * @dev Grant ACL for all cards in a hand
     */
    function _grantHandACL(elist hand, uint16 handSize, address player) internal {
        for (uint16 i = 0; i < handSize; i++) {
            euint256 card = ePreview.getEuint256(hand, i);
            inco.allow(euint256.unwrap(card), player);
            inco.allow(euint256.unwrap(card), address(this));
        }
    }

    /**
     * @dev Card validation
     */
    function _isCardPlayableInternal(
        uint16 cardId,
        uint16 topCardId,
        uint8 currentColor
    ) internal pure returns (bool) {
        if (cardId >= WILD_START) {
            return true;
        }

        uint8 cardColor = _getCardColor(cardId);
        if (cardColor == currentColor) {
            return true;
        }

        uint8 cardType = _getCardType(cardId);
        uint8 topType = _getCardType(topCardId);

        if (cardType == topType && cardType != CARD_TYPE_NUMBER) {
            return true;
        }

        if (cardType == CARD_TYPE_NUMBER && topType == CARD_TYPE_NUMBER) {
            return _getCardValue(cardId) == _getCardValue(topCardId);
        }

        return false;
    }

    /**
     * @dev Apply special card effects
     */
    function _applyCardEffect(uint256 gameId, uint8 cardType) internal {
        Game storage game = games[gameId];

        if (cardType == CARD_TYPE_SKIP) {
            game.skipNextPlayer = true;
        } else if (cardType == CARD_TYPE_REVERSE) {
            game.direction = -game.direction;
            emit DirectionChanged(gameId, game.direction);
            if (game.players.length == 2) {
                game.skipNextPlayer = true;
            }
        } else if (cardType == CARD_TYPE_DRAW_TWO) {
            game.pendingDraws = 2;
            game.skipNextPlayer = true;
        } else if (cardType == CARD_TYPE_WILD_DRAW_FOUR) {
            game.pendingDraws = 4;
            game.skipNextPlayer = true;
        }
    }

    /**
     * @dev Advance to next player
     */
    function _advanceToNextPlayer(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint256 numPlayers = game.players.length;

        // Move to next player
        if (game.direction == 1) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % numPlayers;
        } else {
            if (game.currentPlayerIndex == 0) {
                game.currentPlayerIndex = numPlayers - 1;
            } else {
                game.currentPlayerIndex = game.currentPlayerIndex - 1;
            }
        }

        // Handle skip and pending draws
        if (game.skipNextPlayer) {
            address skippedPlayer = game.players[game.currentPlayerIndex];
            emit PlayerSkipped(gameId, skippedPlayer);
            game.skipNextPlayer = false;

            if (game.pendingDraws > 0) {
                _forceDrawCards(gameId, skippedPlayer, game.pendingDraws);
                game.pendingDraws = 0;
            }

            // Move to next player again
            if (game.direction == 1) {
                game.currentPlayerIndex = (game.currentPlayerIndex + 1) % numPlayers;
            } else {
                if (game.currentPlayerIndex == 0) {
                    game.currentPlayerIndex = numPlayers - 1;
                } else {
                    game.currentPlayerIndex = game.currentPlayerIndex - 1;
                }
            }
        }

        emit TurnChanged(gameId, game.players[game.currentPlayerIndex], game.pendingDraws);
    }

    /**
     * @dev Reshuffle discard pile into deck when deck is exhausted
     * @notice Follows real UNO rules: keep top card, shuffle rest of discards into new deck
     */
    function _reshuffleFromDiscards(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        uint16 movesCount = ePreview.length(game.moves);
        
        // Need at least 2 cards in discard pile (top card + 1 to reshuffle)
        require(movesCount >= 2, "No cards left to reshuffle");
        
        // Get all cards except the last one (current top card stays on table)
        // moves[0..movesCount-2] become the new deck, moves[movesCount-1] is current top card
        elist cardsToShuffle = ePreview.slice(game.moves, 0, movesCount - 1);
        inco.allow(elist.unwrap(cardsToShuffle), address(this));
        
        // Shuffle the cards to create new deck
        elist newDeck = ePreview.shuffle(cardsToShuffle);
        inco.allow(elist.unwrap(newDeck), address(this));
        
        // Allow all players to access the new deck (they need ACL for drawing)
        for (uint256 i = 0; i < game.players.length; i++) {
            inco.allow(elist.unwrap(newDeck), game.players[i]);
        }
        
        // Create new moves list containing only the current top card
        elist newMoves = ePreview.newEList(ETypes.Uint256);
        inco.allow(elist.unwrap(newMoves), address(this));
        newMoves = ePreview.append(newMoves, game.topCard);
        inco.allow(elist.unwrap(newMoves), address(this));
        
        // Update game state
        game.deck = newDeck;
        game.deckIndex = 0;
        game.moves = newMoves;
        
        emit DeckReshuffled(gameId, movesCount - 1);
    }

    /**
     * @dev Force draw cards
     */
    function _forceDrawCards(uint256 gameId, address player, uint8 numCards) internal {
        Game storage game = games[gameId];

        for (uint8 i = 0; i < numCards; i++) {
            // Check if deck is exhausted and reshuffle if needed
            if (game.deckIndex >= ePreview.length(game.deck)) {
                _reshuffleFromDiscards(gameId);
            }
            euint256 drawnCard = ePreview.getEuint256(game.deck, game.deckIndex);
            game.deckIndex++;

            inco.allow(euint256.unwrap(drawnCard), address(this));
            inco.allow(euint256.unwrap(drawnCard), player);

            elist currentHand = playerHands[gameId][player];
            elist newHand = ePreview.append(currentHand, drawnCard);

            inco.allow(elist.unwrap(newHand), address(this));
            inco.allow(elist.unwrap(newHand), player);

            uint16 newHandSize = ePreview.length(newHand);
            for (uint16 j = 0; j < newHandSize; j++) {
                euint256 card = ePreview.getEuint256(newHand, j);
                inco.allow(euint256.unwrap(card), player);
                inco.allow(euint256.unwrap(card), address(this));
            }

            playerHands[gameId][player] = newHand;
        }

        // Reset uno penalty eligibility since they drew cards
        hasCalledUno[gameId][player] = false;
        unoPenaltyApplied[gameId][player] = false;

        emit CardsForceDrawn(gameId, player, numCards);
    }

    /**
     * @notice Draw a card
     */
    function drawCard(
        uint256 gameId, 
        bool endTurn
    ) external payable validateGame(gameId, GameStatus.Started) onlyPlayer(gameId) {
        require(msg.value >= inco.getFee(), "Fee required");

        Game storage game = games[gameId];
        require(game.players[game.currentPlayerIndex] == msg.sender, "Not your turn");
        
        // Check if deck is exhausted and reshuffle if needed
        if (game.deckIndex >= ePreview.length(game.deck)) {
            _reshuffleFromDiscards(gameId);
        }

        // Close UNO challenge window if the player who opened it is drawing (their turn)
        if (unoWindowOpen[gameId] && unoWindowPlayer[gameId] == msg.sender) {
            unoWindowOpen[gameId] = false;
            emit UnoWindowClosed(gameId, msg.sender);
        }
        // Also close if another player is taking an action (they successfully drew instead of played)
        if (unoWindowOpen[gameId] && unoWindowPlayer[gameId] != msg.sender) {
            unoWindowOpen[gameId] = false;
            emit UnoWindowClosed(gameId, unoWindowPlayer[gameId]);
        }

        euint256 drawnCard = ePreview.getEuint256(game.deck, game.deckIndex);
        game.deckIndex++;

        inco.allow(euint256.unwrap(drawnCard), address(this));
        inco.allow(euint256.unwrap(drawnCard), msg.sender);

        elist currentHand = playerHands[gameId][msg.sender];
        elist newHand = ePreview.append(currentHand, drawnCard);

        inco.allow(elist.unwrap(newHand), address(this));
        inco.allow(elist.unwrap(newHand), msg.sender);

        uint16 newHandSize = ePreview.length(newHand);
        for (uint16 i = 0; i < newHandSize; i++) {
            euint256 card = ePreview.getEuint256(newHand, i);
            inco.allow(euint256.unwrap(card), msg.sender);
            inco.allow(euint256.unwrap(card), address(this));
        }

        playerHands[gameId][msg.sender] = newHand;

        emit CardDrawn(gameId, msg.sender, 1);

        if (endTurn) {
            _advanceToNextPlayer(gameId);
        }
    }

    // ============ Card Helper Functions ============

    function _getCardColor(uint16 cardId) internal pure returns (uint8) {
        if (cardId >= WILD_START) return 4;
        if (cardId < NUMBER_CARDS_END) {
            return uint8(cardId / 19);
        }
        if (cardId < SKIP_END) return uint8((cardId - SKIP_START) / 2);
        if (cardId < REVERSE_END) return uint8((cardId - REVERSE_START) / 2);
        if (cardId < DRAW_TWO_END) return uint8((cardId - DRAW_TWO_START) / 2);
        return 4;
    }

    function _getCardType(uint16 cardId) internal pure returns (uint8) {
        if (cardId < NUMBER_CARDS_END) return CARD_TYPE_NUMBER;
        if (cardId < SKIP_END) return CARD_TYPE_SKIP;
        if (cardId < REVERSE_END) return CARD_TYPE_REVERSE;
        if (cardId < DRAW_TWO_END) return CARD_TYPE_DRAW_TWO;
        if (cardId < WILD_END) return CARD_TYPE_WILD;
        return CARD_TYPE_WILD_DRAW_FOUR;
    }

    function _getCardValue(uint16 cardId) internal pure returns (uint16) {
        if (cardId >= NUMBER_CARDS_END) return 0;
        uint16 posInColor = cardId % 19;
        if (posInColor == 0) return 0;
        if (posInColor <= 9) return posInColor;
        return posInColor - 9;
    }

    // ============ List Management ============

    function _removeFromActiveGames(uint256 gameId) internal {
        for (uint256 i = 0; i < _activeGames.length; i++) {
            if (_activeGames[i] == gameId) {
                _activeGames[i] = _activeGames[_activeGames.length - 1];
                _activeGames.pop();
                break;
            }
        }
    }

    function _removeFromNotStartedGames(uint256 gameId) internal {
        for (uint256 i = 0; i < _notStartedGames.length; i++) {
            if (_notStartedGames[i] == gameId) {
                _notStartedGames[i] = _notStartedGames[_notStartedGames.length - 1];
                _notStartedGames.pop();
                break;
            }
        }
    }

    // ============ View Functions ============

    function getActiveGames() external view returns (uint256[] memory) {
        return _activeGames;
    }

    function getNotStartedGames() external view returns (uint256[] memory) {
        return _notStartedGames;
    }

    function getGame(uint256 gameId) external view returns (
        uint256 id,
        address[] memory players,
        GameStatus status,
        uint256 startTime,
        uint256 endTime,
        euint256 gameHash,
        uint16 moveCount,
        euint256 topCard,
        uint16 topCardId,
        uint16 deckRemaining,
        uint256 currentPlayerIndex,
        int8 direction,
        uint8 currentColor,
        address winner,
        uint8 pendingDraws
    ) {
        Game storage game = games[gameId];
        return (
            game.id,
            game.players,
            game.status,
            game.startTime,
            game.endTime,
            game.gameHash,
            ePreview.length(game.moves),
            game.topCard,
            game.topCardId,
            DECK_SIZE - game.deckIndex,
            game.currentPlayerIndex,
            game.direction,
            game.currentColor,
            game.winner,
            game.pendingDraws
        );
    }

    function getCurrentColor(uint256 gameId) external view returns (uint8) {
        return games[gameId].currentColor;
    }

    function getTopCardId(uint256 gameId) external view returns (uint16) {
        return games[gameId].topCardId;
    }

    function getWinner(uint256 gameId) external view returns (address) {
        return games[gameId].winner;
    }

    function getPendingDraws(uint256 gameId) external view returns (uint8) {
        return games[gameId].pendingDraws;
    }

    function getPlayerHandSize(uint256 gameId, address player) external view returns (uint16) {
        return ePreview.length(playerHands[gameId][player]);
    }

    /**
     * @notice Get all players' hand sizes (for UI display)
     */
    function getAllPlayerHandSizes(uint256 gameId) external view returns (address[] memory, uint16[] memory) {
        Game storage game = games[gameId];
        uint256 numPlayers = game.players.length;
        
        address[] memory players = new address[](numPlayers);
        uint16[] memory sizes = new uint16[](numPlayers);
        
        for (uint256 i = 0; i < numPlayers; i++) {
            players[i] = game.players[i];
            sizes[i] = ePreview.length(playerHands[gameId][game.players[i]]);
        }
        
        return (players, sizes);
    }

    function hasPlayerCalledUno(uint256 gameId, address player) external view returns (bool) {
        return hasCalledUno[gameId][player];
    }

    function canPenalizePlayer(uint256 gameId, address target) external view returns (bool) {
        // Can only penalize during open challenge window for this specific player
        return unoWindowOpen[gameId] && 
               unoWindowPlayer[gameId] == target && 
               !unoPenaltyApplied[gameId][target];
    }

    function isUnoWindowOpen(uint256 gameId) external view returns (bool) {
        return unoWindowOpen[gameId];
    }

    function getUnoWindowPlayer(uint256 gameId) external view returns (address) {
        return unoWindowPlayer[gameId];
    }

    function getPlayerHand(uint256 gameId, address player) external view returns (elist) {
        // Returns the elist handle - actual card values are protected by Inco ACL
        // Only players with ACL on individual cards can decrypt them
        return playerHands[gameId][player];
    }

    function getCardFromHand(uint256 gameId, address player, uint16 index) external returns (euint256) {
        // ACL is granted to msg.sender - they can only decrypt if they are the player
        // with existing ACL, or they get ACL here but can only see their own cards
        elist hand = playerHands[gameId][player];
        require(index < ePreview.length(hand), "Index out of bounds");
        euint256 card = ePreview.getEuint256(hand, index);
        inco.allow(euint256.unwrap(card), msg.sender);
        inco.allow(euint256.unwrap(card), address(this));
        return card;
    }

    // getDeck removed for security - deck structure should not be exposed

    function getMoves(uint256 gameId) external view returns (elist) {
        return games[gameId].moves;
    }

    function getEncryptionFee() external pure returns (uint256) {
        return inco.getFee();
    }

    function getCreateGameFee() external pure returns (uint256) {
        return inco.getFee() * 2;
    }

    function getJoinGameFee() external pure returns (uint256) {
        return inco.getFee();
    }

    function isCardPlayable(
        uint16 cardId,
        uint16 topCardId,
        uint8 currentColor
    ) external pure returns (bool) {
        return _isCardPlayableInternal(cardId, topCardId, currentColor);
    }

    function getCardInfo(uint16 cardId) external pure returns (
        uint8 cardType,
        uint8 color,
        uint8 value
    ) {
        cardType = _getCardType(cardId);
        color = _getCardColor(cardId);
        value = uint8(_getCardValue(cardId));
    }
}
