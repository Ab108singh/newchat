const messageModel = require("../models/messageModel");
const Conversation = require("../models/conversationModel");

// const getConversation = async(req,res)=>{
//     try {
//         const {userId,recId} = req.params;
//         const conversation = await Conversation.findOne({participants:{$all:[userId,recId]}}).populate("messages");
//         res.status(200).json(conversation);
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({message:"Internal server error"});
//     }
// }

const getConversations = async(req,res)=>{
    try {
        const {userId} = req.params;
        // Use $in to find conversations where userId is in the participants array
        const conversations = await Conversation.find({participants: userId})
            .lean(); // Convert to plain object - Map is automatically converted
        
        res.status(200).json(conversations);
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}

const createConversation = async(req,res)=>{
    try {
        const {sender,receiver} = req.body;
        const conversation = await Conversation.create({participants:[sender,receiver]});
        res.status(200).json(conversation);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}



const deleteConversation = async(req,res)=>{
    try {
        const {conversationId} = req.params;
        await messageModel.deleteMany({conversation:conversationId});
        const conversation = await Conversation.findByIdAndDelete(conversationId);
        res.status(200).json(conversation);
        
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Internal server error"});
    }
}

// DELETE /api/conversation/by-participants?userId=<me>&otherId=<them>
const deleteConversationByParticipants = async (req, res) => {
    try {
        const { userId, otherId } = req.query;
        if (!userId || !otherId) {
            return res.status(400).json({ message: "userId and otherId are required" });
        }
        const conversation = await Conversation.findOne({
            participants: { $all: [userId, otherId] }
        });
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        await messageModel.deleteMany({ conversation: conversation._id });
        await Conversation.findByIdAndDelete(conversation._id);
        res.status(200).json({ message: "Conversation deleted" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {getConversations, createConversation, deleteConversation, deleteConversationByParticipants};