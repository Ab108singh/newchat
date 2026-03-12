import React, { useEffect, useContext } from 'react'
import AppRoutes from './Routes'
import { SocketProvider } from './context/SocketContext'
import axios from 'axios'
import AuthContext from './context/AuthContext'

const App = () => {
  const { login, setLoading } = useContext(AuthContext);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/user/verify`, {
      withCredentials: true
    }).then((res) => {
      login(res.data.user);
    }).catch((err) => {
      console.log(err.response);
      // Clear stale localStorage data if token is expired/invalid
      logout();
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <SocketProvider>
      <AppRoutes />
    </SocketProvider>
  );
};

export default App;