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
    lastMessage: {type: String, default: ''},
    lastMessageTime: {type: Date, default: null},
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
})

const Conversation = mongoose.model("Conversation",conversationSchema);
module.exports = Conversation;  
