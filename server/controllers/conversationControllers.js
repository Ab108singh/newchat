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
            .populate("messages")
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

module.exports = {getConversations,createConversation,deleteConversation};   