const mongoose = require("mongoose");

async function connectToDB(){
    try {
        await mongoose.connect(process.env.MONGO_URL);
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error.message);
        throw error; // Re-throw so the caller knows DB is unavailable
    }
}

module.exports = connectToDB;
