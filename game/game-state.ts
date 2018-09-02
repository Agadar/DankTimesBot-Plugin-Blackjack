/**
 * The current gamestate.
 */
export const enum GameState {
    INITIALIZING,
    AWAITING_PLAYERS,
    DEALING_CARDS,
    PLAYER_TURNS,
    DEALER_TURN,
    ENDED,
}
