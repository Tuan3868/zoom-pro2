const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// lưu user trong room
const rooms = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name });

    // gửi danh sách user hiện tại
    socket.emit("all-users", rooms[roomId]);

    // báo người mới
    socket.to(roomId).emit("user-connected", {
      id: socket.id,
      name,
    });

    socket.on("signal", (data) => {
      io.to(data.to).emit("signal", {
        from: socket.id,
        data: data.data,
      });
    });

    socket.on("disconnect", () => {
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
      }

      socket.to(roomId).emit("user-disconnected", socket.id);
    });
  });
});

// 🔥 QUAN TRỌNG CHO DEPLOY
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server chạy...");
});
