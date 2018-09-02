import { Card } from "../card/card";

/**
 * A deck of playing cards.
 */
export class Deck {

    /**
     * Initializes this deck with a collection of cards.
     * @param cards A collection of playing cards.
     */
    constructor(private readonly cards: Card[]) { }

    /**
     * Draws a card from this deck, removing it from the card collection.
     * @return The drawn card.
     * @throws An error if the deck is empty.
     */
    public drawCard(): Card {
        if (this.cards.length === 0) {
            throw new Error("There are no more cards in the deck!");
        }
        return this.cards.splice(this.cards.length - 1, 1)[0];
    }

    /**
     * Shuffles this deck's card collection.
     */
    public shuffle(): void {
        this.fisherYatesShuffle(this.cards);
    }

    /**
     * Shuffles array in place according to Fisher–Yates shuffle algorithm.
     * (From: https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array)
     * @param a items An array containing the items.
     */
    private fisherYatesShuffle(a: any[]): void {
        let j;
        let x;
        let i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
    }
}
