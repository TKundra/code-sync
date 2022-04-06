const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/constants/Actions');

const server = http.createServer(app);
const io = new Server(server);

// serving build folder (production build)
app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {}; // fo now storing in-memory, better to store in db, redis, etc
function getAllConnectedClients(roomId) {
    // get allconnected users in that room (socket adapter)
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        };
    });
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id); // browser socket id

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => { // join emitted event listen here
        userSocketMap[socket.id] = username; // { 'socket_id': 'usrname' }
        socket.join(roomId); // join room
        const clients = getAllConnectedClients(roomId); // [{ socketId: '', username: '' }, {}, {}. ...]
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, { // to each client in array
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, { // notify on disconnect
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));