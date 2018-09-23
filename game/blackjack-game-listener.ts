import { Card } from "../card/card";
import { Player } from "../player/player";
import { GameConclusion } from "./game-conclusion";

/**
 * Listener to Blackjack game events.
 */
export interface IBlackjackGameListener<T> {

    /**
     * Called when the initial round of cards has been dealt after
     * the wait on players is over.
     * @param source The source of the event.
     * @param dealer The dealer.
     * @param startingPlayer The player that is up first.
     */
    onCardsDealt(source: T, dealer: Player, startingPlayer: Player): void;

    /**
     * Called when a player took too long to make a decision, and thus
     * forfeited their turn.
     * @param source The source of the event.
     * @param timedOutPlayer The timed out player.
     * @param nextPlayer The next player.
     */
    onPlayerTurnTimedOut(source: T, timedOutPlayer: Player, nextPlayer: Player);

    /**
     * Called when the dealer has drawn a card for themselves.
     * @param source The source of the event.
     * @param dealer The dealer.
     * @param card The drawn card.
     */
    onDealerDrewCard(source: T, dealer: Player, card: Card): void;

    /**
     * Called when the game has ended.
     * @param source The source of the event.
     * @param conclusion The game conclusion.
     */
    onGameEnded(source: T, conclusion: GameConclusion): void;
}
