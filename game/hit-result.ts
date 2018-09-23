import { Card } from "../card/card";
import { Player } from "../player/player";

/**
 * The results of instructing the dealer to 'hit' during a round of Blackjack.
 */
export class HitResult {

    /**
     * Constructor.
     * @param card The card that was drawn.
     * @param currentPlayer The current player.
     * @param nextPlayer The next player, which can possibly be the same as currentPlayer (if
     * the player didn't bust), or the dealer (if all players finished their turns).
     */
    public constructor(
        public readonly card: Card,
        public readonly currentPlayer: Player,
        public readonly nextPlayer: Player,
    ) { }
}
