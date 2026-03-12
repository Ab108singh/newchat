import { createContext, useState } from "react";

const AuthContext = createContext();

export default AuthContext;

const AuthProvider = ({ children }) => {
    // Restore user from localStorage immediately so socket connects on refresh
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem('chat_user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(true); // true until auth verify completes

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('chat_user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('chat_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, setLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export { AuthProvider };