import { Chat } from "../../../src/chat/chat";
import { User } from "../../../src/chat/user/user";

import { Card } from "../card/card";
import { DeckFactory } from "../deck/deckFactory";
import { BlackjackGame } from "../game/blackjack-game";
import { IBlackjackGameListener } from "../game/blackjack-game-listener";
import { GameConclusion } from "../game/game-conclusion";
import { HitResult } from "../game/hit-result";
import { Player } from "../player/player";
import { ChatStatistics } from "./chat-statistics";

/**
 * Manages the blackjack game(s) of a single chat.
 */
export class ChatGameManager implements IBlackjackGameListener<BlackjackGame> {

    private static readonly NO_GAME_RUNNING_TEXT = "There's no game running!";

    private static readonly BET_MULTIPLIER_ON_EVEN = 1;
    private static readonly BET_MULTIPLIER_ON_WIN = 2;
    private static readonly BET_MULTIPLIER_ON_BLACKJACK = 2.5;

    private readonly listeners = new Array<IBlackjackGameListener<ChatGameManager>>();
    private readonly statistics = new ChatStatistics();

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
        const player = this.createPlayerFromUser(user, bet);
        this.createGame(player);
        const secondsBeforeStart = this.game.initializeGame();
        player.confiscateBet();
        this.statistics.updateDealerBalance(bet);
        return secondsBeforeStart;
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
        const player = this.createPlayerFromUser(user, bet);
        this.game.joinGame(player);
        player.confiscateBet();
        this.statistics.updateDealerBalance(bet);
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
     * A formatted text representation of the chat's Blackjack statistics.
     */
    public get formattedStatisticsText(): string {
        return this.statistics.formattedText;
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
        this.rewardPlayersOnGameConclusion(conclusion);
        this.game = null;
        this.listeners.forEach((listener) => listener.onGameEnded(this, conclusion));
    }

    private createGame(player: Player): void {
        const deck = this.deckFactory.createDeck();
        this.game = new BlackjackGame(deck, player);
        this.game.subscribe(this);
    }

    private createPlayerFromUser(user: User, bet: number): Player {
        if (user.score < bet) {
            throw new Error("You don't have enough points to make that bet!");
        }
        const rewardFunction = user.addToScore.bind(user);
        return new Player(user.id, user.name, bet, rewardFunction);
    }

    private rewardPlayersOnGameConclusion(conclusion: GameConclusion): void {
        this.rewardPlayers(conclusion.playersWithBlackjack, ChatGameManager.BET_MULTIPLIER_ON_BLACKJACK);
        this.rewardPlayers(conclusion.higherScoreThanDealerPlayers, ChatGameManager.BET_MULTIPLIER_ON_WIN);
        this.rewardPlayers(conclusion.sameScoreAsDealerPlayers, ChatGameManager.BET_MULTIPLIER_ON_EVEN);
    }

    private rewardPlayers(players: Player[], multiplier: number) {
        players.forEach((player) => {
            const awarded = player.rewardPlayer(multiplier);
            this.statistics.updateDealerBalance(-awarded);
        });
    }
}
