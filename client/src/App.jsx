import React, { useEffect } from 'react'
import AppRoutes from './Routes'
import { SocketProvider } from './context/SocketContext'
import axios from 'axios'
import { useContext } from 'react'
import AuthContext from './context/AuthContext'
const App = () => {

  const {login} = useContext(AuthContext);

  useEffect(() => {
    axios.get("http://localhost:3000/api/user/verify",{
      withCredentials:true
    }).then((res)=>{
      login(res.data.user); 
    }).catch((err)=>{
      console.log(err.response);
    })
    
  }, []);

  return (
    <SocketProvider>  
      <AppRoutes/>
    </SocketProvider>
    
)
}

export default App