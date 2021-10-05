import { Player } from "../player/player";

/**
 * The conclusion to a game of Blackjack.
 */
export class GameConclusion {

    /**
     * Constructor.
     * @param dealerBusted Whether the dealer went bust.
     * @param bustedPlayers The players that went bust.
     * @param lowerScoreThanDealerPlayers The players that had a lower score than the dealer.
     * @param sameScoreAsDealerPlayers The players that had the same (non-blackjack) score as the dealer.
     * @param higherScoreThanDealerPlayers The players that had a higher (non-blackjack) score than the dealer.
     * @param playersWithBlackjack The players that had a blackjack.
     * @param surrenderedPlayers The players that surrendered.
     */
    constructor(
        public readonly dealerBusted: boolean,
        public readonly bustedPlayers: Player[],
        public readonly lowerScoreThanDealerPlayers: Player[],
        public readonly sameScoreAsDealerPlayers: Player[],
        public readonly higherScoreThanDealerPlayers: Player[],
        public readonly playersWithBlackjack: Player[],
        public readonly surrenderedPlayers: Player[]) { }

}
