import { AlterUserScoreArgs } from "../../../src/chat/alter-user-score-args";
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

    // Bet multipliers
    private static readonly BET_MULTIPLIER_ON_EVEN = 1;
    private static readonly BET_MULTIPLIER_ON_WIN = 2;
    private static readonly BET_MULTIPLIER_ON_BLACKJACK = 2.5;
    private static readonly BET_MULTIPLIER_ON_SURRENDER = 0.5;

    // Reward reasons
    private static readonly WINNER_REWARD_REASON = "winner.reward";
    private static readonly SURRENDERED_REWARD_REASON = "surrendered.reward";
    private static readonly EQUALED_DEALER_REWARD_REASON = "equaled.dealer.reward";

    private readonly listeners = new Array<IBlackjackGameListener<ChatGameManager>>();
    private readonly statistics = new ChatStatistics();

    private game: BlackjackGame | null = null;

    /**
     * Constructor.
     * @param deckFactory The deck factory to use for generating decks.
     * @param chat The chat for which this manager manages blackjack games.
     * @param pluginName Name of this plugin.
     */
    constructor(
        private readonly deckFactory: DeckFactory,
        private readonly chat: Chat,
        private readonly pluginName: string) { }

    /**
     * Starts a new game, if possible.
     * @param user The user that started the game.
     * @param bet The user's bet.
     * @returns The number of seconds before the game starts, or an error string
     * if starting the game failed.
     */
    public startNewGame(user: User, bet: number): number | string {
        if (this.gameIsRunning) {
            return "There's already a game ongoing!";
        }
        const createPlayerResult = this.createPlayerFromUser(user, bet);

        if (typeof (createPlayerResult) === "string") {
            return createPlayerResult;
        }
        const errorMsg = this.createGame(createPlayerResult);

        if (errorMsg) {
            return errorMsg;
        }
        const initializeGameResult = (this.game as BlackjackGame).initializeGame();

        if (typeof (initializeGameResult) === "string") {
            return initializeGameResult;
        }
        createPlayerResult.confiscateBet();
        this.statistics.updateDealerBalance(bet);
        return initializeGameResult;
    }

    /**
     * Joins the game, if possible.
     * @param user The user that is joining.
     * @param bet The user's bet.
     * @returns An error text if something went wrong, otherwise null.
     */
    public joinGame(user: User, bet: number): string | null {
        if (!this.gameIsRunning) {
            return null;
        }
        const createPlayerResult = this.createPlayerFromUser(user, bet);

        if (typeof (createPlayerResult) === "string") {
            return createPlayerResult;
        }
        const joinGameResult = (this.game as BlackjackGame).joinGame(createPlayerResult);

        if (joinGameResult) {
            return joinGameResult;
        }
        createPlayerResult.confiscateBet();
        this.statistics.updateDealerBalance(bet);
    }

    /**
     * If it is the user's turn, instructs the dealer they desire to stand.
     * @param userId The id of the user desiring to stand.
     * @return The player that is next, which can also be the dealer.
     */
    public stand(userId: number): Player | null {
        if (this.gameIsRunning) {
            return (this.game as BlackjackGame).stand(userId);
        }
    }

    /**
     * If it is the user's turn, instructs the dealer they desire to surrender.
     * @param userId The id of the user desiring to surrender.
     * @return The player that is next, which can also be the dealer, or an error string
     * if surrendering is not possible.
     */
    public surrender(userId: number): Player | string | null {
        if (this.gameIsRunning) {
            return (this.game as BlackjackGame).surrender(userId);
        }
    }

    /**
     * Instructs the dealer the user desires to hit.
     * @param userId The id of the user desiring to hit.
     * @return Information about the hit results. or null if hitting failed.
     */
    public hit(userId: number): HitResult | null {
        if (this.gameIsRunning) {
            return (this.game as BlackjackGame).hit(userId);
        }
    }

    /**
     * If it is the turn of the given user, instructs the dealer they desire to double down.
     * @param user The user desiring to double down.
     * @return Information about the hit results, or an error string if doubling down failed and the user need
     * be informed, or null if doubling down failed but no informing is necessary.
     */
    public doubleDown(user: User): HitResult | string | null {
        if (this.gameIsRunning) {
            return (this.game as BlackjackGame).doubleDown(user);
        }
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
        return (this.game as BlackjackGame).players;
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

    private createGame(player: Player): string | null {
        this.game = new BlackjackGame(this.deckFactory);
        const errorMsg = this.game.joinGame(player);

        if (errorMsg) {
            this.game = null;
            return errorMsg;
        }
        this.game.subscribe(this);
        return null;
    }

    private createPlayerFromUser(user: User, bet: number): Player | string {
        if (user.score < bet) {
            return "You don't have enough points to make that bet!";
        }
        if (bet < 1 || bet % 1 !== 0) {
            return "Your bet must be a whole, positive number!";
        }
        const rewardFunction = (points: number, reason: string) => {
            const scoreArgs = new AlterUserScoreArgs(user, points, this.pluginName, reason);
            this.chat.alterUserScore(scoreArgs);
        };
        return new Player(user.id, user.name, bet, rewardFunction);
    }

    private rewardPlayersOnGameConclusion(conclusion: GameConclusion): void {
        this.rewardPlayers(conclusion.playersWithBlackjack, ChatGameManager.BET_MULTIPLIER_ON_BLACKJACK,
            ChatGameManager.WINNER_REWARD_REASON);
        this.rewardPlayers(conclusion.higherScoreThanDealerPlayers, ChatGameManager.BET_MULTIPLIER_ON_WIN,
            ChatGameManager.WINNER_REWARD_REASON);
        this.rewardPlayers(conclusion.sameScoreAsDealerPlayers, ChatGameManager.BET_MULTIPLIER_ON_EVEN,
            ChatGameManager.EQUALED_DEALER_REWARD_REASON);
        this.rewardPlayers(conclusion.surrenderedPlayers, ChatGameManager.BET_MULTIPLIER_ON_SURRENDER,
            ChatGameManager.SURRENDERED_REWARD_REASON);
    }

    private rewardPlayers(players: Player[], multiplier: number, reason: string) {
        players.forEach((player) => {
            const awarded = player.rewardPlayer(multiplier, reason);
            this.statistics.updateDealerBalance(-awarded);
        });
    }
}
