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

        // tslint:disable-next-line:forin
        for (const suit in Suit) {
            const castSuit = Suit[suit] as Suit;

            // tslint:disable-next-line:forin
            for (const rank in Rank) {
                const castRank = Rank[rank] as Rank;
                const card = new Card(castSuit, castRank);
                cards.push(card);
            }
        }
        return new Deck(cards);
    }
}
