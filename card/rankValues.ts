import { Rank } from "./rank";

const FACE_CARD_VALUE = 10;

/**
 * The values of the different card ranks as per Blackjack rules.
 */
export const RANK_VALUES = new Map<Rank, number[]>([
    [Rank.Ace, [1, 11]],
    [Rank.King, [FACE_CARD_VALUE]],
    [Rank.Queen, [FACE_CARD_VALUE]],
    [Rank.Jack, [FACE_CARD_VALUE]],
    [Rank.Ten, [FACE_CARD_VALUE]],
    [Rank.Nine, [9]],
    [Rank.Eight, [8]],
    [Rank.Seven, [7]],
    [Rank.Six, [6]],
    [Rank.Five, [5]],
    [Rank.Four, [4]],
    [Rank.Three, [3]],
    [Rank.Two, [2]],
]);
