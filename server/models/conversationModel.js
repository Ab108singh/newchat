const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
    participants:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    messages:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    }],
    lastMessage: {type: String, required: true},
    lastMessageTime: {type: Date, required: true},
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
    // Remove isRead - not needed with per-user counts
})

const Conversation = mongoose.model("Conversation",conversationSchema);
module.exports = Conversation;  
