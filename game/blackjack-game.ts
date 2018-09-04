import { Chat } from "../../../src/chat/chat";
import { User } from "../../../src/chat/user/user";
import { Card } from "../card/card";
import { Deck } from "../deck/deck";
import { Player } from "../player/player";
import { IBlackjackGameListener } from "./blackjack-game-listener";
import { GameState } from "./game-state";

/**
 * An on-going game of Blackjack.
 */
export class BlackjackGame {

    private static readonly MAX_PLAYERS = 3;
    private static readonly BET_MULTIPLIER_ON_WIN = 2;

    private static readonly TIME_WAIT_FOR_PLAYERS_MS = 15000;
    private static readonly TIME_PLAYER_TURN_MS = 15000;
    private static readonly TIME_BETWEEN_ACTIONS = 3000;

    public readonly dealer = new Player();

    private readonly myPlayers = new Array<Player>();
    private readonly listeners = new Array<IBlackjackGameListener>();

    private gameState = GameState.INITIALIZING;
    private playerTurnIndex = -1;
    private playerTurnTimeoutId: number;

    /**
     * Initializes a new game.
     * @param deck The initial deck to start with.
     * @param chat The chat the game is taking place in.
     * @param user The user that started the game.
     * @param bet The user's bet.
     * @throws See #joinGame.
     */
    constructor(private readonly deck: Deck, public readonly chat: Chat, user: User, bet: number) {
        this.joinGame(user, bet);
    }

    /**
     * Subscribes to this blackjack game to receive asynchronous updates.
     * @param subscriber The component subscribing to this game.
     */
    public subscribe(subscriber: IBlackjackGameListener) {
        if (this.listeners.indexOf(subscriber) === -1) {
            this.listeners.push(subscriber);
        }
    }

    /**
     * Gets this game's players.
     */
    public get players(): Player[] {
        return this.myPlayers.slice(0, this.myPlayers.length);
    }

    /**
     * Initializes this game, starting a timer during which players can join
     * the game. After the timer, the game starts.
     */
    public initializeGame(): void {
        if (this.gameState !== GameState.INITIALIZING) {
            throw new Error("Game has already been initialized - this is a programming error!");
        }
        this.gameState = GameState.AWAITING_PLAYERS;
        setTimeout(this.dealCards.bind(this), BlackjackGame.TIME_WAIT_FOR_PLAYERS_MS);
    }

    /**
     * Joins this game of blackjack.
     * @param user The user that is joining.
     * @param bet The user's bet.
     * @throws An error if the maximum number of players has already been reached,
     * if the player is already partaking, if the player does not have enough
     * points to pay their bet, if the bet is incorrect, or if joining is no longer possible.
     */
    public joinGame(user: User, bet: number): void {
        if (this.gameState !== GameState.INITIALIZING && this.gameState !== GameState.AWAITING_PLAYERS) {
            throw new Error("The game has already started!");
        }
        if (this.myPlayers.length >= BlackjackGame.MAX_PLAYERS) {
            throw new Error(`Only up to ${BlackjackGame.MAX_PLAYERS} players can join a game at a time!`);
        }
        if (this.myPlayers.findIndex((entry) => entry.user.id === user.id) !== -1) {
            throw new Error("You're already partaking in this game!");
        }
        if (user.score < bet) {
            throw new Error("You don't have enough points to make that bet!");
        }
        if (bet < 1 || bet % 1 !== 0) {
            throw new Error("Your bet must be a whole, positive number!");
        }
        user.addToScore(-bet);
        const player = new Player(user, bet);
        this.myPlayers.push(player);
    }

    /**
     * If it is the user's turn, instructs the dealer they desire to stand.
     * @param userId The id of the user desiring to stand.
     * @return The player that is next, or null if the dealer is up next.
     * @throws Error if it is not the user's turn.
     */
    public stand(userId: number): Player | null {
        if (this.gameState !== GameState.PLAYER_TURNS) { throw new Error("It is not your turn!"); }
        const currentPlayer = this.currentPlayer;
        if (currentPlayer === null || currentPlayer.user.id !== userId) { throw new Error("It is not your turn!"); }
        clearTimeout(this.playerTurnTimeoutId);
        return this.startNextPlayerTurn();
    }

