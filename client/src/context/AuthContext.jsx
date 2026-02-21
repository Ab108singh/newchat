import { createContext, useEffect, useState } from "react";

const AuthContext = createContext();

export default AuthContext;

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // true until auth check completes

    const login = (user) => {
        setUser(user);
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, setLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthProvider };