import { Deck } from "../deck/deck";
import { Player } from "../player/player";
import { IBlackjackGameListener } from "./blackjack-game-listener";
import { GameConclusion } from "./game-conclusion";
import { GameState } from "./game-state";
import { HitResult } from "./hit-result";

/**
 * An on-going game of Blackjack.
 */
export class BlackjackGame {

    private static readonly MAX_PLAYERS = 3;

    private static readonly TIME_WAIT_FOR_PLAYERS_MS = 15000;
    private static readonly TIME_PLAYER_TURN_MS = 15000;
    private static readonly TIME_BETWEEN_ACTIONS = 3000;

    private readonly dealer = new Player();
    private readonly myPlayers = new Array<Player>();
    private readonly listeners = new Array<IBlackjackGameListener<BlackjackGame>>();

    private gameState = GameState.INITIALIZING;
    private playerTurnIndex = -1;
    private playerTurnTimeoutId: NodeJS.Timeout;

    /**
     * Initializes a new game.
     * @param player The player that is joining.
     * @throws See #joinGame.
     */
    constructor(private readonly deck: Deck, player: Player) {
        this.joinGame(player);
    }

    /**
     * Subscribes to this blackjack game to receive asynchronous updates.
     * @param subscriber The component subscribing to this game.
     */
    public subscribe(subscriber: IBlackjackGameListener<BlackjackGame>) {
        if (this.listeners.indexOf(subscriber) === -1) {
            this.listeners.push(subscriber);
        }
    }

    /**
     * This game's players.
     */
    public get players(): Player[] {
        return this.myPlayers.slice(0, this.myPlayers.length);
    }

    /**
     * Whether this game is (still) joinable.
     */
    public get isJoinable(): boolean {
        return (this.gameState === GameState.INITIALIZING || this.gameState === GameState.AWAITING_PLAYERS)
            && this.myPlayers.length < BlackjackGame.MAX_PLAYERS;
    }

    /**
     * Initializes this game, starting a timer during which players can join
     * the game. After the timer, the game starts.
     * @return The number of seconds before the game starts.
     * @throws An error if the game was already initialized.
     */
    public initializeGame(): number {
        if (this.gameState !== GameState.INITIALIZING) {
            throw new Error("Game has already been initialized - this is a programming error!");
        }
        this.gameState = GameState.AWAITING_PLAYERS;
        setTimeout(this.dealCards.bind(this), BlackjackGame.TIME_WAIT_FOR_PLAYERS_MS);
        return BlackjackGame.TIME_WAIT_FOR_PLAYERS_MS / 1000;
    }

    /**
     * Joins this game of blackjack.
     * @param player The player that is joining.
     * @throws An error if the maximum number of players has already been reached,
     * if the player is already partaking, or if joining is no longer possible.
     */
    public joinGame(player: Player): void {
        if (!this.isJoinable) {
            throw new Error("It's no longer possible to join the game!");
        }
        if (this.myPlayers.findIndex((entry) => entry.identifier === player.identifier) !== -1) {
            throw new Error("You're already partaking in this game!");
        }
        this.myPlayers.push(player);
    }

    /**
     * If it is the turn of the player that has the supplied identifier, instructs the dealer they desire to stand.
     * @param identifier The identifier of the player desiring to stand.
     * @return The player that is next, which can also be the dealer.
     * @throws Error if it is not the player's turn.
     */
    public stand(identifier: number): Player {
        if (this.gameState !== GameState.PLAYER_TURNS) { throw new Error("It is not your turn!"); }
        const currentPlayer = this.currentPlayer;
        if (currentPlayer.identifier !== identifier) { throw new Error("It is not your turn!"); }
        clearTimeout(this.playerTurnTimeoutId);
        return this.startNextPlayerTurn();
    }

