# Tractor 拖拉机

An online multiplayer implementation of Tractor (升级/拖拉机), a popular Chinese card game. Create a room, share the link with friends, and play together in real time.

Currently supports 4-player games.

## Setup

**Prerequisites:** Node.js 18+

```bash
# Install dependencies for both client and server
cd client && npm install
cd ../server && npm install
```

The server reads two optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (set to your frontend URL in production) |

## Running

Start the server and client in separate terminals:

```bash
# Terminal 1 — server (with hot reload)
cd server
npm run dev

# Terminal 2 — client
cd client
npm run dev
```

The client runs at `http://localhost:5173` and the server at `http://localhost:3001`.

To build the client for production:

```bash
cd client
npm run build   # output goes to client/dist/
```

## How to play

1. Open the app and click **Create Room**
2. Share the room URL with 3 other players
3. Each player enters a display name to join
4. Once 4 players have joined, any player can click **Start Game**
5. The game proceeds through dealing, trump declaration, kitty assignment, and trick-taking phases

For full rules, see [pagat.com/kt5/tractor.html](https://www.pagat.com/kt5/tractor.html).

## Project structure

```
├── client/          # React + TypeScript frontend (Vite)
│   └── src/
│       ├── components/   # UI components (Card, PlayerSeat, GameLog, etc.)
│       ├── hooks/        # Custom hooks (useGameSocket, useGameActions, useGameLayout, etc.)
│       ├── pages/        # Route-level components (HomePage, RoomPage, GamePage)
│       ├── utils/        # Pure helpers (card sorting, layout math, seating)
│       └── gameState.ts  # Client-side game state reducer
├── server/          # Node.js + Express + Socket.io backend
│   └── src/
│       ├── db/           # SQLite queries (rooms, players, games)
│       ├── game/         # Game logic (deck, constants)
│       └── socket/       # Socket event handlers (room, game, trick, trump)
└── shared/          # Code shared between client and server
    ├── cards.ts     # Card parsing and trump detection
    └── events.ts    # Socket event name constants
```
