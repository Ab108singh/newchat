const Message = require('../models/messageModel');
const Conversation = require('../models/conversationModel');
const { getIO } = require('../socket/socketInstance');
const cloudinary = require('../config/cloudinaryConfig');

const uploadImage = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'senderId and receiverId are required' });
    }

    // Upload buffer to Cloudinary using upload_stream (compatible with v2)
    const imageUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'chat-images', resource_type: 'image' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      const unreadCountMap = new Map();
      unreadCountMap.set(senderId, 0);
      unreadCountMap.set(receiverId, 1);

      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        lastMessage: '📷 Photo',
        lastMessageTime: new Date(),
        unreadCount: unreadCountMap
      });
    } else {
      const currentCount = conversation.unreadCount.get(receiverId) || 0;
      conversation.unreadCount.set(receiverId, currentCount + 1);
      conversation.lastMessage = '📷 Photo';
      conversation.lastMessageTime = new Date();
      await conversation.save();
    }

    // Save image message to DB
    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message: '',
      messageType: 'image',
      imageUrl,
      conversation: conversation._id,
      isRead: false
    });

    // Emit real-time image message to receiver
    const io = getIO();
    const { userSocketMap } = require('../config/socketConfig');
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive-image', {
        sender: senderId,
        imageUrl,
        messageId: message._id
      });
    }

    res.status(200).json({
      imageUrl,
      messageId: message._id,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
};

module.exports = { uploadImage };
