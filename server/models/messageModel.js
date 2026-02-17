const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    sender:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
    receiver:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
    message:{type:String,required:true},
    conversation:{type:mongoose.Schema.Types.ObjectId,ref:"Conversation"},
    isRead:{type:Boolean,default:false}
},{timestamps:true})

const Message = mongoose.model("Message",chatSchema);
module.exports = Message;  