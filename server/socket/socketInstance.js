let io = null;

const setIO = (ioInstance) => {
  io = ioInstance;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { setIO, getIO };