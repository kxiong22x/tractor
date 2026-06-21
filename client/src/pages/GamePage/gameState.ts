import type { Player } from '../../types';
import type { LogEntry } from './components/GameLog';

export interface GamePlayer extends Player {
  hand: string[];
}

export interface RoundResult {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
  gameOver: boolean;
}

export interface GameState {
  gameId: string;
  players: GamePlayer[];
  phase: 'declaration' | 'kitty' | 'trick';
  stagedCards: string[];
  trumpNumber: string;
  trumpSuit: string;
  trumpIsPair: boolean;
  trumpDeclarerId: string | null;
  roundKingId: string | null;
  kittyPickedUp: boolean;
  kittyCards: string[];
  handCards: string[];
  handInitialized: boolean;
  currentTurn: string | null;
  trickPlays: Record<string, string[]>;
  trickComplete: { winnerId: string; winnerName: string } | null;
  trickPlayerOrder: string[];
  playerPoints: Record<string, number>;
  trickCommitted: string[];
  log: LogEntry[];
  canReinforce: boolean;
  reinforceCard: string | null;
  reinforceCloseAtCardCount: number | null;
  declarationHistory: Record<string, { suit: string; count: number }>;
}

export type GameAction =
  | { type: 'TRUMP_DECLARED'; trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string }
  | { type: 'REINFORCE_AVAILABLE'; card: string; matchingCards: string[]; closeAtCardCount: number }
  | { type: 'CLEAR_REINFORCE' }
  | { type: 'KITTY_PICKED_UP'; kittyCards?: string[] }
  | { type: 'KITTY_FINISHED' }
  | { type: 'TRICK_STARTED'; leaderId: string; trickNum: number; playerOrder: string[] }
  | { type: 'CARDS_PLAYED'; playerId: string; cards: string[]; currentPlayerId: string | undefined }
  | { type: 'TURN_ADVANCED'; currentTurn: string }
  | { type: 'TRICK_COMPLETE'; winnerId: string; points?: Record<string, number> }
  | { type: 'PLAY_ERROR' }
  | { type: 'ROUND_OVER'; rankChanges: Record<string, { oldRank: number; newRank: number }> }
  | { type: 'GAME_STARTED'; gameId: string; players: GamePlayer[]; trumpNumber: string; trumpSuit: string; roundKingId: string | null }
  | { type: 'STAGE_CARD'; card: string }
  | { type: 'UNSTAGE_CARD'; card: string }
  | { type: 'CLEAR_STAGED' }
  | { type: 'KITTY_TO_HAND'; card: string }
  | { type: 'HAND_TO_KITTY'; card: string }
  | { type: 'FINISH_KITTY' }
  | { type: 'PICK_UP_KITTY' }
  | { type: 'INIT_HAND'; hand: string[] }
  | { type: 'PLAY_UNDONE'; playerId: string; cards: string[]; currentPlayerId: string | undefined; trickUndone: boolean; points?: Record<string, number> }
  | { type: 'UPDATE_PLAYERS'; players: GamePlayer[] }
  | { type: 'RESTORE_TRICK_STATE'; trickPlays: Record<string, string[]>; trickPlayerOrder: string[]; currentTurn: string; trickCommitted: string[]; hand: string[]; playerPoints: Record<string, number> }
  ;

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TRUMP_DECLARED': {
      const declarerName = state.players.find(p => p.playerId === action.declarerId)?.displayName ?? action.declarerId;
      const isJoker = action.trumpSuit === 'BJ' || action.trumpSuit === 'SJ';
      const baseCard = isJoker ? `J${action.trumpSuit[0]}` : `${action.trumpSuit}${state.trumpNumber}`;
      const declaredCards = (isJoker || action.isPair) ? [baseCard, baseCard] : [baseCard];
      return {
        ...state,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: action.declarerId,
        trumpIsPair: action.isPair,
        roundKingId: action.roundKingId,
        stagedCards: [],
        canReinforce: false,
        reinforceCard: null,
        reinforceCloseAtCardCount: null,
        declarationHistory: {
          ...state.declarationHistory,
          [action.declarerId]: { suit: action.trumpSuit, count: action.isPair ? 2 : 1 },
        },
        log: [...state.log, { type: 'declare' as const, playerName: declarerName, cards: declaredCards }],
      };
    }

    case 'REINFORCE_AVAILABLE':
      return {
        ...state,
        canReinforce: true,
        reinforceCard: action.card,
        stagedCards: action.matchingCards,
        reinforceCloseAtCardCount: action.closeAtCardCount,
      };

    case 'CLEAR_REINFORCE':
      return { ...state, canReinforce: false, reinforceCard: null, reinforceCloseAtCardCount: null };

    case 'KITTY_PICKED_UP':
      return {
        ...state,
        kittyPickedUp: true,
        stagedCards: [],
        canReinforce: false,
        reinforceCard: null,
        reinforceCloseAtCardCount: null,
        declarationHistory: {},
        ...(action.kittyCards
          ? { kittyCards: action.kittyCards, phase: 'kitty' as const }
          : {}),
      };

    case 'KITTY_FINISHED':
      return { ...state, phase: 'declaration' as const, kittyCards: [] };

    case 'TRICK_STARTED':
      return {
        ...state,
        phase: 'trick' as const,
        currentTurn: action.leaderId,
        trickPlays: {},
        trickCommitted: [],
        trickComplete: null,
        trickPlayerOrder: action.playerOrder,
        stagedCards: [],
        log: [...state.log, { type: 'trick', trickNum: action.trickNum }],
      };

    case 'CARDS_PLAYED': {
      const newPlays = { ...state.trickPlays, [action.playerId]: action.cards };
      const newHand = action.playerId === action.currentPlayerId
        ? state.handCards.filter(c => !action.cards.includes(c))
        : state.handCards;
      const playerName = state.players.find(p => p.playerId === action.playerId)?.displayName ?? action.playerId;
      const nowCommitted = [...new Set([...state.trickCommitted, ...Object.keys(state.trickPlays)])];
      return {
        ...state,
        trickPlays: newPlays,
        trickCommitted: nowCommitted,
        handCards: newHand,
        log: [...state.log, { type: 'play', playerName, cards: action.cards }],
      };
    }

    case 'TURN_ADVANCED':
      return { ...state, currentTurn: action.currentTurn };

    case 'PLAY_UNDONE': {
      const newPlays = { ...state.trickPlays };
      delete newPlays[action.playerId];
      const newHand = action.playerId === action.currentPlayerId
        ? [...state.handCards, ...action.cards]
        : state.handCards;
      const undoerName = state.players.find(p => p.playerId === action.playerId)?.displayName ?? action.playerId;
      return {
        ...state,
        trickPlays: newPlays,
        handCards: newHand,
        stagedCards: [],
        currentTurn: action.playerId,
        trickComplete: action.trickUndone ? null : state.trickComplete,
        ...(action.points ? { playerPoints: action.points } : {}),
        log: [...state.log, { type: 'undo' as const, playerName: undoerName }],
      };
    }

    case 'TRICK_COMPLETE': {
      const winner = state.players.find(p => p.playerId === action.winnerId);
      const winnerName = winner?.displayName ?? 'Unknown';
      return {
        ...state,
        trickComplete: { winnerId: action.winnerId, winnerName },
        currentTurn: null,
        ...(action.points ? { playerPoints: action.points } : {}),
        log: [...state.log, { type: 'winner', playerName: winnerName }],
      };
    }

    case 'PLAY_ERROR':
      return { ...state, stagedCards: [] };

    case 'ROUND_OVER':
      return {
        ...state,
        phase: 'declaration' as const,
        currentTurn: null,
        trickPlays: {},
        players: state.players.map(p =>
          action.rankChanges[p.playerId]
            ? { ...p, rank: action.rankChanges[p.playerId].newRank }
            : p
        ),
      };

    case 'GAME_STARTED':
      return {
        ...state,
        gameId: action.gameId,
        players: action.players,
        trumpNumber: action.trumpNumber,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: null,
        trumpIsPair: false,
        roundKingId: action.roundKingId,
        kittyPickedUp: false,
        stagedCards: [],
        kittyCards: [],
        phase: 'declaration' as const,
        handCards: [],
        handInitialized: false,
        currentTurn: null,
        trickPlays: {},
        trickCommitted: [],
        trickComplete: null,
        trickPlayerOrder: [],
        playerPoints: {},
        canReinforce: false,
        reinforceCard: null,
        reinforceCloseAtCardCount: null,
        log: [],
      };

    case 'STAGE_CARD':
      return { ...state, stagedCards: [...state.stagedCards, action.card] };

    case 'UNSTAGE_CARD':
      return { ...state, stagedCards: state.stagedCards.filter(c => c !== action.card) };

    case 'CLEAR_STAGED':
      return { ...state, stagedCards: [] };

    case 'KITTY_TO_HAND':
      return {
        ...state,
        kittyCards: state.kittyCards.filter(c => c !== action.card),
        handCards: [...state.handCards, action.card],
      };

    case 'HAND_TO_KITTY':
      if (state.kittyCards.length >= (state.players.length === 6 ? 6 : 8)) return state;
      return {
        ...state,
        handCards: state.handCards.filter(c => c !== action.card),
        kittyCards: [...state.kittyCards, action.card],
      };

    case 'FINISH_KITTY':
      return { ...state, phase: 'declaration' as const, kittyCards: [] };

    case 'PICK_UP_KITTY':
      return { ...state, kittyPickedUp: true };

    case 'INIT_HAND':
      return { ...state, handCards: action.hand, handInitialized: true };

    case 'UPDATE_PLAYERS':
      return { ...state, players: action.players };

    case 'RESTORE_TRICK_STATE':
      return {
        ...state,
        phase: 'trick' as const,
        trickPlays: action.trickPlays,
        trickPlayerOrder: action.trickPlayerOrder,
        currentTurn: action.currentTurn,
        trickCommitted: action.trickCommitted,
        handCards: action.hand,
        handInitialized: true,
        playerPoints: action.playerPoints,
      };

    default:
      return state;
  }
}

