const Message = require("../models/messageModel");
const Conversation = require("../models/conversationModel");
const { getIO } = require("../socket/socketInstance");
const { userSocketMap } = require("../config/socketConfig");

const createMessage = async(req,res)=>{
    let data = req.body;
    try {
        const message = await Message.create(data);
        res.status(200).json(message);
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}

const getMessages = async(req,res)=>{
    try {
        const {otherUserId} = req.params;
        const currentUserId = req.user?._id; // Assuming you have auth middleware that sets req.user
        
        // If no auth middleware, you'll need to pass currentUserId differently
        // For now, let's accept it from query params as a fallback
        const userId = currentUserId || req.query.userId;
        
        if(!userId){
            return res.status(400).json({message:"User ID required"});
        }
        
        // Find conversation between the two users
        const conversation = await Conversation.findOne({
            participants: {$all: [userId, otherUserId]}
        });
        
        if(!conversation){
            // No conversation exists yet, return empty array
            return res.status(200).json([]);
        }
        
        // Fetch all messages for this conversation, excluding ones deleted for this user
        const messages = await Message.find({
            conversation: conversation._id,
            deletedFor: { $nin: [userId] }   // exclude msgs this user deleted for themselves
        }).sort({createdAt: 1});
            
        res.status(200).json(messages);
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}

// DELETE /api/message/messages
// Body: { messageIds: string[], deletedBy: string, otherId: string }
const deleteMessages = async (req, res) => {
    try {
        const { messageIds, deletedBy, otherId } = req.body;
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "messageIds array is required" });
        }

        // Delete the specified messages (any participant can delete messages they select)
        await Message.deleteMany({ _id: { $in: messageIds } });

        // Update conversation's lastMessage to reflect the actual last remaining message
        const conversation = await Conversation.findOne({
            participants: { $all: [deletedBy, otherId] }
        });
        if (conversation) {
            const lastMsg = await Message.findOne({ conversation: conversation._id })
                .sort({ createdAt: -1 });
            conversation.lastMessage = lastMsg ? (lastMsg.messageType === 'image' ? '📷 Photo' : lastMsg.message) : '';
            conversation.lastMessageTime = lastMsg ? lastMsg.createdAt : null;
            await conversation.save();
        }

        // Emit real-time deletion event to the other participant
        const io = getIO();
        const otherSocketId = userSocketMap[otherId];
        if (otherSocketId) {
            io.to(otherSocketId).emit("messages-deleted", { messageIds });
        }

        res.status(200).json({ message: "Messages deleted", messageIds });
    } catch (error) {
        console.error("deleteMessages error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// PATCH /api/message/delete-for-me
// Body: { messageIds: string[], userId: string }
const deleteForMe = async (req, res) => {
    try {
        const { messageIds, userId } = req.body;
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: "messageIds array is required" });
        }
        // Push userId into deletedFor for each message — message stays in DB for the other user
        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { deletedFor: userId } }
        );
        res.status(200).json({ message: "Messages hidden", messageIds });
    } catch (error) {
        console.error("deleteForMe error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {createMessage, getMessages, deleteMessages, deleteForMe};
