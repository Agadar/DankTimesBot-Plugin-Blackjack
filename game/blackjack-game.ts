import { User } from "../../../src/chat/user/user";
import { Deck } from "../deck/deck";
import { DeckFactory } from "../deck/deckFactory";
import { HandState } from "../player/hand-state";
import { Player } from "../player/player";
import { IBlackjackGameListener } from "./blackjack-game-listener";
import { GameConclusion } from "./game-conclusion";
import { GameState } from "./game-state";
import { HitResult } from "./hit-result";

/**
 * An on-going game of Blackjack.
 */
export class BlackjackGame {

    private static readonly TIME_WAIT_FOR_PLAYERS_MS = 15000;
    private static readonly TIME_PLAYER_TURN_MS = 15000;
    private static readonly TIME_BETWEEN_ACTIONS = 3000;

    private readonly dealer = new Player();
    private readonly myPlayers = new Array<Player>();
    private readonly listeners = new Array<IBlackjackGameListener<BlackjackGame>>();

    private gameState = GameState.INITIALIZING;
    private playerTurnIndex = -1;
    private playerTurnTimeoutId: NodeJS.Timeout;
    private deck: Deck;

    constructor(private readonly deckFactory: DeckFactory) { }

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
        return (this.gameState === GameState.INITIALIZING || this.gameState === GameState.AWAITING_PLAYERS);
    }

    /**
     * Initializes this game, starting a timer during which players can join
     * the game. After the timer, the game starts.
     * @returns The number of seconds before the game starts, or an error string if
     * initializing the game is not possible.
     */
    public initializeGame(): number | string {
        if (this.gameState !== GameState.INITIALIZING) {
            return "Game has already been initialized - this is a programming error!";
        }
        this.gameState = GameState.AWAITING_PLAYERS;
        setTimeout(this.dealCards.bind(this), BlackjackGame.TIME_WAIT_FOR_PLAYERS_MS);
        return BlackjackGame.TIME_WAIT_FOR_PLAYERS_MS / 1000;
    }

    /**
     * Joins this game of blackjack.
     * @param player The player that is joining.
     * @returns An error string if the maximum number of players has already been reached,
     * if the player is already partaking, or if joining is no longer possible.
     */
    public joinGame(player: Player): string | null {
        if (!this.isJoinable) {
            return "It's no longer possible to join the game!";
        }
        this.myPlayers.push(player);
        return null;
    }

    /**
     * If it is the turn of the player that has the supplied identifier, instructs the dealer they desire to stand.
     * @param identifier The identifier of the player desiring to stand.
     * @return The player that is next, which can also be the dealer, or null if the current player cannot stand.
     */
    public stand(identifier: number): Player | null {
        if (this.gameState !== GameState.PLAYER_TURNS) { return; }
        const currentPlayer = this.currentPlayer;
        if (currentPlayer.identifier !== identifier) { return; }
        clearTimeout(this.playerTurnTimeoutId);
        return this.startNextPlayerTurn();
    }

    /**
     * If it is the turn of the player that has the supplied identifier, instructs the dealer they desire to surrender.
     * @param identifier The identifier of the player desiring to surrender.
     * @return The player that is next, which can also be the dealer, or an error text if an error occured that
     * requires informing the users, or null if an error occured that does not require that.
     */
    public surrender(identifier: number): Player | string | null {
        if (this.gameState !== GameState.PLAYER_TURNS) { return; }
        const currentPlayer = this.currentPlayer;
        if (currentPlayer.identifier !== identifier) { return; }

        if (currentPlayer.isFirstTurn) {
            currentPlayer.setSurrendered();
            clearTimeout(this.playerTurnTimeoutId);
            const nextPlayer = this.startNextPlayerTurn();
            return nextPlayer;
        }
        return "Surrendering is no longer allowed!";
    }

    /**
     * If it is the turn of the player that has the supplied identifier, instructs the dealer they desire to hit.
     * @param identifier The identifier of the player desiring to hit.
     * @return Information about the hit results. or null if hitting failed.
     */
    public hit(identifier: number): HitResult | null {
        if (this.gameState !== GameState.PLAYER_TURNS) { return; }
        const theCurrentPlayer = this.currentPlayer;
        if (theCurrentPlayer.identifier !== identifier) {
            return;
        }
        clearTimeout(this.playerTurnTimeoutId);

        const drawnCard = this.deck.drawCard();
        theCurrentPlayer.giveCards(drawnCard);
        let theNextPlayer: Player;

        if (theCurrentPlayer.handState === HandState.Busted) {
            theNextPlayer = this.startNextPlayerTurn();
        } else {
            this.schedulePlayerTurnTimeout();
            theNextPlayer = theCurrentPlayer;
        }
        return { card: drawnCard, currentPlayer: theCurrentPlayer, nextPlayer: theNextPlayer };
    }

    /**
     * If it is the turn of the given user, instructs the dealer they desire to double down.
     * @param user The user desiring to double down.
     * @return Information about the hit results, or an error string if doubling down failed and the user need
     * be informed, or null if doubling down failed but no informing is necessary.
     */
    public doubleDown(user: User): HitResult | string | null {
        if (this.gameState !== GameState.PLAYER_TURNS) { return; }
        const theCurrentPlayer = this.currentPlayer;
        if (theCurrentPlayer.identifier !== user.id) {
            return;
        }
        if (!theCurrentPlayer.isFirstTurn) {
            return "Doubling down is no longer allowed!";
        }
        if (user.score < theCurrentPlayer.bet) {
            return "You don't have enough points to double down!";
        }
        clearTimeout(this.playerTurnTimeoutId);

        theCurrentPlayer.doubleDown();
        const drawnCard = this.deck.drawCard();
        theCurrentPlayer.giveCards(drawnCard);
        const theNextPlayer = this.startNextPlayerTurn();
        return { card: drawnCard, currentPlayer: theCurrentPlayer, nextPlayer: theNextPlayer };
    }

    private dealCards(): void {
        this.gameState = GameState.DEALING_CARDS;
        this.deck = this.deckFactory.createDeck(this.myPlayers.length);
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
            while (this.dealer.handState === HandState.Normal && !this.dealer.hasReachedDealerMinimum) {
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
        const surrenderedPlayers = this.getSurrenderedPlayers();

        return new GameConclusion(
            this.dealer.handState === HandState.Busted,
            bustedPlayers,
            lowerScoreThanDealerPlayers,
            sameScoreAsDealerPlayers,
            higherScoreThanDealerPlayers,
            playersWithBlackjack,
            surrenderedPlayers);
    }

    private thereAreNonBustedPlayersWithoutBlackjack(): boolean {
        return this.myPlayers.findIndex((player) => player.handState === HandState.Normal) !== -1;
    }

    private getBustedPlayers(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Busted);
    }

    private getPlayersWithLowerScoreThanDealer(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Normal &&
            player.highestNonBustedHandValue < this.dealer.highestNonBustedHandValue);
    }

    private getPlayersWithSameScoreAsDealer(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Normal &&
            player.highestNonBustedHandValue === this.dealer.highestNonBustedHandValue);
    }

    private getPlayersWithHigherScoreThanDealer(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Normal &&
            player.highestNonBustedHandValue > this.dealer.highestNonBustedHandValue);
    }

    private getPlayersWithBlackjack(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Blackjack);
    }

    private getSurrenderedPlayers(): Player[] {
        return this.myPlayers.filter((player) => player.handState === HandState.Surrendered);
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
