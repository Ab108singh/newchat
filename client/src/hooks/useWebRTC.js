import {useRef,useEffect,useState} from 'react';


export const useWebRTC = (socket,userId,selectedUser) => {


    const makeCall = () => {
        if (!socket) return;
        socket.emit("call-user", {
            from: userId,
            to:selectedUser._id,
            signalData: {}
        });
    }

    const stopCall = () => {
        if (!socket) return;
        socket.emit("end-call", {
            from: userId,
            to:selectedUser._id,
            signalData: {}
        });
    }

    return {
      makeCall,
      stopCall
    }
    
}