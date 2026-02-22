import { Server, Socket } from 'socket.io';
import { getRoom } from '../room/room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, getPlayerBySocketId, getPlayerRank, getPlayerById, addPointsToPlayer, resetRoundPoints, getRoundPoints, updatePlayerRank } from '../player/player.queries';
import { removeRoom } from '../room/room.queries';
import { createGame, updatePlayerHand, getGame, updateTrumpDeclaration, updateRoundKing, updateKitty, resetGameForNewRound } from '../game/game.queries';
import { parseCard, cardPoints, dealCards, getKittySize } from '../game/deck';
import { JoinRoomPayload, DeclareTrumpPayload, PlayCardsPayload, TrickState, TrumpContext } from '../types';
import { classifyPlay, validateFollow, validateThrow, determineTrickWinner } from '../game/trick';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START } from '../constants';

// Store the last round's nextKingId per game for start-next-round
const pendingNextKing = new Map<string, string>();

function calculateTrickPoints(plays: Map<string, string[]>): number {
  let points = 0;
  for (const cards of plays.values()) {
    for (const card of cards) {
      points += cardPoints(card);
    }
  }
  return points;
}

// Active trick states by gameId
const trickStates = new Map<string, TrickState>();

function startTrick(
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
    leaderShape: null,
  };
  trickStates.set(gameId, state);

  io.to(roomId).emit('trick-started', {
    leaderId,
    trickNum,
    playerOrder,
  });
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', (payload: JoinRoomPayload) => {
      const { roomId, displayName } = payload;

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('room-error', { message: 'Room not found' });
        return;
      }

      const count = getPlayerCountInRoom(roomId);
      if (count >= MAX_PLAYERS) {
        socket.emit('room-error', { message: 'Room is full (max 6 players)' });
        return;
      }

      const existingPlayers = getPlayersInRoom(roomId);
      if (existingPlayers.some(p => p.display_name === displayName)) {
        socket.emit('room-error', { message: 'That name is already taken in this room' });
        return;
      }

      const player = addPlayer(roomId, displayName, socket.id);
      socket.join(roomId);

      const players = getPlayersInRoom(roomId);
      io.to(roomId).emit('player-joined', { player, players });
    });

    socket.on('start-game', (payload: { roomId: string }) => {
      const { roomId } = payload;
      const players = getPlayersInRoom(roomId);
      if (players.length < MIN_PLAYERS_TO_START) {
        socket.emit('room-error', { message: `Need at least ${MIN_PLAYERS_TO_START} players to start` });
        return;
      }

      // Use all players in room (up to MAX_PLAYERS)
      const gamePlayers = players.slice(0, MAX_PLAYERS);

      // Reset round points for all players in the room
      resetRoundPoints(roomId);

      // Round king starts as null — set when trump is declared
      const trumpNumber = String(getPlayerRank(gamePlayers[0].player_id));

      // Create, shuffle, and deal cards
      const { hands, kitty } = dealCards(gamePlayers.length);

      // Store in DB
      const game = createGame(roomId, kitty, null, trumpNumber);
      for (let i = 0; i < gamePlayers.length; i++) {
        updatePlayerHand(gamePlayers[i].player_id, hands[i]);
      }

      // Attach hands to player objects so each client can find their own
      const playersWithHands = gamePlayers.map((p, i) => ({
        ...p,
        hand: hands[i],
      }));

      // Single event with everything the client needs
      io.to(roomId).emit('game-started', {
        gameId: game.game_id,
        players: playersWithHands,
        trumpNumber,
        trumpSuit: 'NA',
        roundKingId: null,
        kittySize: kitty.length,
      });
    });

    socket.on('declare-trump', (payload: DeclareTrumpPayload) => {
      const { gameId, card } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      // Declaration is truly final only when double jokers have been declared
      if (game.trump_count >= 2 && game.trump_suit === 'NT') {
        socket.emit('room-error', { message: 'Trump declaration is already final' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player) {
        socket.emit('room-error', { message: 'Player not found' });
        return;
      }

      const { suit, rank } = parseCard(card);

      // Only update the round king on the first round.
      // On subsequent rounds the king is pre-set by start-next-round.
      const isFirstRound = game.round_number === 1;

      // Get player's hand to validate they have the card(s)
      const hand: string[] = player.hand ? JSON.parse(player.hand as unknown as string) : [];

      // Handle double joker declaration (no trump suit)
      if (suit === 'J') {
        const matchingJokers = hand.filter((c) => {
          const parsed = parseCard(c);
          return parsed.suit === 'J' && parsed.rank === rank;
        });
        if (matchingJokers.length < 2) {
          socket.emit('room-error', { message: 'You need a pair of jokers to declare no trump suit' });
          return;
        }
        // Double joker: set trump suit to 'NT' (no trump suit), count=2 (final)
        updateTrumpDeclaration(gameId, 'NT', player.player_id, 2);
        if (isFirstRound) {
          updateRoundKing(gameId, player.player_id);
        }
        io.to(game.room_id).emit('trump-declared', {
          trumpSuit: 'NT',
          declarerId: player.player_id,
          isPair: true,
          roundKingId: isFirstRound ? player.player_id : game.round_king,
          jokerRank: rank,
        });
        return;
      }

      // Card rank must match trump number
      if (rank !== game.trump_number) {
        socket.emit('room-error', { message: 'Card rank does not match trump number' });
        return;
      }

      // Only double jokers can override a pair declaration
      if (game.trump_count >= 2) {
        socket.emit('room-error', { message: 'Only double jokers can override a pair declaration' });
        return;
      }

      const matchingCards = hand.filter((c) => {
        const parsed = parseCard(c);
        return parsed.suit === suit && parsed.rank === rank;
      });

      if (matchingCards.length === 0) {
        socket.emit('room-error', { message: 'You do not have this card' });
        return;
      }

      if (game.trump_count === 0) {
        const wantPair = payload.wantPair === true;
        if (wantPair) {
          if (matchingCards.length < 2) {
            socket.emit('room-error', { message: 'You need a pair to declare a pair' });
            return;
          }
          updateTrumpDeclaration(gameId, suit, player.player_id, 2);
          if (isFirstRound) {
            updateRoundKing(gameId, player.player_id);
          }
          io.to(game.room_id).emit('trump-declared', {
            trumpSuit: suit,
            declarerId: player.player_id,
            isPair: true,
            roundKingId: isFirstRound ? player.player_id : game.round_king,
          });
        } else {
          updateTrumpDeclaration(gameId, suit, player.player_id, 1);
          if (isFirstRound) {
            updateRoundKing(gameId, player.player_id);
          }
          io.to(game.room_id).emit('trump-declared', {
            trumpSuit: suit,
            declarerId: player.player_id,
            isPair: false,
            roundKingId: isFirstRound ? player.player_id : game.round_king,
          });
        }
      } else if (game.trump_count === 1) {
        // Single declaration exists — reinforcement or override both require a pair
        if (matchingCards.length < 2) {
          const isReinforce = player.player_id === game.trump_declarer && suit === game.trump_suit;
          socket.emit('room-error', {
            message: isReinforce ? 'You need a pair to reinforce' : 'You need a pair to override the current declaration',
          });
        } else {
          updateTrumpDeclaration(gameId, suit, player.player_id, 2);
          if (isFirstRound) {
            updateRoundKing(gameId, player.player_id);
          }
          io.to(game.room_id).emit('trump-declared', {
            trumpSuit: suit,
            declarerId: player.player_id,
            isPair: true,
            roundKingId: isFirstRound ? player.player_id : game.round_king,
          });
        }
      }
    });

    socket.on('pick-up-kitty', (payload: { gameId: string }) => {
      const { gameId } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player || player.player_id !== game.round_king) {
        socket.emit('room-error', { message: 'Only the round king can pick up the kitty' });
        return;
      }

      const kittyCards: string[] = JSON.parse(game.kitty as string);

      // Send kitty cards only to the round king
      socket.emit('kitty-picked-up', { kittyCards });
      // Notify other players (no cards)
      socket.to(game.room_id).emit('kitty-picked-up', {});
    });

    socket.on('finish-kitty', (payload: { gameId: string; kittyCards: string[]; handCards: string[] }) => {
      const { gameId, kittyCards, handCards } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player || player.player_id !== game.round_king) {
        socket.emit('room-error', { message: 'Only the round king can finish the kitty' });
        return;
      }

      const players = getPlayersInRoom(game.room_id).slice(0, MAX_PLAYERS);
      const expectedKittySize = getKittySize(players.length);
      if (kittyCards.length !== expectedKittySize) {
        socket.emit('room-error', { message: `Kitty must contain exactly ${expectedKittySize} cards` });
        return;
      }

      updateKitty(gameId, kittyCards);
      updatePlayerHand(player.player_id, handCards);

      io.to(game.room_id).emit('kitty-finished', {});

      // Start trick-playing phase: compute player order (rotate so round king leads first)
      const kingIndex = players.findIndex(p => p.player_id === game.round_king);
      const playerOrder = players.map((_, i) => players[(kingIndex + i) % players.length].player_id);

      startTrick(io, gameId, game.room_id, game.round_king!, 1, playerOrder);
    });

    socket.on('play-cards', (payload: PlayCardsPayload) => {
      const { gameId, cards } = payload;

      const trickState = trickStates.get(gameId);
      if (!trickState) {
        socket.emit('play-error', { message: 'No active trick' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player) {
        socket.emit('play-error', { message: 'Player not found' });
        return;
      }

      // Validate it's this player's turn
      if (player.player_id !== trickState.currentTurn) {
        socket.emit('play-error', { message: 'Not your turn' });
        return;
      }

      // Get player's current hand from DB
      const dbPlayer = getPlayerById(player.player_id);
      if (!dbPlayer) {
        socket.emit('play-error', { message: 'Player not found in DB' });
        return;
      }
      const hand: string[] = dbPlayer.hand ? JSON.parse(dbPlayer.hand as unknown as string) : [];

      // Validate all cards are in hand
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
        // Leader: classify play, must not be invalid
        const shape = classifyPlay(cards, ctx);
        if (shape.type === 'invalid') {
          socket.emit('play-error', { message: 'Invalid card combination' });
          return;
        }

        // If it's a throw, validate against opponents' hands
        if (shape.type === 'throw' && shape.components) {
          const opponentHands: string[][] = [];
          for (const pid of trickState.playerOrder) {
            if (pid === player.player_id) continue;
            const opponent = getPlayerById(pid);
            if (opponent) {
              const oppHand: string[] = opponent.hand ? JSON.parse(opponent.hand as unknown as string) : [];
              opponentHands.push(oppHand);
            }
          }

          const throwResult = validateThrow(shape.components, cards, opponentHands, ctx);
          if (!throwResult.valid) {
            // Auto-play only the failed (beatable) component
            const failedCards = throwResult.failedComponentCards!;
            const failedShape = classifyPlay(failedCards, ctx);

            // Remove only the failed component cards from hand
            const newHand = hand.filter(c => !failedCards.includes(c));
            updatePlayerHand(player.player_id, newHand);

            // Record the failed component as the leader's play
            trickState.leaderShape = failedShape as TrickState['leaderShape'];
            trickState.plays.set(player.player_id, failedCards);

            // Notify the thrower which cards were auto-played vs returned
            const returnedCards = cards.filter(c => !failedCards.includes(c));
            socket.emit('throw-failed', {
              message: 'Throw blocked! An opponent can beat a component.',
              failedCards,
              returnedCards,
            });

            // Broadcast the auto-played cards to the room
            io.to(trickState.roomId).emit('cards-played', {
              playerId: player.player_id,
              cards: failedCards,
            });

            // Advance to next player
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
        // Follower: validate card count matches leader
        const leaderCards = trickState.plays.get(trickState.leaderId);
        if (!leaderCards) {
          socket.emit('play-error', { message: 'Leader has not played yet' });
          return;
        }

        if (cards.length !== leaderCards.length) {
          socket.emit('play-error', { message: `Must play exactly ${leaderCards.length} cards` });
          return;
        }

        // Validate follow-suit rules
        const result = validateFollow(trickState.leaderShape!, cards, hand, ctx);
        if (!result.valid) {
          socket.emit('play-error', { message: result.reason ?? 'Invalid play' });
          return;
        }
      }

      // Remove cards from hand in DB
      const newHand = hand.filter(c => !cards.includes(c));
      updatePlayerHand(player.player_id, newHand);

      // Record play
      trickState.plays.set(player.player_id, cards);

      // Emit cards-played to room
      io.to(trickState.roomId).emit('cards-played', {
        playerId: player.player_id,
        cards,
      });

      // Check if all players have played
      if (trickState.plays.size === trickState.playerOrder.length) {
        // Determine trick winner
        const winnerId = determineTrickWinner(trickState.plays, trickState.leaderId, ctx);

        // Calculate and award trick points
        const trickPoints = calculateTrickPoints(trickState.plays);
        if (trickPoints > 0) {
          addPointsToPlayer(winnerId, trickPoints);
        }
        const points = getRoundPoints(trickState.roomId);

        // Convert plays map to plain object for emission
        const playsObj: Record<string, string[]> = {};
        for (const [pid, pcards] of trickState.plays) {
          playsObj[pid] = pcards;
        }

        io.to(trickState.roomId).emit('trick-complete', {
          winnerId,
          plays: playsObj,
          points,
        });

        // Check if round is over (all hands empty)
        const allPlayers = trickState.playerOrder.map(pid => getPlayerById(pid));
        const allEmpty = allPlayers.every(p => {
          if (!p) return true;
          const h: string[] = p.hand ? JSON.parse(p.hand as unknown as string) : [];
          return h.length === 0;
        });

        if (allEmpty) {
          // Round over — full scoring resolution
          trickStates.delete(gameId);

          const game = getGame(gameId)!;

          // Kitty bonus: last trick winner gets multiplied point cards in the kitty
          // Multiplier scales with the winning play type: 2x single, 4x pair, 8x tractor
          const leaderCards = trickState.plays.get(trickState.leaderId)!;
          const leaderShape = classifyPlay(leaderCards, ctx);
          let kittyMultiplier = 2;
          if (leaderShape.type === 'tractor') {
            kittyMultiplier = 8;
          } else if (leaderShape.type === 'pair') {
            kittyMultiplier = 4;
          } else if (leaderShape.type === 'throw' && leaderShape.components) {
            // Use the highest component's multiplier
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

          // Get final round points
          const finalPoints = getRoundPoints(trickState.roomId);

          // Determine teams: player order by join
          const allPlayersOrdered = getPlayersInRoom(trickState.roomId).slice(0, MAX_PLAYERS);
          const numP = allPlayersOrdered.length;
          const kingId = game.round_king!;
          const kingIdx = allPlayersOrdered.findIndex(p => p.player_id === kingId);
          // Defending: king + every 2nd player (king+0, king+2, king+4...)
          // Attacking: king+1, king+3, king+5...
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

          // Determine rank changes
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
            // Attackers gain control but no rank change
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

          // Apply rank changes and build rankChanges record
          const rankChanges: Record<string, { oldRank: number; newRank: number }> = {};
          const winningIds = winningTeam === 'attacking' ? attackingIds : defendingIds;
          const rankUp = winningTeam === 'attacking' ? attackingRankUp : defendingRankUp;

          // Check for game over before capping ranks
          const gameOver = rankUp > 0 && winningIds.some(pid => {
            const p = allPlayersOrdered.find(pl => pl.player_id === pid);
            return p && p.rank === 14;
          });

          for (const p of allPlayersOrdered) {
            const oldRank = p.rank;
            let newRank = oldRank;
            if (winningIds.includes(p.player_id) && rankUp > 0) {
              newRank = Math.min(14, oldRank + rankUp); // Cap at Ace (14)
              updatePlayerRank(p.player_id, newRank);
            }
            rankChanges[p.player_id] = { oldRank, newRank };
          }

          // Determine next king: from current king clockwise, first player on winning team
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
          // After 3s delay, start next trick with winner as leader
          const nextTrickNum = trickState.trickNum + 1;
          const roomId = trickState.roomId;
          const playerOrder = trickState.playerOrder;
          // Rotate player order so winner is first
          const winnerIdx = playerOrder.indexOf(winnerId);
          const rotatedOrder = playerOrder.map((_, i) => playerOrder[(winnerIdx + i) % playerOrder.length]);

          setTimeout(() => {
            startTrick(io, gameId, roomId, winnerId, nextTrickNum, rotatedOrder);
          }, 3000);
        }
      } else {
        // Advance to next player in order
        const currentIdx = trickState.playerOrder.indexOf(player.player_id);
        const nextIdx = (currentIdx + 1) % trickState.playerOrder.length;
        trickState.currentTurn = trickState.playerOrder[nextIdx];

        io.to(trickState.roomId).emit('turn-advanced', {
          currentTurn: trickState.currentTurn,
        });
      }
    });

    socket.on('start-next-round', (payload: { gameId: string }) => {
      const { gameId } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      const nextKingId = pendingNextKing.get(gameId);
      if (!nextKingId) {
        socket.emit('room-error', { message: 'No pending next round' });
        return;
      }
      pendingNextKing.delete(gameId);

      // Reset round points for all players
      resetRoundPoints(game.room_id);

      // Get the next king's rank for trump number
      const nextKingRank = getPlayerRank(nextKingId);
      const trumpNumber = String(nextKingRank);

      // Reset game state for new round
      resetGameForNewRound(gameId, trumpNumber, nextKingId);

      // Get players and re-deal cards
      const gamePlayers = getPlayersInRoom(game.room_id).slice(0, MAX_PLAYERS);
      const { hands, kitty } = dealCards(gamePlayers.length);

      // Update kitty in DB
      updateKitty(gameId, kitty);

      for (let i = 0; i < gamePlayers.length; i++) {
        updatePlayerHand(gamePlayers[i].player_id, hands[i]);
      }

      const playersWithHands = gamePlayers.map((p, i) => ({
        ...p,
        hand: hands[i],
        rank: p.rank, // ranks already updated from round-over
      }));

      const updatedGame = getGame(gameId)!;

      io.to(game.room_id).emit('game-started', {
        gameId: game.game_id,
        players: playersWithHands,
        trumpNumber,
        trumpSuit: 'NA',
        roundKingId: nextKingId,
        roundNumber: updatedGame.round_number,
        kittySize: kitty.length,
      });
    });

    socket.on('leave-room', () => {
      handleDisconnect(io, socket);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      handleDisconnect(io, socket);
    });
  });
}

function handleDisconnect(io: Server, socket: Socket) {
  const player = removePlayerBySocketId(socket.id);
  if (player) {
    const players = getPlayersInRoom(player.room_id);
    if (players.length === 0) {
      removeRoom(player.room_id);
    }
    io.to(player.room_id).emit('player-left', { playerId: player.player_id, players });
    socket.leave(player.room_id);

    // Clean up trick state if disconnected player was in active trick
    for (const [gameId, state] of trickStates) {
      if (state.playerOrder.includes(player.player_id)) {
        trickStates.delete(gameId);
        io.to(state.roomId).emit('trick-cancelled', { reason: 'Player disconnected' });
        break;
      }
    }
  }
}
