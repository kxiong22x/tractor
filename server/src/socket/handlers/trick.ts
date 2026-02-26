import { Server, Socket } from 'socket.io';
import { getPlayerBySocketId, getPlayerById, addPointsToPlayer, getRoundPoints, getPlayersInRoom, updatePlayerRank, updatePlayerHand } from '../../player.queries';
import { getGame } from '../../game.queries';
import { parseHand, cardPoints } from '../../deck';
import { classifyPlay, validateFollow, validateThrow, determineTrickWinner } from '../../trick';
import { PlayCardsPayload, TrickState, TrumpContext } from '../../types';
import { MAX_PLAYERS } from '../../constants';
import { trickStates, pendingNextTrick, pendingNextKing } from '../state';
import { isRoomFrozen } from '../freeze';

function calculateTrickPoints(plays: Map<string, string[]>): number {
  let points = 0;
  for (const cards of plays.values()) {
    for (const card of cards) {
      points += cardPoints(card);
    }
  }
  return points;
}

export function startTrick(
  io: Server,
  gameId: string,
  roomId: string,
  leaderId: string,
  trickNum: number,
  playerOrder: string[],
) {
  const state: TrickState = {
    gameId,
    roomId,
    trickNum,
    leaderId,
    currentTurn: leaderId,
    playerOrder,
    plays: new Map(),
    committed: new Set(),
    leaderShape: null,
  };
  trickStates.set(gameId, state);

  io.to(roomId).emit('trick-started', {
    leaderId,
    trickNum,
    playerOrder,
  });
}

