const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userId, name }) => {
    socket.join(roomId);

    socket.to(roomId).emit("user-connected", { userId, name });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

server.listen(3000, () => {
  console.log("Server chạy tại http://localhost:3000");
});
