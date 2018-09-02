import { User } from "../../../src/chat/user/user";
import { Card } from "../card/card";
import { RANK_VALUES } from "../card/rankValues";

/**
 * A player partaking in a game of Blackjack.
 */
export class Player {

    private static readonly BLACKJACK = 21;
    private static readonly DEALER_MIN_GOAL = 17;

    private readonly mycards = new Array<Card>();

    private myIsBusted = false;
    private myHighestNonBustedHandValue = 0;
    private myHasReachedDealerMinimum = false;
    private myHasBlackjack = false;

    /**
     * Initializes a new player.
     * @param user The user behind the player.
     * @param bet The original bet of the player.
     */
    constructor(public readonly user?: User, public readonly bet?: number) { }

    /**
     * Gives the specified playing cards to this player.
     * @param cards The card to give to the player.
     */
    public giveCards(...cards: Card[]): void {
        cards.forEach((card) => this.mycards.push(card));
        const handValues = this.calculatePossibleHandValues();
        this.recalculateIsBusted(handValues);
        this.recalculateHighestNonBustedHandValue(handValues);
        this.recalculateHasReachedDealerMinimum(handValues);
    }

    /**
     * The player's current cards.
     */
    public get cards(): Card[] {
        return this.mycards.slice(0, this.mycards.length);
    }

    /**
     * Whether this player is busted.
     */
    public get isBusted(): boolean {
        return this.myIsBusted;
    }

    /**
     * Gets the highest unbusted hand value of this player's hand.
     */
    public get highestNonBustedHandValue(): number {
        return this.myHighestNonBustedHandValue;
    }

    /**
     * Whether this player has reached the dealer minimum.
     */
    public get hasReachedDealerMinimum(): boolean {
        return this.myHasReachedDealerMinimum;
    }

    /**
     * Whether this player has blackjack.
     */
    public get hasBlackjack(): boolean {
        return this.myHasBlackjack;
    }

    private calculatePossibleHandValues(): number[] {
        let sums = [0];
        for (const card of this.mycards) {
            const cardValues = RANK_VALUES.get(card.rank);
            let newSums: number[] = [];

            for (const cardValue of cardValues) {
                const sumsCopy = sums.slice(0, sums.length);

                for (let j = 0; j < sumsCopy.length; j++) {
                    sumsCopy[j] += cardValue;
                }
                newSums = newSums.concat(sumsCopy);
            }
            sums = newSums;
        }
        return sums;
    }

    private recalculateIsBusted(handValues: number[]): void {
        const index = handValues.findIndex((value) => value <= Player.BLACKJACK);
        this.myIsBusted = index === -1;
    }

    private recalculateHighestNonBustedHandValue(handValues: number[]): void {
        const nonBustedHandValues = handValues.filter((value) => value <= Player.BLACKJACK);
        if (nonBustedHandValues.length < 1) {
            this.myHighestNonBustedHandValue = 0;
        } else {
            this.myHighestNonBustedHandValue = Math.max(...nonBustedHandValues);
        }
        this.myHasBlackjack = this.myHighestNonBustedHandValue === Player.BLACKJACK;
    }

    private recalculateHasReachedDealerMinimum(handValues: number[]): void {
        const foundIndex = handValues
            .findIndex((value) => value >= Player.DEALER_MIN_GOAL && value <= Player.BLACKJACK);
        this.myHasReachedDealerMinimum = foundIndex !== -1;
    }
}
