/**
 * State of a player's hand.
 */
export enum HandState {
    /**
     * Player has blackjack in hand.
     */
    Blackjack,
    /**
     * Player is busted.
     */
    Busted,
    /**
     * Player has surrendered.
     */
    Surrendered,
    /**
     * Player does not have or did not do any of the aforementioned.
     */
    Normal,
}
