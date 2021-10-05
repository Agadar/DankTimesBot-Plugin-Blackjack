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
  private static readonly SURRENDER_CMD = `surrender`;
  private static readonly STATISTICS_CMD = `bjstats`;

  private static readonly ALL_IN_TEXTS = ["all", "allin", "all-in", "all in"];

  private readonly deckFactory = new DeckFactory();
  private readonly pluginTexts = new PluginTexts(Plugin.HIT_CMD, Plugin.STAND_CMD, Plugin.SURRENDER_CMD);
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
    const statisticsCmd = new BotCommand([Plugin.STATISTICS_CMD], "", this.statistics.bind(this), false);
    return [infoCmd, betCmd, standCmd, hitCmd, surrenderCmd, statisticsCmd];
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onCardsDealt(source: ChatGameManager, dealer: Player, startingPlayer: Player): void {
    const dealerLine = this.pluginTexts.getCardsDealtPlayerTextLine(dealer);
    const playerLines = source.players.map((player) => this.pluginTexts.getCardsDealtPlayerTextLine(player)).join("\n");
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(startingPlayer, true);
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
    const playerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(nextPlayer, true);
    const message = `${timedOutPlayer.formattedName} took too long to decide.\n\n${playerTurnMsg}`;
    this.sendMessage(source.chatId, message);
  }

  private blackjackInfo(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string {
    return "♣️♥ It's basic Blackjack ♠️️♦️\n\n"
      + `/${Plugin.BET_CMD} to start or join a game with a specified bet\n`
      + `/${Plugin.STAND_CMD} to take no more cards (when it's your turn)\n`
      + `/${Plugin.HIT_CMD} to take another card (when it's your turn)\n`
      + `/${Plugin.SURRENDER_CMD} to surrender (when it's your turn)\n`
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

  private stand(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const nextPlayer = gameManager.stand(user.id);
      return this.pluginTexts.getNextPlayerTurnMessage(nextPlayer, true);

    } catch (ex) {
      console.error(ex);
      return null;
    }
  }

  private surrender(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const surrenderResult = gameManager.surrender(user.id);

      if (surrenderResult.errorMsg) {
        return `⚠️ ${surrenderResult.errorMsg}`;
      }
      return this.pluginTexts.getNextPlayerTurnMessage(surrenderResult.nextPlayer, true);

    } catch (ex) {
      console.error(ex);
      return null;
    }
  }

  private hit(chat: Chat, user: User, msg: TelegramBot.Message, match: string): string | null {
    const gameManager = this.getOrCreateGameManager(chat);
    try {
      const info = gameManager.hit(user.id);
      let reply = `The dealer deals ${info.currentPlayer.formattedName} ${info.card.toString()}.`;
      reply += this.pluginTexts.handValuesAsString(info.currentPlayer);

      if (info.currentPlayer.handState === HandState.Busted) {
        const nextPlayerTurnMsg = this.pluginTexts.getNextPlayerTurnMessage(info.nextPlayer, true);
        reply += `\n\n${nextPlayerTurnMsg}`;
      } else {
        reply += this.pluginTexts.getPlayerTurnOptionsText(false);
      }
      return reply;

    } catch (ex) {
      console.error(ex);
      return null;
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
