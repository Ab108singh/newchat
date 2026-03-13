
const { Server } = require('socket.io');
const User = require('../models/userModel');
const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');

let userSocketMap = {};
// Grace-period timeouts — cancelled if user reconnects before expiry (e.g. page refresh)
const disconnectTimeouts = {};

/** Safely emit to a target user — skips silently if they are offline */
const emitTo = (io, toId, event, payload) => {
  const socketId = userSocketMap[toId];
  if (socketId) {
    io.to(socketId).emit(event, payload);
  } else {
    console.log(`[socket] ${event} → user ${toId} is offline, skipping.`);
  }
};

const socketConfig = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "https://13.61.12.47", "https://13.61.12.47:3000"],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    const userId = socket.handshake.query.userId;
    try {
      if (userId) {
        // Cancel any pending disconnect timeout (e.g. reconnect after refresh)
        if (disconnectTimeouts[userId]) {
          clearTimeout(disconnectTimeouts[userId]);
          delete disconnectTimeouts[userId];
        }

        userSocketMap[userId] = socket.id;

        // Update user online status in database
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Notify all other clients that this user is online
        socket.broadcast.emit("user-online", { userId, isOnline: true });
      }
    } catch (err) {
      console.error("Socket connection setup error:", err);
    }

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      if (userId) {
        // Use a grace period before marking offline.
        // If user reconnects within 8s (e.g. page refresh), the timeout is cancelled.
        disconnectTimeouts[userId] = setTimeout(async () => {
          try {
            // Only mark offline if this socket is still the one we know about
            if (userSocketMap[userId] === socket.id) {
              delete userSocketMap[userId];
              await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
              socket.broadcast.emit("user-offline", { userId, isOnline: false });
            }
          } catch (err) {
            console.error("Socket disconnect timeout error:", err);
          } finally {
            delete disconnectTimeouts[userId];
          }
        }, 8000); // 8-second grace period for page refreshes
      }
    });

    // ─── Call Signaling ───────────────────────────────────────────────────────

    socket.on("call-user", async ({ from, to, signalData }) => {
      try {
        console.log("call-user", from, "→", to);
        // Resolve caller info inside the handler so it's always fresh
        const caller = await User.findById(from).select('name avatar').lean();
        emitTo(io, to, "call-user", { user: caller || { _id: from, name: 'Unknown' }, signalData });
      } catch (err) {
        console.error("call-user socket error:", err);
      }
    });

    socket.on("end-call", ({ from, to, signalData }) => {
      try {
        console.log("end-call", from, "→", to);
        emitTo(io, to, "end-call", { from, signalData });
      } catch (err) {
        console.error("end-call socket error:", err);
      }
    });

    // Caller cancels an unanswered call (timeout / manual cancel)
    socket.on("call-timeout", ({ from, to }) => {
      try {
        console.log("call-timeout", from, "→", to);
        emitTo(io, to, "call-timeout", { from });
      } catch (err) {
        console.error("call-timeout socket error:", err);
      }
    });

    socket.on("call-accepted", ({ from, to }) => {
      try {
        console.log("call-accepted", from, "→", to);
        emitTo(io, to, "call-accepted", { from });
      } catch (err) {
        console.error("call-accepted socket error:", err);
      }
    });

    socket.on("call-declined", ({ from, to }) => {
      try {
        console.log("call-declined", from, "→", to);
        emitTo(io, to, "call-declined", { from });
      } catch (err) {
        console.error("call-declined socket error:", err);
      }
    });

    // ─── WebRTC Signaling ─────────────────────────────────────────────────────

    // Relay SDP offer from caller to receiver
    socket.on("webrtc-offer", ({ to, offer }) => {
      try {
        console.log("webrtc-offer →", to);
        emitTo(io, to, "webrtc-offer", { from: userId, offer });
      } catch (err) {
        console.error("webrtc-offer socket error:", err);
      }
    });

    // Relay SDP answer from receiver back to caller
    socket.on("webrtc-answer", ({ to, answer }) => {
      try {
        console.log("webrtc-answer →", to);
        emitTo(io, to, "webrtc-answer", { from: userId, answer });
      } catch (err) {
        console.error("webrtc-answer socket error:", err);
      }
    });

    // Relay ICE candidates between peers
    socket.on("ice-candidate", ({ to, candidate }) => {
      try {
        emitTo(io, to, "ice-candidate", { candidate, from: userId });
      } catch (err) {
        console.error("ice-candidate socket error:", err);
      }
    });

    // ─── Typing Indicators ────────────────────────────────────────────────────

    socket.on("typing", ({ to }) => {
      try {
        emitTo(io, to, "typing", { from: userId });
      } catch (err) {
        console.error("typing socket error:", err);
      }
    });

    socket.on("stop-typing", ({ to }) => {
      try {
        emitTo(io, to, "stop-typing", { from: userId });
      } catch (err) {
        console.error("stop-typing socket error:", err);
      }
    });

    // ─── Messaging ────────────────────────────────────────────────────────────

    socket.on("message", async ({ recId, msg }) => {
      try {
        let conversation = await Conversation.findOne({ participants: { $all: [userId, recId] } });

        if (!conversation) {
          const unreadCountMap = new Map();
          unreadCountMap.set(userId, 0);
          unreadCountMap.set(recId, 1);

          conversation = await Conversation.create({
            participants: [userId, recId],
            lastMessage: msg,
            lastMessageTime: new Date(),
            unreadCount: unreadCountMap
          });
        } else {
          const currentCount = conversation.unreadCount.get(recId) || 0;
          conversation.unreadCount.set(recId, currentCount + 1);
          conversation.lastMessage = msg;
          conversation.lastMessageTime = new Date();
          await conversation.save();
        }

        await Message.create({ sender: userId, receiver: recId, message: msg, conversation: conversation._id, isRead: false });

        emitTo(io, recId, "receive", { sender: userId, msg });
      } catch (err) {
        console.error("message socket error:", err);
      }
    });

    socket.on("all-read", async ({ currentUserId, selectedUserId }) => {
      try {
        const conversation = await Conversation.findOne({
          participants: { $all: [currentUserId, selectedUserId] }
        });

        if (conversation) {
          conversation.unreadCount.set(currentUserId, 0);
          await conversation.save();

          await Message.updateMany(
            { sender: selectedUserId, receiver: currentUserId, isRead: false },
            { isRead: true }
          );

          emitTo(io, selectedUserId, "messages-marked-read", {
            readBy: currentUserId,
            messagesFrom: selectedUserId
          });
        }
      } catch (err) {
        console.error("all-read socket error:", err);
      }
    });

  });

  return io;
};

module.exports = socketConfig;
module.exports.userSocketMap = userSocketMap;
