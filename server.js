const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active game sessions
const gameSessions = new Map();

// Store clients interested in lobby updates
const lobbyClients = new Set();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');

    // Set up message handler
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle disconnections
    ws.on('close', () => {
        console.log('Client disconnected');

        // Remove from lobby subscribers if present
        if (lobbyClients.has(ws)) {
            unsubscribeLobby(ws);
        }

        // Find and clean up any game sessions this client was part of
        for (const [sessionId, session] of gameSessions.entries()) {
            if (session.attacker === ws || session.defender === ws) {
                // Notify the other player that their opponent disconnected
                const otherPlayer = session.attacker === ws ? session.defender : session.attacker;

                if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
                    otherPlayer.send(JSON.stringify({
                        type: 'opponentDisconnected',
                        sessionId
                    }));
                }

                // Remove the game session
                gameSessions.delete(sessionId);
                console.log(`Game session ${sessionId} removed due to player disconnection`);

                // Broadcast lobby update
                broadcastLobbyUpdate();
            }
        }
    });
});

// Handle different message types
function handleMessage(ws, data) {
    switch (data.type) {
        case 'createSession':
            createGameSession(ws, data.sessionName);
            break;

        case 'joinSession':
            joinGameSession(ws, data.sessionId);
            break;

        case 'move':
            handleMove(ws, data);
            break;

        case 'subscribeLobby':
            subscribeLobby(ws);
            break;

        case 'unsubscribeLobby':
            unsubscribeLobby(ws);
            break;

        default:
            console.log('Unknown message type:', data.type);
    }
}

// Create a new game session
function createGameSession(ws, sessionName = 'Unnamed Game') {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();

    gameSessions.set(sessionId, {
        attacker: ws,
        defender: null,
        gameState: 'waiting',
        sessionName: sessionName || `Game ${sessionId.substring(0, 6)}`,
        createdAt: timestamp
    });

    // Send session ID to the creator
    ws.send(JSON.stringify({
        type: 'gameSession',
        sessionId,
        sessionName: gameSessions.get(sessionId).sessionName
    }));

    console.log(`Created game session: ${sessionId} - ${gameSessions.get(sessionId).sessionName}`);

    // Broadcast lobby update to all subscribed clients
    broadcastLobbyUpdate();
}

// Join an existing game session
function joinGameSession(ws, sessionId) {
    const session = gameSessions.get(sessionId);

    if (!session) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game session not found'
        }));
        return;
    }

    if (session.defender) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game session is full'
        }));
        return;
    }

    // Join as defender
    session.defender = ws;
    session.gameState = 'playing';

    // Notify both players that the game has started
    const gameStartMessage = JSON.stringify({
        type: 'gameState',
        gameState: 'playing',
        sessionId
    });

    session.attacker.send(gameStartMessage);
    session.defender.send(gameStartMessage);

    console.log(`Player joined game session: ${sessionId} - ${session.sessionName}`);

    // Broadcast lobby update to all subscribed clients
    broadcastLobbyUpdate();
}

// Handle a move from a player
function handleMove(ws, data) {
    const { sessionId, move } = data;
    const session = gameSessions.get(sessionId);

    if (!session) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Game session not found'
        }));
        return;
    }

    // Determine which player sent the move
    const isAttacker = session.attacker === ws;
    const isDefender = session.defender === ws;

    if (!isAttacker && !isDefender) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'You are not part of this game session'
        }));
        return;
    }

    // Forward the move to the other player
    const otherPlayer = isAttacker ? session.defender : session.attacker;

    if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
        otherPlayer.send(JSON.stringify({
            type: 'move',
            move,
            sessionId
        }));
    }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Add a simple status endpoint
app.get('/', (req, res) => {
    res.send('Riverside Vikings Chess Game Server is running');
});

// Add an endpoint to list active game sessions (for debugging)
app.get('/sessions', (req, res) => {
    const sessions = [];

    for (const [sessionId, session] of gameSessions.entries()) {
        sessions.push({
            sessionId,
            sessionName: session.sessionName,
            hasAttacker: !!session.attacker,
            hasDefender: !!session.defender,
            gameState: session.gameState,
            createdAt: session.createdAt
        });
    }

    res.json(sessions);
});

// Subscribe to lobby updates
function subscribeLobby(ws) {
    lobbyClients.add(ws);
    console.log(`Client subscribed to lobby updates. Total subscribers: ${lobbyClients.size}`);

    // Send initial lobby state
    sendLobbyUpdate(ws);
}

// Unsubscribe from lobby updates
function unsubscribeLobby(ws) {
    lobbyClients.delete(ws);
    console.log(`Client unsubscribed from lobby updates. Total subscribers: ${lobbyClients.size}`);
}

// Send lobby update to a specific client
function sendLobbyUpdate(ws) {
    const availableSessions = [];

    for (const [sessionId, session] of gameSessions.entries()) {
        // Only include sessions that are waiting for players
        if (session.gameState === 'waiting') {
            availableSessions.push({
                sessionId,
                sessionName: session.sessionName,
                createdAt: session.createdAt
            });
        }
    }

    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'lobbyUpdate',
            sessions: availableSessions
        }));
    }
}

// Broadcast lobby update to all subscribed clients
function broadcastLobbyUpdate() {
    for (const client of lobbyClients) {
        sendLobbyUpdate(client);
    }
}
