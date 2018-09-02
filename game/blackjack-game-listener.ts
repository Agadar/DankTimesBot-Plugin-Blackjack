import { Card } from "../card/card";
import { Player } from "../player/player";
import { BlackjackGame } from "./blackjack-game";

/**
 * Listener to Blackjack game events.
 */
export interface IBlackjackGameListener {

    /**
     * Called when the initial round of cards has been dealt after
     * the wait on players is over.
     * @param game The game.
     * @param startingPlayer The player that is up first.
     */
    onCardsDealt(game: BlackjackGame, startingPlayer: Player): void;

    /**
     * Called when a player took too long to make a decision, and thus
     * forfeited their turn.
     * @param game The game.
     * @param timedOutPlayer The timed out player.
     * @param nextPlayer The next player.
     */
    onPlayerTurnTimedOut(game: BlackjackGame, timedOutPlayer: Player, nextPlayer: Player);

    /**
     * Called when the dealer has drawn a card for themselves.
     * @param game The game.
     * @param card The drawn card.
     */
    onDealerDrewCard(game: BlackjackGame, card: Card): void;

    /**
     * Called when the game has ended.
     * @param game The game.
     * @param winners The players that won and thus were rewarded.
     * @param dealerBusted Whether the dealer went bust.
     */
    onGameEnded(game: BlackjackGame, winners: Player[], dealerBusted: boolean): void;
}
