// Shared socket event name constants used by both client and server.
// Import from this file instead of using raw strings to prevent typos.

export const EVENTS = {
  // ── Client → Server ─────────────────────────────────────────────────
  JOIN_ROOM: 'join-room',
  SET_STARTING_RANK: 'set-starting-rank',
  START_GAME: 'start-game',
  START_NEXT_ROUND: 'start-next-round',
  DECLARE_TRUMP: 'declare-trump',
  REINFORCE_TRUMP: 'reinforce-trump',
  PICK_UP_KITTY: 'pick-up-kitty',
  FINISH_KITTY: 'finish-kitty',
  PLAY_CARDS: 'play-cards',
  UNDO_PLAY: 'undo-play',

  // ── Server → Client ─────────────────────────────────────────────────
  ROOM_ERROR: 'room-error',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  PLAYER_DISCONNECTED: 'player-disconnected',
  PLAYER_RECONNECTED: 'player-reconnected',
  REJOIN_SUCCESS: 'rejoin-success',
  CAN_REINFORCE: 'can-reinforce',
  GAME_STARTED: 'game-started',
  DEAL_TICK: 'deal-tick',
  DEALING_COMPLETE: 'dealing-complete',
  TRUMP_DECLARED: 'trump-declared',
  KITTY_PICKED_UP: 'kitty-picked-up',
  KITTY_FINISHED: 'kitty-finished',
  TRICK_STARTED: 'trick-started',
  CARDS_PLAYED: 'cards-played',
  TURN_ADVANCED: 'turn-advanced',
  TRICK_COMPLETE: 'trick-complete',
  PLAY_UNDONE: 'play-undone',
  PLAY_ERROR: 'play-error',
  THROW_FAILED: 'throw-failed',
  ROUND_OVER: 'round-over',
  GAME_ABANDONED: 'game-abandoned',
} as const;
