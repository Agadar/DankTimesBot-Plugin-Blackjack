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
     * @return A new deck of playing cards.
     */
    public createDeck(): Deck {
        const cards = new Array<Card>();
        for (const suit of Object.values(Suit)) {
            for (const rank of Object.values(Rank)) {
                const card = new Card(suit, rank);
                cards.push(card);
            }
        }
        return new Deck(cards);
    }
}
