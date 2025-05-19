# Riverside Vikings Chess Server

This is the WebSocket server for the Riverside Vikings Chess (Hnefatafl) game. It handles multiplayer game sessions, allowing players to create and join games, and synchronizes moves between players.

## Deployment to Heroku

### Prerequisites

1. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. [Git](https://git-scm.com/)
3. [Node.js](https://nodejs.org/) (for local testing)

### Steps to Deploy

1. **Login to Heroku**
   ```bash
   heroku login
   ```

2. **Initialize Git Repository** (if not already done)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Create a Heroku App**
   ```bash
   heroku create
   ```
   Or with a specific name:
   ```bash
   heroku create your-app-name
   ```

4. **Deploy to Heroku**
   ```bash
   git push heroku master
   ```
   Or if you're using the main branch:
   ```bash
   git push heroku main
   ```

5. **Ensure the App is Running**
   ```bash
   heroku ps:scale web=1
   ```

6. **Open the App**
   ```bash
   heroku open
   ```

### Updating the iOS App

After deploying to Heroku, update the `serverURL` in the NetworkManager.swift file:

```swift
private let serverURL = URL(string: "wss://your-app-name.herokuapp.com")!
```

Replace "your-app-name" with your actual Heroku app name.

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Test the Server**
   Open a browser and navigate to `http://localhost:3000`. You should see "Viking Chess Game Server is running".

## API Endpoints

- `GET /`: Status check
- `GET /sessions`: List active game sessions (for debugging)

## WebSocket Messages

### Client to Server

- `createSession`: Create a new game session
- `joinSession`: Join an existing game session
- `move`: Send a move to the opponent

### Server to Client

- `gameSession`: Session ID for a newly created game
- `gameState`: Current state of the game
- `move`: Move received from the opponent
- `opponentDisconnected`: Notification that the opponent has disconnected
- `error`: Error message

## License

This project is licensed under the MIT License.
