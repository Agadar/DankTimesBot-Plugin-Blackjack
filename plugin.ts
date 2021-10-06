import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../src/bot-commands/bot-command";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";
import { Card } from "./card/card";
import { ChatGameManager } from "./chat-game-manager/chat-game-manager";
import { DeckFactory } from "./deck/deckFactory";
import { IBlackjackGameListener } from "./game/blackjack-game-listener";
import { GameConclusion } from "./game/game-conclusion";
import { HandState } from "./player/hand-state";
import { Player } from "./player/player";
import { PluginTexts } from "./util/plugin-texts";

export class Plugin extends AbstractPlugin implements IBlackjackGameListener<ChatGameManager> {

  private static readonly INFO_CMD = "blackjack";
  private static readonly BET_CMD = `bjbet`;
  private static readonly STAND_CMD = `bjstand`;
  private static readonly HIT_CMD = `bjhit`;
  private static readonly SURRENDER_CMD = `bjsurrender`;
  private static readonly DOUBLE_DOWN_CMD = `bjdoubledown`;
  private static readonly STATISTICS_CMD = `bjstats`;

  private static readonly ALL_IN_TEXTS = ["all", "allin", "all-in", "all in"];

  private readonly deckFactory = new DeckFactory();
  private readonly pluginTexts = new PluginTexts(Plugin.HIT_CMD, Plugin.STAND_CMD, Plugin.SURRENDER_CMD, Plugin.DOUBLE_DOWN_CMD);
  private readonly gameManagers = new Map<number, ChatGameManager>();

  constructor() {
    super("Blackjack", "1.1.0-alpha");
  }

