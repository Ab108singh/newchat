const express = require("express");
const router = express.Router();
const { registerUser, loginUser, verifyUser, refreshToken, logoutUser,getAllUsers } = require("../controllers/userControllers");


router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verifyUser);
router.post("/refresh", refreshToken);
router.post("/logout", logoutUser);
router.get("/users",getAllUsers);
module.exports = router;    