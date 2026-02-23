import { Card } from "../card/card";
import { Rank } from "../card/rank";
import { RANK_VALUES } from "../card/rankValues";
import { HandState } from "./hand-state";

/**
 * A player (or the dealer) partaking in a game of Blackjack.
 */
export class Player {

    private static readonly MAX_HAND_VALUE = 21;
    private static readonly DEALER_MIN_GOAL = 17;

    private static readonly DEALER_IDENTIFIER = -1;
    private static readonly DEALER_NAME = "The dealer";

    private static readonly BET_CONFISCATION_REASON = "bet.confiscation";

    private readonly cards = new Array<Card>();

    private myHandState = HandState.Normal;
    private myNonBustedHandValues: number[] = [];
    private myHasReachedDealerMinimum = false;

    /**
     * Initializes a new player.
     * @param identifier A unique identifier for this player. If -1, this player
     * is assumed to be the dealer.
     * @param name The name of this player. If not supplied, falls back to a default
     * dealer name.
     * @param myBet The original bet of the player. Does not have to be supplied if this
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
        private myBet = 0,
        private readonly updateScoreFunction?: ((points: number, reason: string) => void)) { }

    /**
     * The player's hand state.
     */
    public get handState(): HandState {
        return this.myHandState;
    }

    /**
     * The player's bet.
     */
    public get bet(): number {
        return this.myBet;
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
     * Gets the string-formatted representation of this player's hand (e.g. '♠️ Jack and ♦️ Queen.   (20)').
     */
    public get formattedHand(): string {
        let formatted = this.cards[0].toString();

        if (this.cards.length > 1) {
            let cardIndex = 1;

            for (; cardIndex < this.cards.length - 1; cardIndex++) {
                formatted += ", " + this.cards[cardIndex].toString();
            }
            formatted += " and " + this.cards[cardIndex].toString();
        }
        formatted += ".";

        if (!this.cards.find((card) => !card.faceUp)) {
            formatted += this.formattedHandValues;    // Do not show hand value if hole card is not yet revealed.
        }
        return formatted;
    }

    /**
     * Gets the string-formatted representation of this player's hand's values(s), prefixed with additional spaces (e.g. '   (21 or 11)').
     */
    public get formattedHandValues(): string {
        if (this.handState !== HandState.Busted) {
            const handValues = this.nonBustedHandValues.map((value) => value.toString()).join(" or ");
            return `   (${handValues})`;
        }
        return ` ${this.formattedName} busted.`;
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
     * True if its the player's first turn, else false.
     */
    public get isFirstTurn(): boolean {
        return this.cards.length === 2;
    }

    /**
     * True if this dealer has blackjack potential as revealed by the face-up card's value, else false.
     */
    public get hasBlackjackPotentialWithHoleCard(): boolean {
        const faceUpCard = this.cards.find((c) => c.faceUp)!;
        const faceUpCardValues = RANK_VALUES.get(faceUpCard.rank)!;
        const faceUpCardHighestValue = Math.max(...faceUpCardValues);
        return faceUpCardHighestValue >= 10;
    }

    /**
     * True if this dealer has blackjack with the hole card, else false.
     */
    public get hasBlackjackWithHoleCard(): boolean {
        const handValues = this.calculatePossibleHandValues(this.cards);
        return this.hasBlackjack(this.cards, handValues);
    }

    /**
     * Sets this player as having surrendered.
     */
    public setSurrendered() {
        this.myHandState = HandState.Surrendered;
    }

    /**
     * Instructs this player they're doubling down.
     */
    public doubleDown(): void {
        this.confiscateBet();
        this.myBet *= 2;
    }

    /**
     * Gives the specified playing card to this player.
     * @param card The card to give to the player.
     */
    public giveCard(card: Card): void {
        this.cards.push(card);
        this.recalculateAll();
    }

    /**
     * Reveals the hole card. Only applicable for the dealer, not for normal players.
     * @returns The revealed hole card.
     * @throws An error if this player is not the dealer or if the hole card is already revealed.
     */
    public revealHoleCard(): Card {
        if (!this.isDealer) {
            throw new Error("Only the dealer can reveal a hole card.");
        }
        const holeCard = this.cards.find((card) => !card.faceUp);

        if (!holeCard) {
            throw new Error("Dealer does not have a hole card to reveal.");
        }
        holeCard.faceUp = true;
        this.recalculateAll();
        return holeCard;
    }

    /**
     * Confiscates the bet from the player. Assumed to be done sometime
     * before the start of the game of blackjack.
     */
    public confiscateBet(): void {
        if (!this.isDealer && this.updateScoreFunction) {
            this.updateScoreFunction(-this.myBet, Player.BET_CONFISCATION_REASON);
        }
    }

    /**
     * Rewards the player, using the supplied multiplier for their bet.
     * @param multiplier The multiplier to use.
     * @param reason The reason for the reward.
     * @returns The amount with which the player was rewarded.
     */
    public rewardPlayer(multiplier: number, reason: string): number {
        let reward = 0;
        if (!this.isDealer && this.updateScoreFunction) {
            reward = Math.floor(this.myBet * multiplier);
            this.updateScoreFunction(reward, reason);
        }
        return reward;
    }

    private recalculateAll(): void {
        const faceUpCards = this.cards.filter((card) => card.faceUp);
        const handValues = this.calculatePossibleHandValues(faceUpCards);
        this.recalculateIsBusted(handValues);
        this.recalculateNonBustedHandValues(handValues);
        this.recalculateHasReachedDealerMinimum(handValues);
        this.recalculateHasBlackjack(faceUpCards);
    }

    private calculatePossibleHandValues(faceUpCards: Card[]): number[] {
        let sums = [0];
        for (const card of faceUpCards) {
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

    private recalculateHasBlackjack(faceUpCards: Card[]): void {
        if (this.hasBlackjack(faceUpCards, this.nonBustedHandValues)) {
            this.myHandState = HandState.Blackjack;
        }
    }

    private hasBlackjack(cardsToCheck: Card[], handValues: number[]): boolean {
        return cardsToCheck.length === 2 && handValues.findIndex((v) => v === Player.MAX_HAND_VALUE) !== -1  &&
            (cardsToCheck[0].rank === Rank.Ace || cardsToCheck[1].rank === Rank.Ace)
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
