const express = require("express");
const router = express.Router();
const {createMessage} = require("../controllers/messageController");
const {getMessages} = require("../controllers/messageController");

router.post("/message",createMessage);
router.get("/messages/:otherUserId",getMessages);

module.exports = router;            