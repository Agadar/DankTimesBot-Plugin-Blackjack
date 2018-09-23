/**
 * Holds Blackjack statistics for a single chat.
 */
export class ChatStatistics {

    private myDealerBalance = 0;

    /**
     * The current dealer balance (total points confiscated and paid out by the dealer).
     */
    public get dealerBalance(): number {
        return this.myDealerBalance;
    }

    /**
     * A formatted text representation of these statistics.
     */
    public get formattedText(): string {
        return "♣️♥ Blackjack statistics ♠️️♦️\n\n" +
            `Dealer balance: ${this.myDealerBalance}`;
    }

    /**
     * Updates the dealer balance with the supplied points.
     * @param points The points to alter the dealer balance with.
     */
    public updateDealerBalance(points: number) {
        this.myDealerBalance += points;
    }
}
