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
     */
    onCardsDealt(source: T, dealer: Player): void;

    /**
     * Called when the dealer has blackjack potential.
     * @param source The source of the event.
     */
    onDealerHasBlackjackPotential(source: T): void;

    /**
     * Called when the first player's turn is started, which could be the dealer.
     * @param source The source of the event.
     * @param player The first player.
     * @param unfulfilledBlackjackPotential If the dealer had blackjack potential, but didn't have it after checking the hole card.
     */
    onFirstPlayerTurnStart(source: T, player: Player, unfulfilledBlackjackPotential: boolean): void;

    /**
     * Called when a player took too long to make a decision, and thus
     * forfeited their turn.
     * @param source The source of the event.
     * @param timedOutPlayer The timed out player.
     * @param nextPlayer The next player.
     */
    onPlayerTurnTimedOut(source: T, timedOutPlayer: Player, nextPlayer: Player): void;

    /**
     * Called when the dealer has revealed the hole card.
     * @param source The source of the event.
     * @param dealer The dealer.
     * @param holeCard The revealed hole card.
     */
    onHoleCardRevealed(source: T, dealer: Player, holeCard: Card): void;

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
