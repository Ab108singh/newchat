
const { Server } = require('socket.io');
const User = require('../models/userModel');
const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');

let userSocketMap = {};
// Grace-period timeouts — cancelled if user reconnects before expiry (e.g. page refresh)
const disconnectTimeouts = {};

const socketConfig = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "https://13.61.12.47", "https://13.61.12.47:3000"],
      methods: ["GET", "POST"],
      credentials:true
    }
  });

  io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    const userId = socket.handshake.query.userId;
    let user;
    try {
      if(userId){
        user = await User.findById(userId);
      }
      if(userId){
          // Cancel any pending disconnect timeout (e.g. reconnect after refresh)
          if (disconnectTimeouts[userId]) {
            clearTimeout(disconnectTimeouts[userId]);
            delete disconnectTimeouts[userId];
          }

          userSocketMap[userId] = socket.id;
          
          // Update user online status in database
          await User.findByIdAndUpdate(userId, {isOnline:true, lastSeen:new Date()});
          
          // Notify all other clients that this user is online
          socket.broadcast.emit("user-online", {userId, isOnline:true});
      }
    } catch (err) {
      console.error("Socket connection setup error:", err);
    }

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      if(userId){
        // Use a grace period before marking offline.
        // If user reconnects within 8s (e.g. page refresh), the timeout is cancelled.
        disconnectTimeouts[userId] = setTimeout(async () => {
          try {
            // Only mark offline if this socket is still the one we know about
            if (userSocketMap[userId] === socket.id) {
              delete userSocketMap[userId];
              await User.findByIdAndUpdate(userId, {isOnline:false, lastSeen:new Date()});
              socket.broadcast.emit("user-offline", {userId, isOnline:false});
            }
          } catch (err) {
            console.error("Socket disconnect timeout error:", err);
          } finally {
            delete disconnectTimeouts[userId];
          }
        }, 8000); // 8-second grace period for page refreshes
      }
    });

    socket.on("call-user",({from,to,signalData})=>{
      try {
        console.log("call-user",from,to,signalData);
        io.to(userSocketMap[to]).emit("call-user",{user,signalData});
      } catch (err) {
        console.error("call-user socket error:", err);
      }
    })

    socket.on("end-call",({from,to,signalData})=>{
      try {
        console.log("end-call",from,to,signalData);
        io.to(userSocketMap[to]).emit("end-call",{user,signalData});
      } catch (err) {
        console.error("end-call socket error:", err);
      }
    })

    socket.on("call-accepted",({from,to})=>{
      try {
        console.log("call-accepted",from,to);
        io.to(userSocketMap[to]).emit("call-accepted",{user});
      } catch (err) {
        console.error("call-accepted socket error:", err);
      }
    })

    socket.on("call-declined",({from,to})=>{
      try {
        console.log("call-declined",from,to);
        io.to(userSocketMap[to]).emit("call-declined",{user});
      } catch (err) {
        console.error("call-declined socket error:", err);
      }
    })

    // WebRTC Signaling — relay SDP offer from caller to receiver
    socket.on("webrtc-offer", ({ to, offer }) => {
      try {
        console.log("webrtc-offer to:", to);
        io.to(userSocketMap[to]).emit("webrtc-offer", { from: userId, offer });
      } catch (err) {
        console.error("webrtc-offer socket error:", err);
      }
    });

    // WebRTC Signaling — relay SDP answer from receiver back to caller
    socket.on("webrtc-answer", ({ to, answer }) => {
      try {
        console.log("webrtc-answer to:", to);
        io.to(userSocketMap[to]).emit("webrtc-answer", { answer });
      } catch (err) {
        console.error("webrtc-answer socket error:", err);
      }
    });

    // WebRTC Signaling — relay ICE candidates between peers
    socket.on("ice-candidate", ({ to, candidate }) => {
      try {
        io.to(userSocketMap[to]).emit("ice-candidate", { candidate });
      } catch (err) {
        console.error("ice-candidate socket error:", err);
      }
    });

    // Typing indicators — relay to recipient
    socket.on("typing", ({ to }) => {
      try {
        if (userSocketMap[to]) {
          io.to(userSocketMap[to]).emit("typing", { from: userId });
        }
      } catch (err) {
        console.error("typing socket error:", err);
      }
    });

    socket.on("stop-typing", ({ to }) => {
      try {
        if (userSocketMap[to]) {
          io.to(userSocketMap[to]).emit("stop-typing", { from: userId });
        }
      } catch (err) {
        console.error("stop-typing socket error:", err);
      }
    });

    socket.on("message", async({recId,msg})=>{
      try {
        let conversation = await Conversation.findOne({participants:{$all:[userId,recId]}});

        if(!conversation){
          // Create new conversation with all required fields
          const unreadCountMap = new Map();
          unreadCountMap.set(userId, 0);      // Sender has 0 unread
          unreadCountMap.set(recId, 1);       // Receiver has 1 unread
          
          conversation = await Conversation.create({
            participants:[userId,recId],
            lastMessage:msg,
            lastMessageTime: new Date(),
            unreadCount: unreadCountMap
          });
        } else {
          // Increment receiver's unread count
          const currentCount = conversation.unreadCount.get(recId) || 0;
          conversation.unreadCount.set(recId, currentCount + 1);
          conversation.lastMessage = msg;
          conversation.lastMessageTime = new Date();
          await conversation.save();
        }

        await Message.create({sender:userId,receiver:recId,message:msg,conversation:conversation._id,isRead:false})

        io.to(userSocketMap[recId]).emit("receive",{sender:userId,msg})
      } catch (err) {
        console.error("message socket error:", err);
      }
    })

    socket.on("all-read", async({currentUserId, selectedUserId}) => {
      try {
        const conversation = await Conversation.findOne({
          participants: {$all: [currentUserId, selectedUserId]}
        });
        
        if(conversation){
          // Mark the CURRENT USER's unread messages as read in conversation
          conversation.unreadCount.set(currentUserId, 0);
          await conversation.save();
          
          // Mark all messages from selectedUserId to currentUserId as read
          await Message.updateMany(
            { sender: selectedUserId, receiver: currentUserId, isRead: false },
            { isRead: true }
          );

          // Notify the sender that their messages have been read
          io.to(userSocketMap[selectedUserId]).emit("messages-marked-read", {
            readBy: currentUserId,  // Who read the messages
            messagesFrom: selectedUserId  // Whose messages were read
          });
        }
      } catch (err) {
        console.error("all-read socket error:", err);
      }
    })

  });

  return io;
};

module.exports = socketConfig;
module.exports.userSocketMap = userSocketMap;
