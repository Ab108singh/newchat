const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {getIO} = require("../socket/socketInstance");

const getAllUsers = async(req,res)=>{   
    try {
        let users = await User.find();
        return res.status(200).json({message:"Users fetched successfully",users:users});
    } catch (error) {
        return res.status(500).json({message:"Failed to fetch users"});
    }
}   

const verifyUser = async(req,res)=>{
   try {
    let token = req.cookies.accessToken;
    if(!token){
        return res.status(401).json({message:"Unauthorized"});
    }
    let {id} = jwt.verify(token,process.env.JWT_SECRET);
    let user = await User.findById(id);
    if(!user){
        return res.status(401).json({message:"Unauthorized"});
    }
    req.user = user;
    return res.status(200).json({message:"User verified successfully",user:user});
   } catch (error) {
    return res.status(401).json({message:"Unauthorized"});
   }
}

const refreshToken = async(req,res)=>{
    try {
        let token = req.cookies.refreshToken;
    if(!token){
        return res.status(401).json({message:"Unauthorized"});
    }
    let {id} = jwt.verify(token,process.env.JWT_SECRET);
    let user = await User.findById(id);
    if(!user){
        return res.status(401).json({message:"Unauthorized"});
    }
    let newAccessToken = jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"1h"});
    res.cookie("accessToken",newAccessToken,{
        httpOnly:true,
        secure:false,
        // sameSite:"strict",
        maxAge:24*60*60*1000
    })
    return res.status(200).json({message:"User verified successfully",user:user});
   
    } catch (error) {
        return res.status(401).json({message:"Unauthorized"});
    }
}


const registerUser = async(req,res)=>{
    let data = req.body;
    
    let user = await User.findOne({email:data.email});
    if(user){
        return res.status(400).json({message:"User already exists"});
    }
    let hashPassword = await bcrypt.hash(data.password,10);
    
    
    let newUser = await User.create({...data,password:hashPassword});
    const io = getIO();
    io.emit("user-joined",newUser);

 res.status(201).json({message:"User registered successfully",user:newUser});
}

const loginUser = async(req,res)=>{
    let data = req.body;
    // console.log(data)
    
    let user = await User.findOne({email:data.email}).select("+password");
   

    if(!user){
        return res.status(400).json({message:"User not found"});
    }
     
    let result = await bcrypt.compare(data.password,user.password);
    if(!result){
        return res.status(400).json({message:"Invalid password"});
    }

    const accessToken = jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"24h"});
    const refreshToken = jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"7d"});
    
    res.cookie("accessToken",accessToken,{
        httpOnly:true,
        secure:false,//for development
        sameSite:"strict",
        maxAge:24*60*60*1000
    })
    res.cookie("refreshToken",refreshToken,{
        httpOnly:true,
        secure:false,//for development
        sameSite:"strict",
        maxAge:7*24*60*60*1000
    })

    res.status(200).json({message:"User logged in successfully",user:user});
}

const logoutUser = async(req,res)=>{
    try {
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        return res.status(200).json({message:"User logged out successfully"});
    } catch (error) {
        return res.status(500).json({message:"Logout failed"});
    }
}

module.exports = {registerUser,loginUser,verifyUser,refreshToken,logoutUser,getAllUsers}   