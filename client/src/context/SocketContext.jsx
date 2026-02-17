import { createContext,useEffect,useState,useContext } from "react";
import { io } from "socket.io-client";
import AuthContext from "./AuthContext";

const SocketContext = createContext();

export default SocketContext;


const SocketProvider = ({children})=>{
const {user} = useContext(AuthContext);
    const [socket,setSocket] = useState(null);


     useEffect(()=>{
      if(user){
         const socket = io("http://localhost:3000",{
            withCredentials:true,
            query:{
                userId:user?._id
            }   
        });
        socket.on("connect",()=>{
            console.log("Connected to server=>",socket.id);
        })
        setSocket(socket);  
        return ()=>socket.disconnect();
      } },[user])
   
    return(
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    )
}   

export {SocketProvider}