  /**
   * @override
   */
  public getPluginSpecificCommands(): BotCommand[] {
    const infoCmd = new BotCommand([Plugin.INFO_CMD], "prints info about the Blackjack plugin",
      this.blackjackInfo.bind(this));
    const betCmd = new BotCommand([Plugin.BET_CMD], "", this.bet.bind(this), false);
    const standCmd = new BotCommand([Plugin.STAND_CMD], "", this.stand.bind(this), false);
    const hitCmd = new BotCommand([Plugin.HIT_CMD], "", this.hit.bind(this), false);
    const surrenderCmd = new BotCommand([Plugin.SURRENDER_CMD], "", this.surrender.bind(this), false);
    const doubleDownCmd = new BotCommand([Plugin.DOUBLE_DOWN_CMD], "", this.doubleDown.bind(this), false);
    const statisticsCmd = new BotCommand([Plugin.STATISTICS_CMD], "", this.statistics.bind(this), false);
    return [infoCmd, betCmd, standCmd, hitCmd, surrenderCmd, doubleDownCmd, statisticsCmd];
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onCardsDealt(source: ChatGameManager, dealer: Player, startingPlayer: Player): void {
    const dealerLine = this.pluginTexts.getCardsDealtPlayerTextLine(dealer);
    const playerLines = source.players.map((player) => this.pluginTexts.getCardsDealtPlayerTextLine(player)).join("\n");
    const user = this.getChat(source.chatId).getOrCreateUser(startingPlayer.identifier);
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(startingPlayer, true, user.score >= startingPlayer.bet);
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
    const user = this.getChat(source.chatId).getOrCreateUser(nextPlayer.identifier);
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(nextPlayer, true, user.score >= nextPlayer.bet);
    const message = `${timedOutPlayer.formattedName} took too long to decide.\n\n${playerTurnMsg}`;
    this.sendMessage(source.chatId, message);
  }

  private blackjackInfo(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string {
    return "♣️♥ It's basic Blackjack ♠️️♦️\n\n"
      + `/${Plugin.BET_CMD} to start or join a game with a specified bet\n`
      + `/${Plugin.STAND_CMD} to take no more cards (when it's your turn)\n`
      + `/${Plugin.HIT_CMD} to take another card (when it's your turn)\n`
      + `/${Plugin.SURRENDER_CMD} to surrender (when it's your first turn)\n`
      + `/${Plugin.DOUBLE_DOWN_CMD} to double down (when it's your first turn)\n`
      + `/${Plugin.STATISTICS_CMD} to see some statistics of this chat`;
  }

  private bet(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string {
    if (!match) {
      return `⚠️ Not enough arguments! Format: /${Plugin.BET_CMD} [value]`;
    }
    let bet = Number(match);

    if (isNaN(bet)) {
      if (Plugin.ALL_IN_TEXTS.includes(match)) {
        bet = user.score;
      } else {
        return "⚠️ Your bet has to be a numeric value, smartass.";
      }
    }
    const gameManager = this.getOrCreateGameManager(chat);

    try {
      if (gameManager.canStartNewGame) {
        const startNewGameResult = gameManager.startNewGame(user, bet);

        if (typeof(startNewGameResult) === "string") {
          return `⚠️ ${startNewGameResult}`;
        }
        return `📢 @${user.name} is starting a game of Blackjack, starting in ${startNewGameResult} seconds...` +
          `\n\nMake a /${Plugin.BET_CMD} to join in.`;
      } else {
        const joinGameResult = gameManager.joinGame(user, bet);

        if (joinGameResult) {
          return `⚠️ ${joinGameResult}`;
        }
        return `@${user.name} has joined the game of Blackjack!`;
      }
    } catch (ex) {
      console.error(ex);
      return `⚠️ ${ex.message}`;
    }
  }

  private stand(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const nextPlayer = gameManager.stand(user.id);

      if (nextPlayer) {
        const nextUser = chat.getOrCreateUser(nextPlayer.identifier);
        return this.pluginTexts.getNextPlayerTurnMessage(nextPlayer, true, nextUser.score >= nextPlayer.bet);
      }
    } catch (ex) {
      console.error(ex);
      return `⚠️ ${ex.message}`;
    }
  }

  private surrender(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const surrenderResult = gameManager.surrender(user.id);

      if (typeof(surrenderResult) === "string") {
        return `⚠️ ${surrenderResult}`;
      }
      if (surrenderResult) {
        const nextUser = chat.getOrCreateUser(surrenderResult.identifier);
        return this.pluginTexts.getNextPlayerTurnMessage(surrenderResult, true, nextUser.score >= surrenderResult.bet);
      }
    } catch (ex) {
      console.error(ex);
      return `⚠️ ${ex.message}`;
    }
  }

  private hit(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const info = gameManager.hit(user.id);

      if (!info) {
        return;
      }
      let reply = `The dealer deals ${info.currentPlayer.formattedName} ${info.card.toString()}.`;
      reply += this.pluginTexts.handValuesAsString(info.currentPlayer);

      if (info.currentPlayer.handState === HandState.Busted) {
        const nextUser = chat.getOrCreateUser(info.nextPlayer.identifier);
        const nextPlayerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(
          info.nextPlayer, true, nextUser.score >= info.nextPlayer.bet);
        reply += `\n\n${nextPlayerTurnMsg}`;
      } else {
        reply += this.pluginTexts.getPlayerTurnOptionsText(false, false);
      }
      return reply;

    } catch (ex) {
      console.error(ex);
      return `⚠️ ${ex.message}`;
    }
  }

  private doubleDown(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const info = gameManager.doubleDown(user);

      if (typeof(info) === 'string') {
        return `⚠️ ${info}`;
      }
      if (!info) {
        return;
      }
      let reply = `The dealer deals ${info.currentPlayer.formattedName} ${info.card.toString()}.`;
      reply += this.pluginTexts.handValuesAsString(info.currentPlayer);
      const nextUser = chat.getOrCreateUser(info.nextPlayer.identifier);
      const nextPlayerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(
        info.nextPlayer, true, nextUser.score >= info.nextPlayer.bet);
      reply += `\n\n${nextPlayerTurnMsg}`;
      return reply;

    } catch (ex) {
      console.error(ex);
      return `⚠️ ${ex.message}`;
    }
  }

  private statistics(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string {
    const gameManager = this.getOrCreateGameManager(chat);
    return gameManager.formattedStatisticsText;
  }

  private getOrCreateGameManager(chat: Chat): ChatGameManager {
    let manager = this.gameManagers.get(chat.id);
    if (!manager) {
      manager = new ChatGameManager(this.deckFactory, chat, this.name);
      this.gameManagers.set(chat.id, manager);
      manager.subscribe(this);
    }
    return manager;
  }
}
