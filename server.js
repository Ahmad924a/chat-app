const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Connect to MongoDB (replace with your credentials)
mongoose.connect("mongodb+srv://USERNAME:PASSWORD@chat-app.sroatbd.mongodb.net/chatapp")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// ✅ Schema for messages (supports text + files)
const messageSchema = new mongoose.Schema({
  roomCode: String,
  nickname: String,
  message: String,
  fileName: String,
  fileData: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

// ✅ Serve frontend files
app.use(express.static("public"));

// ✅ Endpoint to generate random code + QR
app.get("/generateCode", async (req, res) => {
  const code = Math.random().toString().slice(2, 10);
  const qr = await QRCode.toDataURL(code);
  res.json({ code, qr });
});

// ✅ Socket.IO logic
io.on("connection", (socket) => {
  console.log("User connected");

  // Join room
  socket.on("joinRoom", async ({ roomCode, nickname }) => {
    socket.join(roomCode);
    socket.nickname = nickname;

    // Send chat history
    const history = await Message.find({ roomCode }).sort({ timestamp: 1 }).limit(50);
    socket.emit("chatHistory", history);

    // Notify others
    io.to(roomCode).emit("systemMessage", `${nickname} joined the chat`);
  });

  // Handle text messages
  socket.on("chatMessage", async ({ roomCode, message }) => {
    const chat = new Message({ roomCode, nickname: socket.nickname, message });
    await chat.save();
    io.to(roomCode).emit("chatMessage", chat);
  });

  // Handle file messages
  socket.on("fileMessage", async ({ roomCode, nickname, fileName, fileData }) => {
    const chat = new Message({ roomCode, nickname, fileName, fileData });
    await chat.save();
    io.to(roomCode).emit("fileMessage", chat);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// ✅ Start server
server.listen(3000, () => console.log("Server running on http://localhost:3000"));