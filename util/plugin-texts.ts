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
     * @param splitCommand The text for the split command.
     */
    constructor(
        private readonly hitCommand: string,
        private readonly standCommand: string,
        private readonly surrenderCommand: string,
        private readonly doubleDownCommand: string,
        private readonly splitCommand: string) { }

    public getNextPlayerTurnMessage(player: Player, unfulfilledBlackjackPotential: boolean): string {
        let msg = "";

        if (unfulfilledBlackjackPotential) {
            msg += "The dealer does not have blackjack.\n\n";
        }
        msg += `❕ ${player.formattedName} is up next. They are showing ${player.formattedHand}`;

        if (!player.isDealer) {
            msg += this.getPlayerTurnOptionsText(player);
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
        return `- ${text} ${player.formattedHand}`;
    }

    public getPlayerTurnOptionsText(player: Player): string {
        const playerOptions = [this.hitCommand, this.standCommand];

        if (player.isFirstTurn) {
            playerOptions.push(this.surrenderCommand);

            if (player.canDoubleDown) {
                playerOptions.push(this.doubleDownCommand);
            }
            if (player.canSplit) {
                playerOptions.push(this.splitCommand);
            }
        }
        let text = `\n\nDo you want to /${playerOptions[0]}`;
        let i = 1;

        for (; i < playerOptions.length - 1; i++) {
            text += `, /${playerOptions[i]}`;
        }
        text += `, or /${playerOptions[i]}?`;
        return text;
    }

    private getPlayerResultList(players: Player[], result: string) {
        if (players.length === 0) { return ""; }
        const nonUniqueNames = players.map((player) => player.formattedName);
        const uniqueNames = Array.from(new Set(nonUniqueNames));
        return `${uniqueNames.join(", ")} ${result}`;
    }
}