    /**
     * Instructs the dealer the user desires to hit.
     * @param userId The id of the user desiring to hit.
     * @return Information about the hit results, including the drawn card,
     * whether the player is busted, which player had the card drawn, and
     * which player is up next (which is the current player if they weren't busted,
     * or null if the dealer is up next.)
     * @throws Error if it is not the user's turn.
     */
    public hit(userId: number): { card: Card, currentPlayer: Player, nextPlayer: Player | null } {
        if (this.gameState !== GameState.PLAYER_TURNS) { throw new Error("It is not your turn!"); }
        const theCurrentPlayer = this.currentPlayer;
        if (theCurrentPlayer === null || theCurrentPlayer.user.id !== userId) {
            throw new Error("It is not your turn!");
        }
        clearTimeout(this.playerTurnTimeoutId);

        const drawnCard = this.deck.drawCard();
        theCurrentPlayer.giveCards(drawnCard);
        let theNextPlayer: Player | null = null;

        if (theCurrentPlayer.isBusted) {
            theNextPlayer = this.startNextPlayerTurn();
        } else {
            this.schedulePlayerTurnTimeout();
            theNextPlayer = theCurrentPlayer;
        }
        return { card: drawnCard, currentPlayer: theCurrentPlayer, nextPlayer: theNextPlayer };
    }

    private dealCards(): void {
        this.gameState = GameState.DEALING_CARDS;
        this.deck.shuffle();
        this.dealer.giveCards(this.deck.drawCard());
        this.myPlayers.forEach((player) => player.giveCards(this.deck.drawCard(), this.deck.drawCard()));
        this.gameState = GameState.PLAYER_TURNS;
        const currentPlayer = this.startNextPlayerTurn();
        this.listeners.forEach((listener) => listener.onCardsDealt(this, currentPlayer));
    }

    private schedulePlayerTurnTimeout(): void {
        this.playerTurnTimeoutId = setTimeout(this.onPlayerTurnTimeout.bind(this), BlackjackGame.TIME_PLAYER_TURN_MS);
    }

    private onPlayerTurnTimeout(): void {
        const timedOutPlayer = this.currentPlayer;
        const nextPlayer = this.startNextPlayerTurn();
        this.listeners.forEach((listener) => listener.onPlayerTurnTimedOut(this, timedOutPlayer, nextPlayer));
    }

    private startNextPlayerTurn(): Player | null {
        this.playerTurnIndex++;
        const currentPlayer = this.currentPlayer;

        if (currentPlayer === null) {
            this.scheduleDealerTurn();
        } else {
            this.schedulePlayerTurnTimeout();
        }
        return currentPlayer;
    }

    private scheduleDealerTurn(): void {
        setTimeout(this.executeDealerTurn.bind(this), BlackjackGame.TIME_BETWEEN_ACTIONS);
    }

    private async executeDealerTurn(): Promise<void> {
        this.gameState = GameState.DEALER_TURN;
        const nonBustedPlayers = this.getNonBustedPlayers();

        if (nonBustedPlayers.length === 0) {
            this.listeners.forEach((listener) => listener.onGameEnded(this, [], false));
            this.gameState = GameState.ENDED;
            return;
        }

        while (!this.dealer.isBusted && !this.dealer.hasReachedDealerMinimum) {
            const newCard = this.deck.drawCard();
            this.dealer.giveCards(newCard);
            this.listeners.forEach((listener) => listener.onDealerDrewCard(this, newCard));
            await this.asyncSleep(BlackjackGame.TIME_BETWEEN_ACTIONS);
        }

        let winners: Player[];
        if (this.dealer.isBusted) {
            winners = nonBustedPlayers;
        } else {
            winners = this.getPlayersWithWinningHands(nonBustedPlayers);
        }

        this.gameState = GameState.ENDED;
        this.rewardWinners(winners);
        this.listeners.forEach((listener) => listener.onGameEnded(this, winners, this.dealer.isBusted));
    }

    private getNonBustedPlayers(): Player[] {
        return this.myPlayers.filter((player) => !player.isBusted);
    }

    private getPlayersWithWinningHands(unbustedPlayers: Player[]): Player[] {
        const winners = unbustedPlayers
            .filter((player) => player.highestNonBustedHandValue > this.dealer.highestNonBustedHandValue);
        return winners;
    }

    private rewardWinners(winners: Player[]): void {
        winners.forEach((winner) => {
            winner.user.addToScore(winner.bet * BlackjackGame.BET_MULTIPLIER_ON_WIN);
        });
    }

    private get currentPlayer(): Player | null {
        if (this.playerTurnIndex >= this.myPlayers.length) {
            return null;
        }
        return this.myPlayers[this.playerTurnIndex];
    }

    private asyncSleep(milliseconds: number): Promise<void> {
        const promise = new Promise<void>((resolve) => {
            setTimeout(() => resolve(), milliseconds);
        });
        return promise;
    }
}
