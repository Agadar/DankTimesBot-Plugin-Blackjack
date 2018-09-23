import { Chat } from "../../../src/chat/chat";
import { User } from "../../../src/chat/user/user";
import { Card } from "../card/card";
import { DeckFactory } from "../deck/deckFactory";
import { BlackjackGame } from "../game/blackjack-game";
import { IBlackjackGameListener } from "../game/blackjack-game-listener";
import { GameConclusion } from "../game/game-conclusion";
import { HitResult } from "../game/hit-result";
import { Player } from "../player/player";

/**
 * Manages the blackjack game(s) of a single chat.
 */
export class ChatGameManager implements IBlackjackGameListener<BlackjackGame> {

    private static readonly NO_GAME_RUNNING_TEXT = "There's no game running!";

    private readonly listeners = new Array<IBlackjackGameListener<ChatGameManager>>();

    private game: BlackjackGame = null;

    /**
     * Constructor.
     * @param deckFactory The deck factory to use for generating decks.
     * @param chat The chat for which this manager manages blackjack games.
     */
    constructor(
        private readonly deckFactory: DeckFactory,
        private readonly chat: Chat) { }

    /**
     * Starts a new game, if possible.
     * @param user The user that started the game.
     * @param bet The user's bet.
     * @returns The number of seconds before the game starts.
     */
    public startNewGame(user: User, bet: number): number {
        if (this.gameIsRunning) {
            throw new Error("There's already a game ongoing!");
        }
        this.createGame(user, bet);
        return this.game.initializeGame();
    }

    /**
     * Joins the game, if possible.
     * @param user The user that is joining.
     * @param bet The user's bet.
     */
    public joinGame(user: User, bet: number): void {
        if (!this.gameIsRunning) {
            throw new Error(ChatGameManager.NO_GAME_RUNNING_TEXT);
        }
        this.game.joinGame(user, bet);
    }

    /**
     * If it is the user's turn, instructs the dealer they desire to stand.
     * @param userId The id of the user desiring to stand.
     * @return The player that is next, which can also be the dealer.
     */
    public stand(userId: number): Player {
        if (!this.gameIsRunning) {
            throw new Error(ChatGameManager.NO_GAME_RUNNING_TEXT);
        }
        return this.game.stand(userId);
    }

    /**
     * Instructs the dealer the user desires to hit.
     * @param userId The id of the user desiring to hit.
     * @return Information about the hit results.
     */
    public hit(userId: number): HitResult {
        if (!this.gameIsRunning) {
            throw new Error(ChatGameManager.NO_GAME_RUNNING_TEXT);
        }
        return this.game.hit(userId);
    }

    /**
     * The chat id for which this manager manages blackjack games.
     */
    public get chatId(): number {
        return this.chat.id;
    }

    /**
     * The players of the game that is currently being played, or an empty array if none is being played right now.
     */
    public get players(): Player[] {
        if (!this.gameIsRunning) {
            return [];
        }
        return this.game.players;
    }

    /**
     * Whether a new game can be started.
     */
    public get canStartNewGame(): boolean {
        return !this.gameIsRunning;
    }

    /**
     * Whether a game is currently running.
     */
    public get gameIsRunning(): boolean {
        return this.game !== null;
    }

    /**
     * Subscribes to this blackjack game to receive asynchronous updates.
     * @param subscriber The component subscribing to this game.
     */
    public subscribe(subscriber: IBlackjackGameListener<ChatGameManager>) {
        if (this.listeners.indexOf(subscriber) === -1) {
            this.listeners.push(subscriber);
        }
    }

    /**
     * @implements IBlackjackGameListener
     */
    public onCardsDealt(source: BlackjackGame, dealer: Player, startingPlayer: Player): void {
        this.listeners.forEach((listener) => listener.onCardsDealt(this, dealer, startingPlayer));
    }

    /**
     * @implements IBlackjackGameListener
     */
    public onPlayerTurnTimedOut(source: BlackjackGame, timedOutPlayer: Player, nextPlayer: Player) {
        this.listeners.forEach((listener) => listener.onPlayerTurnTimedOut(this, timedOutPlayer, nextPlayer));
    }

    /**
     * @implements IBlackjackGameListener
     */
    public onDealerDrewCard(source: BlackjackGame, dealer: Player, card: Card): void {
        this.listeners.forEach((listener) => listener.onDealerDrewCard(this, dealer, card));
    }

    /**
     * @implements IBlackjackGameListener
     */
    public onGameEnded(source: BlackjackGame, conclusion: GameConclusion): void {
        this.listeners.forEach((listener) => listener.onGameEnded(this, conclusion));
        this.game = null;
    }

    private createGame(user: User, bet: number): void {
        const deck = this.deckFactory.createDeck();
        this.game = new BlackjackGame(deck, this.chat, user, bet);
        this.game.subscribe(this);
    }
}