export function buildInitialState(locationState: any): GameState {
  const players: GamePlayer[] = locationState?.players ?? [];
  return {
    players,
    gameId: locationState?.gameId ?? '',
    trumpNumber: locationState?.trumpNumber ?? '2',
    trumpSuit: locationState?.trumpSuit ?? 'NA',
    trumpDeclarerId: locationState?.trumpDeclarerId ?? null,
    trumpIsPair: locationState?.trumpIsPair ?? false,
    roundKingId: locationState?.roundKingId ?? null,
    kittyPickedUp: false,
    stagedCards: [],
    kittyCards: [],
    phase: 'declaration' as const,
    handCards: [],
    handInitialized: false,
    currentTurn: null,
    trickPlays: {},
    trickCommitted: [],
    trickComplete: null,
    trickPlayerOrder: [],
    playerPoints: {},
    canReinforce: false,
    reinforceCard: null,
    reinforceCloseAtCardCount: null,
    declarationHistory: {
      ...(locationState?.trumpDeclarerId && locationState?.trumpSuit !== 'NA'
        ? { [locationState.trumpDeclarerId]: { suit: locationState.trumpSuit, count: locationState.trumpIsPair ? 2 : 1 } }
        : {}),
      ...(locationState?.singleDeclarer
        ? { [locationState.singleDeclarer.playerId]: { suit: locationState.singleDeclarer.card[0], count: 1 } }
        : {}),
    },
    log: [],
  };
}
