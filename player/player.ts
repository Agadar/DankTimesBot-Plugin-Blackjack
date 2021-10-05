import { Card } from "../card/card";
import { Rank } from "../card/rank";
import { RANK_VALUES } from "../card/rankValues";
import { HandState } from "./hand-state";

/**
 * A player partaking in a game of Blackjack.
 */
export class Player {

    private static readonly MAX_HAND_VALUE = 21;
    private static readonly DEALER_MIN_GOAL = 17;

    private static readonly DEALER_IDENTIFIER = -1;
    private static readonly DEALER_NAME = "The dealer";

    private static readonly BET_CONFISCATION_REASON = "bet.confiscation";
    private static readonly WINNER_REWARD_REASON = "winner.reward";
    private static readonly SURRENDERED_REWARD_REASON = "surrendered.reward";

    private readonly mycards = new Array<Card>();

    private myHandState = HandState.Normal;
    private myNonBustedHandValues: number[] = [];
    private myHasReachedDealerMinimum = false;

    /**
     * Initializes a new player.
     * @param identifier A unique identifier for this player. If -1, this player
     * is assumed to be the dealer.
     * @param name The name of this player. If not supplied, falls back to a default
     * dealer name.
     * @param bet The original bet of the player. Does not have to be supplied if this
     * player is the dealer (as it will be ignored anyway).
     * @param updateScoreFunction The function to use for updating the score, which is
     * used for subtracting the original bet from the player as well as for rewarding them
     * if they won a round. Does not have to be supplied if this player is the dealer
     * (as it will be ignored anyway).
     * @throws An error if the bet is incorrect.
     */
    constructor(
        public readonly identifier = Player.DEALER_IDENTIFIER,
        private readonly name = Player.DEALER_NAME,
        private readonly bet = 0,
        private readonly updateScoreFunction?: ((points: number, reason: string) => void)) {

        if (!this.isDealer && (bet < 1 || bet % 1 !== 0)) {
            throw new Error("Your bet must be a whole, positive number!");
        }
    }

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
     * The player's hand state.
     */
    public get handState(): HandState {
        return this.myHandState;
    }

    /**
     * Sets this player as having surrendered.
     */
    public setSurrendered() {
        this.myHandState = HandState.Surrendered;
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
     * Gets this player's formatted name.
     */
    public get formattedName(): string {
        if (!this.isDealer) {
            return `@${this.name}`;
        }
        return this.name;
    }

    /**
     * Gets whether this player is the dealer.
     */
    public get isDealer(): boolean {
        return this.identifier === Player.DEALER_IDENTIFIER;
    }

    /**
     * Whether this player may draw another card according to their
     * busted and blackjack status.
     */
    public get mayDrawCard(): boolean {
        return this.myHandState === HandState.Normal;
    }

    /**
     * Confiscates the bet from the player. Assumed to be done sometime
     * before the start of the game of blackjack.
     */
    public confiscateBet(): void {
        if (!this.isDealer && this.updateScoreFunction) {
            this.updateScoreFunction(-this.bet, Player.BET_CONFISCATION_REASON);
        }
    }

    /**
     * Rewards the player, using the supplied multiplier for their bet.
     * @param multiplier The multiplier to use.
     * @returns The amount with which the player was rewarded.
     */
    public rewardPlayer(multiplier: number): number {
        let reward = 0;
        if (!this.isDealer && this.updateScoreFunction) {
            reward = Math.floor(this.bet * multiplier);
            const reason = this.handState === HandState.Surrendered ?
                Player.SURRENDERED_REWARD_REASON : Player.WINNER_REWARD_REASON;
            this.updateScoreFunction(reward, reason);
        }
        return reward;
    }

    private calculatePossibleHandValues(): number[] {
        let sums = [0];
        for (const card of this.mycards) {
            const cardValues = RANK_VALUES.get(card.rank) ?? [];
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
        if (this.mycards.length === 2 && this.highestNonBustedHandValue === Player.MAX_HAND_VALUE &&
            (this.mycards[0].rank === Rank.Ace || this.mycards[1].rank === Rank.Ace)) {
            this.myHandState = HandState.Blackjack;
        }
    }

    private recalculateIsBusted(handValues: number[]): void {
        const index = handValues.findIndex((value) => value <= Player.MAX_HAND_VALUE);

        if (index === -1) {
            this.myHandState = HandState.Busted;
        }
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
