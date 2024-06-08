import { Card } from "../card/card";
import { Rank } from "../card/rank";
import { Suit } from "../card/suit";
import { Deck } from "./deck";

/**
 * Simple factory that yields fresh new decks of playing cards.
 */
export class DeckFactory {

    /**
     * Creates and returns a fresh new deck of playing cards.
     * @param numberOfCardSets The number of card sets to compose the deck of.
     * @return A new deck of playing cards.
     */
    public createDeck(numberOfCardSets: number): Deck {
        const cards = new Array<Card>();

        for (let i = 0; i < numberOfCardSets; i++) {
            for (const suit of Object.values(Suit)) {
                for (const rank of Object.values(Rank)) {
                    const card = new Card(suit, rank);
                    cards.push(card);
                }
            }
        }
        return new Deck(cards);
    }
}
