// backend/server.js
const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const path = require("path");

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Load .env
dotenv.config();

// Connect to DB
connectDB();

const app = express();
app.use(express.json()); // read JSON data

// -------------------- API Routes --------------------
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// -------------------- Deployment --------------------
const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}
// -------------------- Deployment --------------------

// Error Middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}...`);
});

// -------------------- SOCKET.IO --------------------
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  // Setup: put user in their personal room
  socket.on("setup", (userData) => {
    if (!userData || !userData._id) return;
    socket.userId = userData._id.toString();
    socket.join(socket.userId);
    socket.emit("connected");
  });

  // Join chat room
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  // Typing indicators
  socket.on("typing", (room) => socket.to(room).emit("typing"));
  socket.on("stop typing", (room) => socket.to(room).emit("stop typing"));

  // New message broadcast
  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived?.chat;

    if (!chat || !chat.users) {
      console.log("chat.users not defined");
      return;
    }

    const senderId =
      newMessageReceived.sender?._id?.toString() ||
      newMessageReceived.sender?.toString();

    chat.users.forEach((user) => {
      const userId = user._id?.toString() || user?.toString();

      if (userId === senderId) return; // skip sender

      socket.to(userId).emit("message received", newMessageReceived);
    });
  });

  // On disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId || "");
    if (socket.userId) socket.leave(socket.userId);
  });
});
