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
  console.log("Player joined:", socket.id);

  // create player
  players[socket.id] = {
    x: 0,
    y: 50,
    z: 0,
    rotY: 0
  };

  // send existing players to new user
  socket.emit("currentPlayers", players);

  // broadcast new player
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    data: players[socket.id]
  });

  // receive movement updates
  socket.on("playerUpdate", data => {
    players[socket.id] = data;
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      data
    });
  });

  socket.on("disconnect", () => {
    console.log("Player left:", socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(3000, () => {
  console.log("✅ BlockModes server running on http://localhost:3000");
});
