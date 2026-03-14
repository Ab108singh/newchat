const express = require("express");
const router = express.Router();
const {createConversation,deleteConversation,getConversations,deleteConversationByParticipants} = require("../controllers/conversationControllers");

router.post("/", createConversation);
router.delete("/by-participants", deleteConversationByParticipants);
router.delete("/:conversationId", deleteConversation);
router.get("/list/:userId", getConversations);
module.exports = router;