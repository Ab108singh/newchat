const User = require("../models/userModel");
const Conversation = require("../models/conversationModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { getIO } = require("../socket/socketInstance");

// Fields to expose publicly (never expose password/email)
const PUBLIC_FIELDS = "name username avatar isOnline lastSeen bio";

/**
 * GET /api/user/users?userId=<id>
 * Returns ONLY users the requester has an existing conversation with,
 * enriched with lastMessage / lastMessageTime / unreadCount per conversation.
 */
const getAllUsers = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    // Find all conversations this user participates in
    const conversations = await Conversation.find({ participants: userId }).lean();

    if (conversations.length === 0) {
      return res.status(200).json({ message: "No contacts yet", users: [] });
    }

    // Build a map: otherUserId → conversation metadata
    const contactMeta = {};
    for (const conv of conversations) {
      const otherId = conv.participants.find(p => p.toString() !== userId);
      if (!otherId) continue;
      const key = otherId.toString();
      // keep the most-recent conversation if duplicates exist
      if (!contactMeta[key] || new Date(conv.lastMessageTime) > new Date(contactMeta[key].lastMessageTime)) {
        contactMeta[key] = {
          lastMessage: conv.lastMessage || '',
          lastMessageTime: conv.lastMessageTime || null,
          unreadCount: conv.unreadCount instanceof Map
            ? (conv.unreadCount.get(userId) || 0)
            : (conv.unreadCount?.[userId] || 0)
        };
      }
    }

    const contactIds = Object.keys(contactMeta);
    const users = await User.find({ _id: { $in: contactIds } })
      .select(PUBLIC_FIELDS)
      .lean();

    // Attach conversation metadata to each user
    const enriched = users.map(u => ({
      ...u,
      lastMessage: contactMeta[u._id.toString()]?.lastMessage || '',
      lastMessageTime: contactMeta[u._id.toString()]?.lastMessageTime || null,
      noofUnreadMessages: contactMeta[u._id.toString()]?.unreadCount || 0,
    }));

    // Sort: most recently messaged first
    enriched.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));

    return res.status(200).json({ message: "Users fetched successfully", users: enriched });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};


/**
 * GET /api/user/search?q=<query>&userId=<me>
 * Search users by username prefix (case-insensitive).
 * Excludes the requester and existing conversation contacts.
 */
const searchUsers = async (req, res) => {
  try {
    const { q, userId } = req.query;
    if (!q || q.trim().length < 1) {
      return res.status(200).json({ users: [] });
    }

    // Find existing contacts to exclude from results
    const conversations = await Conversation.find({ participants: userId }).lean();
    const existingContactIds = new Set(
      conversations.flatMap(c =>
        c.participants.map(p => p.toString()).filter(id => id !== userId)
      )
    );
    existingContactIds.add(userId); // also exclude self

    const users = await User.find({
      username: { $regex: `^${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, $options: "i" },
      _id: { $nin: [...existingContactIds] }
    })
      .select(PUBLIC_FIELDS)
      .limit(10)
      .lean();

    return res.status(200).json({ users });
  } catch (error) {
    console.error("searchUsers error:", error);
    return res.status(500).json({ message: "Search failed" });
  }
};

const verifyUser = async (req, res) => {
  try {
    let token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    let { id } = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(id).select(PUBLIC_FIELDS + " email");
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    return res.status(200).json({ message: "User verified successfully", user });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const refreshToken = async (req, res) => {
  try {
    let token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    let { id } = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(id).select(PUBLIC_FIELDS + " email");
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const isProduction = process.env.NODE_ENV === "production";
    let newAccessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({ message: "Token refreshed", user });
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const registerUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!username) return res.status(400).json({ message: "Username is required" });

    // Check uniqueness
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ message: "Email already in use" });

    const usernameExists = await User.findOne({ username: username.toLowerCase() });
    if (usernameExists) return res.status(400).json({ message: "Username already taken" });

    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ name, username, email, password: hashPassword });

    // Broadcast new user to all connected sockets (they can now be searched)
    const io = getIO();
    io.emit("user-joined", {
      _id: newUser._id,
      name: newUser.name,
      username: newUser.username,
      avatar: newUser.avatar,
      isOnline: newUser.isOnline,
    });

    return res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    console.error("registerUser error:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field === "username" ? "Username" : "Email"} already taken` });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "User not found" });

    const result = await bcrypt.compare(password, user.password);
    if (!result) return res.status(400).json({ message: "Invalid password" });

    const isProduction = process.env.NODE_ENV === "production";
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "24h" });
    const refreshTokenVal = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("accessToken", accessToken, {
      httpOnly: true, secure: isProduction,
      sameSite: isProduction ? "none" : "strict", maxAge: 24 * 60 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshTokenVal, {
      httpOnly: true, secure: isProduction,
      sameSite: isProduction ? "none" : "strict", maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return user without password
    const safeUser = await User.findById(user._id).select(PUBLIC_FIELDS + " email");
    return res.status(200).json({ message: "User logged in successfully", user: safeUser });
  } catch (error) {
    console.error("loginUser error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

const logoutUser = async (req, res) => {
  try {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Logout failed" });
  }
};

module.exports = { registerUser, loginUser, verifyUser, refreshToken, logoutUser, getAllUsers, searchUsers };