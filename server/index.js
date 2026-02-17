require("dotenv").config(); 
const express = require("express");
const cors = require('cors')
const connectToDB = require("./db/db");
const http = require("http");
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/userRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const socketConfig = require("./config/socketConfig");
const { setIO } = require("./socket/socketInstance");

const app = express();

app.use(cookieParser());

app.use(cors({
    origin:["http://localhost:5173","http://13.61.12.47:5173","http://13.61.12.47:5174"],
    credentials:true
}))

app.use(express.json()); 



app.use("/api/user",userRoutes)
app.use("/api/conversation",conversationRoutes)
app.use("/api/message",messageRoutes)

app.get("/",(req,res)=>{
    res.send("server is running");
})

const server = http.createServer(app);


const io = socketConfig(server);
setIO(io);




connectToDB().then(()=>{
    console.log("Connected to DB");
}).catch((err)=>{
    console.log(err);
});


server.listen(3000,console.log("server is listening on port 3000"))

module.exports = io;
