import { User } from "../../../src/chat/user/user";
import { Card } from "../card/card";
import { Rank } from "../card/rank";
import { RANK_VALUES } from "../card/rankValues";

/**
 * A player partaking in a game of Blackjack.
 */
export class Player {

    private static readonly MAX_HAND_VALUE = 21;
    private static readonly DEALER_MIN_GOAL = 17;

    private readonly mycards = new Array<Card>();

    private myHasBlackjack = false;
    private myIsBusted = false;
    private myNonBustedHandValues: number[] = [];
    private myHasReachedDealerMinimum = false;

    /**
     * Initializes a new player.
     * @param user The user behind the player. If not supplied, this player
     * is assumed to be the dealer.
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
        this.recalculateNonBustedHandValues(handValues);
        this.recalculateHasReachedDealerMinimum(handValues);
        this.recalculateHasBlackjack();
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
     * Gets the highest unbusted hand value of this player's hand, or
     * -1 if they have no unbusted combination of cards.
     */
    public get highestNonBustedHandValue(): number {
        if (this.nonBustedHandValues.length > 0) {
            return this.nonBustedHandValues[0];
        }
        return -1;
    }

    /**
     * Gets this player's unbusted hand values, sorted from highest
     * values to lowest values.
     */
    public get nonBustedHandValues(): number[] {
        return this.myNonBustedHandValues;
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

    /**
     * Gets this player's formatted name.
     */
    public get name(): string {
        if (this.user) {
            return `@${this.user.name}`;
        }
        return "The dealer";
    }

    /**
     * Gets whether this player is the dealer.
     */
    public get isDealer(): boolean {
        return this.user === undefined || this.user === null;
    }

    /**
     * Whether this player may draw another card according to their
     * busted and blackjack status.
     */
    public get mayDrawCard(): boolean {
        return !this.isBusted && !this.hasBlackjack;
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
        return this.removeDuplicates(sums);
    }

    private recalculateHasBlackjack(): void {
        if (this.mycards.length !== 2) {
            this.myHasBlackjack = false;
        } else {
            this.myHasBlackjack = this.highestNonBustedHandValue === Player.MAX_HAND_VALUE &&
                (this.mycards[0].rank === Rank.Ace || this.mycards[1].rank === Rank.Ace);
        }
    }

    private recalculateIsBusted(handValues: number[]): void {
        const index = handValues.findIndex((value) => value <= Player.MAX_HAND_VALUE);
        this.myIsBusted = index === -1;
    }

    private recalculateNonBustedHandValues(handValues: number[]): void {
        const nonBustedHandValues = handValues.filter((value) => value <= Player.MAX_HAND_VALUE);
        this.myNonBustedHandValues = nonBustedHandValues.sort((a, b) => b - a);
    }

    private recalculateHasReachedDealerMinimum(handValues: number[]): void {
        const foundIndex = handValues
            .findIndex((value) => value >= Player.DEALER_MIN_GOAL && value <= Player.MAX_HAND_VALUE);
        this.myHasReachedDealerMinimum = foundIndex !== -1;
    }

    private removeDuplicates(numbers: number[]): number[] {
        return numbers.filter((elem, index, self) => index === self.indexOf(elem));
    }
}
