import { GameConclusion } from "../game/game-conclusion";
import { HandState } from "../player/hand-state";
import { Player } from "../player/player";

/**
 * Exposes functions for generating texts meant for sending to chats.
 */
export class PluginTexts {

    /**
     * Constructor.
     * @param hitCommand The text for the hit command.
     * @param standCommand The text for the stand command.
     * @param surrenderCommand The text for the surrender command.
     * @param doubleDownCommand The text for the double down command.
     */
    constructor(
        private readonly hitCommand: string,
        private readonly standCommand: string,
        private readonly surrenderCommand: string,
        private readonly doubleDownCommand: string) { }

    public getNextPlayerTurnMessage(player: Player, isFirstTurn: boolean, canDoubleDown: boolean): string {
        const playerCardsText = this.cardsAsString(player);
        let msg = `❕ ${player.formattedName} is up next. They are showing ${playerCardsText}`;
        if (!player.isDealer) {
            msg += this.getPlayerTurnOptionsText(isFirstTurn, canDoubleDown);
        }
        return msg;
    }

    public getGameConclusionText(conclusion: GameConclusion): string {
        if (conclusion.sameScoreAsDealerPlayers.length === 0 &&
            conclusion.higherScoreThanDealerPlayers.length === 0 &&
            conclusion.playersWithBlackjack.length === 0) {
            return "No one beat the dealer... 😞";
        }
        const blackjackList = this.getPlayerResultList(conclusion.playersWithBlackjack, "had blackjack! 🤑\n");
        const higherList = this.getPlayerResultList(conclusion.higherScoreThanDealerPlayers, "beat the dealer! 😃\n");
        const sameList = this.getPlayerResultList(conclusion.sameScoreAsDealerPlayers, "equaled the dealer! 🙂");
        return `${blackjackList}${higherList}${sameList}`;
    }

    public getCardsDealtPlayerTextLine(player: Player): string {
        let text: string;
        if (player.handState === HandState.Blackjack) {
            text = `${player.formattedName} has blackjack! They are showing`;
        } else {
            text = `${player.formattedName} is showing`;
        }
        return `${text} ${this.cardsAsString(player)}`;
    }

    public handValuesAsString(player: Player): string {
        if (player.handState !== HandState.Busted) {
            return `   (${player.nonBustedHandValues.map((value) => value.toString()).join(" or ")})`;
        }
        return ` ${player.formattedName} busted.`;
    }

    public getPlayerTurnOptionsText(isFirstTurn: boolean, canDoubleDown: boolean): string {
        if (!isFirstTurn) {
            return `\n\nDo you want to /${this.hitCommand}, or /${this.standCommand}?`;
        }
        if (canDoubleDown) {
            return `\n\nDo you want to /${this.hitCommand}, /${this.standCommand}, /${this.surrenderCommand}, or /${this.doubleDownCommand}?`;
        }
        return `\n\nDo you want to /${this.hitCommand}, /${this.standCommand}, or /${this.surrenderCommand}?`;
    }

    private cardsAsString(player: Player): string {
        let cardsString = `${player.cards.map((card) => card.toString()).join(" , ")}.`;
        cardsString += this.handValuesAsString(player);
        return cardsString;
    }

    private getPlayerResultList(players: Player[], result: string) {
        if (players.length === 0) { return ""; }
        const nonUniqueNames = players.map((player) => player.formattedName);
        const uniqueNames = Array.from(new Set(nonUniqueNames));
        return `${uniqueNames.join(", ")} ${result}`;
    }
}
