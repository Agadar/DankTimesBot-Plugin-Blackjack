import { Rank } from "./rank";
import { Suit } from "./suit";

/**
 * A playing card.
 */
export class Card {

    /**
     * Initializes this card with the supplied suit and rank.
     * @param suit The suit of this card.
     * @param rank The rank of this card.
     * @param faceUp If the card is face-up (true) or face-down (false).
     */
    constructor(public readonly suit: Suit, public readonly rank: Rank, public faceUp: boolean) { }

    /**
     * Gets the string representation of this card.
     * @return This card as a string.
     */
    public toString(): string {
        return this.faceUp ? `<b>${this.suit} ${this.rank}</b>` : "a hole card";
    }
}
