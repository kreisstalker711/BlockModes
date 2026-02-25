const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// Serve client folder
app.use(express.static("../client"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const players = {};

io.on("connection", (socket) => {
  const username = socket.handshake.query.username || "Guest";

  console.log(`Player joined: ${username} (${socket.id})`);

  players[socket.id] = {
    username,
    x: 0,
    y: 0
  };

  // Send all current players to new player
  socket.emit("currentPlayers", players);

  // Tell others someone joined
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    data: players[socket.id]
  });

  socket.on("playerMove", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;

      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        data: players[socket.id]
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player left: ${username}`);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});