import { BotCommand } from "../../src/bot-commands/bot-command";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";
import { Card } from "./card/card";
import { ChatGameManager } from "./chat-game-manager/chat-game-manager";
import { DeckFactory } from "./deck/deckFactory";
import { IBlackjackGameListener } from "./game/blackjack-game-listener";
import { GameConclusion } from "./game/game-conclusion";
import { Player } from "./player/player";
import { PluginTexts } from "./util/plugin-texts";

export class Plugin extends AbstractPlugin implements IBlackjackGameListener<ChatGameManager> {

  private static readonly INFO_CMD = "blackjack";
  private static readonly BET_CMD = `${Plugin.INFO_CMD}_bet`;
  private static readonly STAND_CMD = `${Plugin.INFO_CMD}_stand`;
  private static readonly HIT_CMD = `${Plugin.INFO_CMD}_hit`;

  private static readonly ALL_IN_TEXT = "all";

  private readonly deckFactory = new DeckFactory();
  private readonly pluginTexts = new PluginTexts(Plugin.HIT_CMD, Plugin.STAND_CMD);
  private readonly gameManagers = new Map<number, ChatGameManager>();

  constructor() {
    super("Blackjack", "1.0.0");
  }

  /**
   * @override
   */
  public getPluginSpecificCommands(): BotCommand[] {
    const infoCmd = new BotCommand(Plugin.INFO_CMD, "prints info about the Blackjack plugin",
      this.blackjackInfo.bind(this));
    const betCmd = new BotCommand(Plugin.BET_CMD, "", this.bet.bind(this), false);
    const standCmd = new BotCommand(Plugin.STAND_CMD, "", this.stand.bind(this), false);
    const hitCmd = new BotCommand(Plugin.HIT_CMD, "", this.hit.bind(this), false);
    return [infoCmd, betCmd, standCmd, hitCmd];
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onCardsDealt(source: ChatGameManager, dealer: Player, startingPlayer: Player): void {
    const dealerLine = this.pluginTexts.getCardsDealtPlayerTextLine(dealer);
    const playerLines = source.players.map((player) => this.pluginTexts.getCardsDealtPlayerTextLine(player)).join("\n");
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(startingPlayer);
    const cardsInfo = `The game has begun!\n\n${dealerLine}\n${playerLines}\n\n${playerTurnMsg}`;
    this.sendMessage(source.chatId, cardsInfo);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onDealerDrewCard(source: ChatGameManager, dealer: Player, card: Card): void {
    let message = `The dealer drew ${card.toString()}.`;
    message += this.pluginTexts.handValuesAsString(dealer);
    this.sendMessage(source.chatId, message);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onGameEnded(source: ChatGameManager, conclusion: GameConclusion): void {
    let message;
    if (conclusion.dealerBusted) {
      message = "The dealer went bust. The game has ended.\n\n";
    } else {
      message = "The dealer stands. The game has ended.\n\n";
    }
    message += this.pluginTexts.getGameConclusionText(conclusion);
    this.sendMessage(source.chatId, message);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onPlayerTurnTimedOut(source: ChatGameManager, timedOutPlayer: Player, nextPlayer: Player) {
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(nextPlayer);
    const message = `${timedOutPlayer.name} took too long to decide.\n\n${playerTurnMsg}`;
    this.sendMessage(source.chatId, message);
  }

  private blackjackInfo(chat: Chat, user: User, msg: any, match: string[]): string {
    return "♣️♥ It's basic Blackjack ♠️️♦️\n\n"
      + `/${Plugin.BET_CMD} to start or join a game with a specified bet\n`
      + `/${Plugin.STAND_CMD} to take no more cards (when it's your turn)\n`
      + `/${Plugin.HIT_CMD} to take another card (when it's your turn)`;
  }

  private bet(chat: Chat, user: User, msg: any, match: string[]): string {

    const split = msg.text.split(" ");
    if (split.length < 2) {
      return `⚠️ Not enough arguments! Format: /${Plugin.BET_CMD} [value]`;
    }

    let bet = Number(split[1]);
    if (isNaN(bet)) {
      if (split[1] === Plugin.ALL_IN_TEXT) {
        bet = user.score;
      } else {
        return "⚠️ Your bet has to be a numeric value, smartass.";
      }
    }

    const gameManager = this.getOrCreateGameManager(chat);
    let reply: string;

    try {
      if (gameManager.canStartNewGame) {
        const secondsUntilStart = gameManager.startNewGame(user, bet);
        reply = `📢 @${user.name} is starting a game of Blackjack, starting in ${secondsUntilStart} seconds...` +
          `\n\nMake a /${Plugin.BET_CMD} to join in.`;
      } else {
        gameManager.joinGame(user, bet);
        reply = `@${user.name} has joined the game of Blackjack!`;
      }
    } catch (ex) {
      reply = `⚠️ ${ex.message}`;
    }
    return reply;
  }

  private stand(chat: Chat, user: User, msg: any, match: string[]): string {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const nextPlayer = gameManager.stand(user.id);
      return this.pluginTexts.getNextPlayerTurnMessage(nextPlayer);
    } catch (ex) {
      // Silent ignore.
    }
  }

  private hit(chat: Chat, user: User, msg: any, match: string[]): string {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const info = gameManager.hit(user.id);
      let reply = `The dealer deals ${info.currentPlayer.name} ${info.card.toString()}.`;
      reply += this.pluginTexts.handValuesAsString(info.currentPlayer);

      if (info.currentPlayer.isBusted) {
        const nextPlayerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(info.nextPlayer);
        reply += `\n\n${nextPlayerTurnMsg}`;
      } else {
        reply += this.pluginTexts.getPlayerTurnOptionsText();
      }
      return reply;

    } catch (ex) {
      // Silent ignore.
    }
  }

  private getOrCreateGameManager(chat: Chat): ChatGameManager {
    let manager = this.gameManagers.get(chat.id);
    if (!manager) {
      manager = new ChatGameManager(this.deckFactory, chat);
      this.gameManagers.set(chat.id, manager);
      manager.subscribe(this);
    }
    return manager;
  }
}
