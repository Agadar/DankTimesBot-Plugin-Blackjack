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
     */
    constructor(public readonly suit: Suit, public readonly rank: Rank) { }

    /**
     * Gets the string representation of this card.
     * @return This card as a string.
     */
    public toString(): string {
        return `<b>${this.suit} ${this.rank}</b>`;
    }
}
