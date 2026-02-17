const express = require("express");
const router = express.Router();
const {createConversation,deleteConversation,getConversations} = require("../controllers/conversationControllers");

router.post("/conversation",createConversation);
router.delete("/conversation/:conversationId",deleteConversation);
router.get("/conversations/:userId",getConversations);
module.exports = router;        