    /**
     * If it is the turn of the player that has the supplied identifier, instructs the dealer they desire to stand.
     * @param identifier The identifier of the player desiring to stand.
     * @return Information about the hit results.
     * @throws Error if it is not the player's turn.
     */
    public hit(identifier: number): HitResult {
        if (this.gameState !== GameState.PLAYER_TURNS) { throw new Error("It is not your turn!"); }
        const theCurrentPlayer = this.currentPlayer;
        if (theCurrentPlayer.identifier !== identifier) {
            throw new Error("It is not your turn!");
        }
        clearTimeout(this.playerTurnTimeoutId);

        const drawnCard = this.deck.drawCard();
        theCurrentPlayer.giveCards(drawnCard);
        let theNextPlayer: Player;

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
        this.myPlayers.forEach((player) => player.giveCards(this.deck.drawCard()));
        this.dealer.giveCards(this.deck.drawCard());
        this.myPlayers.forEach((player) => player.giveCards(this.deck.drawCard()));
        this.gameState = GameState.PLAYER_TURNS;
        const currentPlayer = this.startNextPlayerTurn();
        this.listeners.forEach((listener) => listener.onCardsDealt(this, this.dealer, currentPlayer));
    }

    private schedulePlayerTurnTimeout(): void {
        this.playerTurnTimeoutId = setTimeout(this.onPlayerTurnTimeout.bind(this), BlackjackGame.TIME_PLAYER_TURN_MS);
    }

    private onPlayerTurnTimeout(): void {
        const timedOutPlayer = this.currentPlayer;
        const nextPlayer = this.startNextPlayerTurn();
        this.listeners.forEach((listener) => listener.onPlayerTurnTimedOut(this, timedOutPlayer, nextPlayer));
    }

    private startNextPlayerTurn(): Player {
        this.playerTurnIndex++;
        let currentPlayer = this.currentPlayer;

        if (currentPlayer === this.dealer) {
            this.scheduleDealerTurn();
        } else if (!currentPlayer.mayDrawCard) {
            currentPlayer = this.startNextPlayerTurn();
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

        if (this.thereAreNonBustedPlayersWithoutBlackjack()) {
            while (!this.dealer.isBusted && !this.dealer.hasReachedDealerMinimum) {
                const newCard = this.deck.drawCard();
                this.dealer.giveCards(newCard);
                this.listeners.forEach((listener) => listener.onDealerDrewCard(this, this.dealer, newCard));
                await this.asyncSleep(BlackjackGame.TIME_BETWEEN_ACTIONS);
            }
        }

        this.gameState = GameState.ENDED;
        const conclusion = this.getGameConclusion();
        this.listeners.forEach((listener) => listener.onGameEnded(this, conclusion));
    }

    private getGameConclusion(): GameConclusion {
        const bustedPlayers = this.getBustedPlayers();
        const lowerScoreThanDealerPlayers = this.getPlayersWithLowerScoreThanDealer();
        const sameScoreAsDealerPlayers = this.getPlayersWithSameScoreAsDealer();
        const higherScoreThanDealerPlayers = this.getPlayersWithHigherScoreThanDealer();
        const playersWithBlackjack = this.getPlayersWithBlackjack();

        return new GameConclusion(
            this.dealer.isBusted,
            bustedPlayers,
            lowerScoreThanDealerPlayers,
            sameScoreAsDealerPlayers,
            higherScoreThanDealerPlayers,
            playersWithBlackjack);
    }

    private thereAreNonBustedPlayersWithoutBlackjack(): boolean {
        return this.myPlayers.findIndex((player) => !player.isBusted && !player.hasBlackjack) !== -1;
    }

    private getBustedPlayers(): Player[] {
        return this.myPlayers.filter((player) => player.isBusted);
    }

    private getPlayersWithLowerScoreThanDealer(): Player[] {
        return this.myPlayers.filter((player) =>
            !player.isBusted && player.highestNonBustedHandValue < this.dealer.highestNonBustedHandValue);
    }

    private getPlayersWithSameScoreAsDealer(): Player[] {
        return this.myPlayers.filter((player) =>
            !player.isBusted && !player.hasBlackjack &&
            player.highestNonBustedHandValue === this.dealer.highestNonBustedHandValue);
    }

    private getPlayersWithHigherScoreThanDealer(): Player[] {
        return this.myPlayers.filter((player) =>
            player.highestNonBustedHandValue > this.dealer.highestNonBustedHandValue
            && !player.isBusted && !player.hasBlackjack);
    }

    private getPlayersWithBlackjack(): Player[] {
        return this.myPlayers.filter((player) => player.hasBlackjack);
    }

    private get currentPlayer(): Player {
        if (this.playerTurnIndex >= this.myPlayers.length) {
            return this.dealer;
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