export function registerTrickHandlers(io: Server, socket: Socket) {
  socket.on('play-cards', (payload: PlayCardsPayload) => {
    const { gameId, cards } = payload;

    const trickState = trickStates.get(gameId);
    if (!trickState) {
      socket.emit('play-error', { message: 'No active trick' });
      return;
    }

    if (isRoomFrozen(trickState.roomId)) {
      socket.emit('game-paused', { reason: 'A player is disconnected' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player) {
      socket.emit('play-error', { message: 'Player not found' });
      return;
    }

    if (player.player_id !== trickState.currentTurn) {
      socket.emit('play-error', { message: 'Not your turn' });
      return;
    }

    const dbPlayer = getPlayerById(player.player_id);
    if (!dbPlayer) {
      socket.emit('play-error', { message: 'Player not found in DB' });
      return;
    }
    const hand = parseHand(dbPlayer);

    for (const card of cards) {
      if (!hand.includes(card)) {
        socket.emit('play-error', { message: `Card ${card} not in your hand` });
        return;
      }
    }

    const game = getGame(gameId);
    if (!game) {
      socket.emit('play-error', { message: 'Game not found' });
      return;
    }

    const ctx: TrumpContext = {
      trumpSuit: game.trump_suit,
      trumpNumber: game.trump_number,
    };

    const isLeader = player.player_id === trickState.leaderId;

    if (isLeader) {
      const shape = classifyPlay(cards, ctx);
      if (shape.type === 'invalid') {
        socket.emit('play-error', { message: 'Invalid card combination' });
        return;
      }

      if (shape.type === 'throw' && shape.components) {
        const opponentHands: string[][] = [];
        for (const pid of trickState.playerOrder) {
          if (pid === player.player_id) continue;
          const opponent = getPlayerById(pid);
          if (opponent) {
            opponentHands.push(parseHand(opponent));
          }
        }

        const throwResult = validateThrow(shape.components, cards, opponentHands, ctx);
        if (!throwResult.valid) {
          const failedCards = throwResult.failedComponentCards!;
          const failedShape = classifyPlay(failedCards, ctx);

          const newHand = hand.filter(c => !failedCards.includes(c));
          updatePlayerHand(player.player_id, newHand);

          trickState.leaderShape = failedShape as TrickState['leaderShape'];
          for (const pid of trickState.plays.keys()) {
            trickState.committed.add(pid);
          }
          trickState.plays.set(player.player_id, failedCards);

          const returnedCards = cards.filter(c => !failedCards.includes(c));
          socket.emit('throw-failed', {
            message: 'Throw blocked! An opponent can beat a component.',
            failedCards,
            returnedCards,
          });

          io.to(trickState.roomId).emit('cards-played', {
            playerId: player.player_id,
            cards: failedCards,
          });

          const currentIdx = trickState.playerOrder.indexOf(player.player_id);
          const nextIdx = (currentIdx + 1) % trickState.playerOrder.length;
          trickState.currentTurn = trickState.playerOrder[nextIdx];

          io.to(trickState.roomId).emit('turn-advanced', {
            currentTurn: trickState.currentTurn,
          });
          return;
        }
      }

      trickState.leaderShape = shape as TrickState['leaderShape'];
    } else {
      const leaderCards = trickState.plays.get(trickState.leaderId);
      if (!leaderCards) {
        socket.emit('play-error', { message: 'Leader has not played yet' });
        return;
      }

      if (cards.length !== leaderCards.length) {
        socket.emit('play-error', { message: `Must play exactly ${leaderCards.length} cards` });
        return;
      }

      const result = validateFollow(trickState.leaderShape!, cards, hand, ctx);
      if (!result.valid) {
        socket.emit('play-error', { message: result.reason ?? 'Invalid play' });
        return;
      }
    }

    const newHand = hand.filter(c => !cards.includes(c));
    updatePlayerHand(player.player_id, newHand);

    for (const pid of trickState.plays.keys()) {
      trickState.committed.add(pid);
    }

    trickState.plays.set(player.player_id, cards);

    io.to(trickState.roomId).emit('cards-played', {
      playerId: player.player_id,
      cards,
    });

    if (trickState.plays.size === trickState.playerOrder.length) {
      const winnerId = determineTrickWinner(trickState.plays, trickState.leaderId, ctx);

      const trickPoints = calculateTrickPoints(trickState.plays);
      if (trickPoints > 0) {
        addPointsToPlayer(winnerId, trickPoints);
      }
      const points = getRoundPoints(trickState.roomId);

      const playsObj: Record<string, string[]> = {};
      for (const [pid, pcards] of trickState.plays) {
        playsObj[pid] = pcards;
      }

      io.to(trickState.roomId).emit('trick-complete', {
        winnerId,
        plays: playsObj,
        points,
      });

      const allPlayers = trickState.playerOrder.map(pid => getPlayerById(pid));
      const allEmpty = allPlayers.every(p => {
        if (!p) return true;
        return parseHand(p).length === 0;
      });

      if (allEmpty) {
        trickStates.delete(gameId);

        const game = getGame(gameId)!;

        const leaderCards = trickState.plays.get(trickState.leaderId)!;
        const leaderShape = classifyPlay(leaderCards, ctx);
        let kittyMultiplier = 2;
        if (leaderShape.type === 'tractor') {
          kittyMultiplier = 8;
        } else if (leaderShape.type === 'pair') {
          kittyMultiplier = 4;
        } else if (leaderShape.type === 'throw' && leaderShape.components) {
          const hasT = leaderShape.components.some(c => c.type === 'tractor');
          const hasP = leaderShape.components.some(c => c.type === 'pair');
          kittyMultiplier = hasT ? 8 : hasP ? 4 : 2;
        }
        const kittyCardsArr: string[] = JSON.parse(game.kitty as string);
        let kittyPoints = 0;
        for (const card of kittyCardsArr) {
          kittyPoints += cardPoints(card);
        }
        const kittyBonus = kittyPoints * kittyMultiplier;
        if (kittyBonus > 0) {
          addPointsToPlayer(winnerId, kittyBonus);
        }

        const finalPoints = getRoundPoints(trickState.roomId);

        const allPlayersOrdered = getPlayersInRoom(trickState.roomId).slice(0, MAX_PLAYERS);
        const numP = allPlayersOrdered.length;
        const kingId = game.round_king!;
        const kingIdx = allPlayersOrdered.findIndex(p => p.player_id === kingId);
        const defendingIds: string[] = [];
        const attackingIds: string[] = [];
        for (let offset = 0; offset < numP; offset++) {
          const pid = allPlayersOrdered[(kingIdx + offset) % numP].player_id;
          if (offset % 2 === 0) {
            defendingIds.push(pid);
          } else {
            attackingIds.push(pid);
          }
        }

        const attackingPoints = attackingIds.reduce((sum, pid) => sum + (finalPoints[pid] ?? 0), 0);

        let winningTeam: 'attacking' | 'defending';
        let defendingRankUp = 0;
        let attackingRankUp = 0;

        if (attackingPoints >= 200) {
          winningTeam = 'attacking';
          attackingRankUp = 3;
        } else if (attackingPoints >= 160) {
          winningTeam = 'attacking';
          attackingRankUp = 2;
        } else if (attackingPoints >= 120) {
          winningTeam = 'attacking';
          attackingRankUp = 1;
        } else if (attackingPoints >= 80) {
          winningTeam = 'attacking';
          attackingRankUp = 0;
        } else if (attackingPoints >= 40) {
          winningTeam = 'defending';
          defendingRankUp = 1;
        } else if (attackingPoints > 0) {
          winningTeam = 'defending';
          defendingRankUp = 2;
        } else {
          winningTeam = 'defending';
          defendingRankUp = 3;
        }

        const rankChanges: Record<string, { oldRank: number; newRank: number }> = {};
        const winningIds = winningTeam === 'attacking' ? attackingIds : defendingIds;
        const rankUp = winningTeam === 'attacking' ? attackingRankUp : defendingRankUp;

        const gameOver = rankUp > 0 && winningIds.some(pid => {
          const p = allPlayersOrdered.find(pl => pl.player_id === pid);
          return p && p.rank === 14;
        });

        for (const p of allPlayersOrdered) {
          const oldRank = p.rank;
          let newRank = oldRank;
          if (winningIds.includes(p.player_id) && rankUp > 0) {
            newRank = Math.min(14, oldRank + rankUp);
            updatePlayerRank(p.player_id, newRank);
          }
          rankChanges[p.player_id] = { oldRank, newRank };
        }

        const playerOrder = trickState.playerOrder;
        const kingOrderIdx = playerOrder.indexOf(kingId);
        let nextKingId = kingId;
        for (let offset = 1; offset <= playerOrder.length; offset++) {
          const candidateId = playerOrder[(kingOrderIdx + offset) % playerOrder.length];
          if (winningIds.includes(candidateId)) {
            nextKingId = candidateId;
            break;
          }
        }

        pendingNextKing.set(gameId, nextKingId);

        io.to(trickState.roomId).emit('round-over', {
          attackingPoints,
          defendingPoints: Object.values(finalPoints).reduce((a, b) => a + b, 0) - attackingPoints,
          rankChanges,
          nextKingId,
          winningTeam,
          kittyBonus,
          gameOver,
        });
      } else {
        const nextTrickNum = trickState.trickNum + 1;
        const roomId = trickState.roomId;
        const playerOrder = trickState.playerOrder;
        const winnerIdx = playerOrder.indexOf(winnerId);
        const rotatedOrder = playerOrder.map((_, i) => playerOrder[(winnerIdx + i) % playerOrder.length]);

        const handle = setTimeout(() => {
          pendingNextTrick.delete(gameId);
          startTrick(io, gameId, roomId, winnerId, nextTrickNum, rotatedOrder);
        }, 3000);
        pendingNextTrick.set(gameId, { handle, winnerId, trickPoints, roomId, nextTrickNum, rotatedOrder });
      }
    } else {
      const currentIdx = trickState.playerOrder.indexOf(player.player_id);
      const nextIdx = (currentIdx + 1) % trickState.playerOrder.length;
      trickState.currentTurn = trickState.playerOrder[nextIdx];

      io.to(trickState.roomId).emit('turn-advanced', {
        currentTurn: trickState.currentTurn,
      });
    }
  });

  socket.on('undo-play', (payload: { gameId: string }) => {
    const { gameId } = payload;

    const trickState = trickStates.get(gameId);
    if (!trickState) {
      socket.emit('play-error', { message: 'No active trick' });
      return;
    }

    if (isRoomFrozen(trickState.roomId)) {
      socket.emit('game-paused', { reason: 'A player is disconnected' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player) {
      socket.emit('play-error', { message: 'Player not found' });
      return;
    }

    if (!trickState.plays.has(player.player_id)) {
      socket.emit('play-error', { message: 'You have not played yet' });
      return;
    }

    if (trickState.committed.has(player.player_id)) {
      socket.emit('play-error', { message: 'Your play is final — a later player has already played' });
      return;
    }

    let updatedPoints: Record<string, number> | undefined;
    const pending = pendingNextTrick.get(gameId);
    if (pending) {
      clearTimeout(pending.handle);
      pendingNextTrick.delete(gameId);
      if (pending.trickPoints > 0) {
        addPointsToPlayer(pending.winnerId, -pending.trickPoints);
      }
      updatedPoints = getRoundPoints(trickState.roomId);
    }

    const cardsToReturn = trickState.plays.get(player.player_id)!;

    const dbPlayer = getPlayerById(player.player_id);
    if (!dbPlayer) {
      socket.emit('play-error', { message: 'Player not found in DB' });
      return;
    }
    const currentHand = parseHand(dbPlayer);
    updatePlayerHand(player.player_id, [...currentHand, ...cardsToReturn]);

    trickState.plays.delete(player.player_id);

    if (player.player_id === trickState.leaderId) {
      trickState.leaderShape = null;
    }

    trickState.currentTurn = player.player_id;

    io.to(trickState.roomId).emit('play-undone', {
      playerId: player.player_id,
      cards: cardsToReturn,
      trickUndone: !!pending,
      ...(updatedPoints ? { points: updatedPoints } : {}),
    });
  });
}
