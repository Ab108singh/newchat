const express = require("express");
const router = express.Router();
const {createMessage} = require("../controllers/messageController");
const {getMessages} = require("../controllers/messageController");
const {uploadImage} = require("../controllers/uploadController");
const upload = require("../config/multerConfig");

router.post("/message",createMessage);
router.get("/messages/:otherUserId",getMessages);
router.post("/upload-image", upload.single('image'), uploadImage);

module.exports = router;