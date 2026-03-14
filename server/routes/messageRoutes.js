const express = require("express");
const router = express.Router();
const {createMessage, getMessages, deleteMessages, deleteForMe} = require("../controllers/messageController");
const {uploadImage} = require("../controllers/uploadController");
const upload = require("../config/multerConfig");

router.post("/message",createMessage);
router.get("/messages/:otherUserId",getMessages);
router.delete("/messages", deleteMessages);
router.patch("/delete-for-me", deleteForMe);

// BUG-10: Multer errors (wrong type, too large) are caught and returned as clean 400s
router.post("/upload-image", (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, uploadImage);

module.exports = router;