import { BotCommand } from "../../src/bot-commands/bot-command";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";
import { Card } from "./card/card";
import { DeckFactory } from "./deck/deckFactory";
import { BlackjackGame } from "./game/blackjack-game";
import { IBlackjackGameListener } from "./game/blackjack-game-listener";
import { Player } from "./player/player";

export class Plugin extends AbstractPlugin implements IBlackjackGameListener {

  private static readonly INFO_CMD = "blackjack";
  private static readonly BET_CMD = "bet";
  private static readonly STAND_CMD = "stand";
  private static readonly HIT_CMD = "hit";

  private readonly deckFactory = new DeckFactory();
  private readonly games = new Map<number, BlackjackGame>();

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
  public onCardsDealt(game: BlackjackGame, startingPlayer: Player): void {

    const dealerLine = `The dealer is showing ${this.cardsAsString(game.dealerCards)}.`;
    const playerLines = game.players
      .map((player) => `@${player.user.name} is showing ${this.cardsAsString(player.cards)}.`)
      .join("\n");
    const playerTurnMsg = this.getNextPlayerTurnMessage(startingPlayer, game);
    const cardsInfo = `The game has begun!\n${dealerLine}\n${playerLines}\n\n${playerTurnMsg}`;
    this.sendMessage(game.chat.id, cardsInfo);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onDealerDrewCard(game: BlackjackGame, card: Card): void {
    const message = `The dealer drew ${card.toString()}.`;
    this.sendMessage(game.chat.id, message);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onGameEnded(game: BlackjackGame, winners: Player[], dealerBusted: boolean): void {
    let message;
    if (dealerBusted) {
      message = "The dealer went bust. The game has ended. ";
    } else {
      message = "The dealer stands. The game has ended. ";
    }
    message += this.getWinnerListText(winners);
    this.sendMessage(game.chat.id, message);
    this.games.delete(game.chat.id);
  }

  /**
   * @implements IBlackjackGameListener
   */
  public onPlayerTurnTimedOut(game: BlackjackGame, timedOutPlayer: Player, nextPlayer: Player) {
    const playerTurnMsg = this.getNextPlayerTurnMessage(nextPlayer, game);
    const message = `@${timedOutPlayer.user.name} took too long to decide.\n\n${playerTurnMsg}`;
    this.sendMessage(game.chat.id, message);
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
      return "⚠️ Not enough arguments! Format: /bet [value]";
    }

    const bet = Number(split[1]);
    if (isNaN(bet)) {
      return "⚠️ Your bet has to be a numeric value, smartass.";
    }

    let game: BlackjackGame;
    let reply: string;
    try {
      if (!this.games.has(chat.id)) {
        game = this.createGame(chat, user, bet);
        game.initializeGame();
        reply = `📢 @${user.name} started a game of Blackjack, waiting for more players...`;
      } else {
        game = this.games.get(chat.id);
        game.joinGame(user, bet);
        reply = `@${user.name} has joined the game of Blackjack!`;
      }
    } catch (ex) {
      reply = `⚠️ ${ex.message}`;
    }
    return reply;
  }

  private stand(chat: Chat, user: User, msg: any, match: string[]): string {
    if (!this.games.has(chat.id)) { return; }
    const game = this.games.get(chat.id);

    try {
      const nextPlayer = game.stand(user.id);
      return this.getNextPlayerTurnMessage(nextPlayer, game);
    } catch (ex) {
      // Silent ignore.
    }
  }

  private hit(chat: Chat, user: User, msg: any, match: string[]): string {
    if (!this.games.has(chat.id)) { return; }
    const game = this.games.get(chat.id);

    try {
      const info = game.hit(user.id);
      let reply = `The dealer deals you ${info.card.toString()}.`;

      if (info.busted) {
        const nextPlayerTurnMsg = this.getNextPlayerTurnMessage(info.nextPlayer, game);
        reply += ` You busted.\n\n${nextPlayerTurnMsg}`;
      }
      return reply;

    } catch (ex) {
      // Silent ignore.
    }
  }

  private createGame(chat: Chat, user: User, bet: number): BlackjackGame {
    const deck = this.deckFactory.createDeck();
    const game = new BlackjackGame(deck, chat, user, bet);
    this.games.set(chat.id, game);
    game.subscribe(this);
    return game;
  }

  private getNextPlayerTurnMessage(player: Player | null, game: BlackjackGame): string {
    let playerName: string;
    let playerCards: Card[];

    if (player == null) {
      playerName = "the dealer";
      playerCards = game.dealerCards;
    } else {
      playerName = `@${player.user.name}`;
      playerCards = player.cards;
    }

    const playerCardsText = this.cardsAsString(playerCards);
    return `❕ It's now ${playerName}'s turn. They are showing ${playerCardsText}.`;
  }

  private getWinnerListText(winners: Player[]): string {
    if (winners.length === 0) {
      return "No one beat the dealer 😞";
    }
    const winnersList = winners.map((winner) => `@${winner.user.name}`).join(", ");
    return `${winnersList} beat the dealer 🤑`;
  }

  private cardsAsString(cards: Card[]): string {
    return cards.map((card) => `${card.toString()}`).join(", ");
  }
}
