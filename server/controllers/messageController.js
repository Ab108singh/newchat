const Message = require("../models/messageModel");
const Conversation = require("../models/conversationModel");

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
        
        // Fetch all messages for this conversation
        const messages = await Message.find({conversation: conversation._id})
            .sort({createdAt: 1}); // Sort by oldest first
            
        res.status(200).json(messages);
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}

module.exports = {createMessage,getMessages};

