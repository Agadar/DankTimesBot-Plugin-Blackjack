import { Card } from "../card/card";
import { Player } from "../player/player";
import { BlackjackGame } from "./blackjack-game";
import { GameConclusion } from "./game-conclusion";

/**
 * Listener to Blackjack game events.
 */
export interface IBlackjackGameListener {

    /**
     * Called when the initial round of cards has been dealt after
     * the wait on players is over.
     * @param game The game.
     * @param dealer The dealer.
     * @param startingPlayer The player that is up first.
     */
    onCardsDealt(game: BlackjackGame, dealer: Player, startingPlayer: Player): void;

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
     * @param dealer The dealer.
     * @param card The drawn card.
     */
    onDealerDrewCard(game: BlackjackGame, dealer: Player, card: Card): void;

    /**
     * Called when the game has ended.
     * @param game The game.
     * @param conclusion The game conclusion.
     */
    onGameEnded(game: BlackjackGame, conclusion: GameConclusion): void;
}
