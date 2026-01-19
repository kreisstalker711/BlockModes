const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const players = {};

io.on("connection", socket => {
  const username = socket.handshake.query.username || "Guest";
  
  console.log(`Player joined: ${username} (${socket.id})`);

  // Create player with username
  players[socket.id] = {
  username,
  x: 0,
  y: 2,
  z: 0,
  rotY: 0
};


  // Send existing players to new user
  socket.emit("currentPlayers", players);

  // Broadcast new player to others
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    data: players[socket.id]
  });

  // Receive movement updates
  socket.on("playerUpdate", data => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].z = data.z;
      players[socket.id].rotY = data.rotY;
    }
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      data: players[socket.id]
    });
  });

  socket.on("disconnect", () => {
    console.log(`Player left: ${username} (${socket.id})`);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(3000, () => {
  console.log("✅ BlockModes server running on http://localhost:3000");
});