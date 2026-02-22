export type LogEntry =
  | { type: 'trick'; trickNum: number }
  | { type: 'play'; playerName: string; cards: string[] }
  | { type: 'winner'; playerName: string };
