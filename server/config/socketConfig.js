
const { Server } = require('socket.io');
const User = require('../models/userModel');
const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');

let userSocketMap = {};



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
    if(userId){
      user = await User.findById(userId);
    }
    if(userId){
        userSocketMap[userId] = socket.id;
        
        // Update user online status in database
        await User.findByIdAndUpdate(userId, {isOnline:true, lastSeen:new Date()});
        
        // Notify all other clients that this user is online
        socket.broadcast.emit("user-online", {userId, isOnline:true});
    }

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      if(userId){
        await User.findByIdAndUpdate(userId, {isOnline:false, lastSeen:new Date()});
        socket.broadcast.emit("user-offline", {userId, isOnline:false});
      }
    });
    socket.on("call-user",({from,to,signalData})=>{
      console.log("call-user",from,to,signalData);
      io.to(userSocketMap[to]).emit("call-user",{user,signalData});
    })

    socket.on("end-call",({from,to,signalData})=>{
      console.log("end-call",from,to,signalData);
      io.to(userSocketMap[to]).emit("end-call",{user,signalData});
    })

    socket.on("call-accepted",({from,to})=>{
      console.log("call-accepted",from,to);
      io.to(userSocketMap[to]).emit("call-accepted",{user});
    })

    socket.on("call-declined",({from,to})=>{
      console.log("call-declined",from,to);
      io.to(userSocketMap[to]).emit("call-declined",{user});
    })

    // WebRTC Signaling — relay SDP offer from caller to receiver
    socket.on("webrtc-offer", ({ to, offer }) => {
      console.log("webrtc-offer to:", to);
      io.to(userSocketMap[to]).emit("webrtc-offer", { from: userId, offer });
    });

    // WebRTC Signaling — relay SDP answer from receiver back to caller
    socket.on("webrtc-answer", ({ to, answer }) => {
      console.log("webrtc-answer to:", to);
      io.to(userSocketMap[to]).emit("webrtc-answer", { answer });
    });

    // WebRTC Signaling — relay ICE candidates between peers
    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(userSocketMap[to]).emit("ice-candidate", { candidate });
    });




    socket.on("message",  async({recId,msg})=>{


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

  })    


socket.on("all-read", async({currentUserId, selectedUserId}) => {
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
})

  });

  return io;
};

module.exports = socketConfig;

