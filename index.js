const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

app.use(cors());


const port = process.env.PORT || 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

const activeRooms = new Set();

function getUsersInRoom(roomName) {
    const clients = io.sockets.adapter.rooms.get(roomName);
    if (!clients) {
        return [];
    }
    return Array.from(clients).map(socketId => io.sockets.sockets.get(socketId).id);
}

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);

    });
    socket.on('create', (room) => {
        console.log('create room: ' + room);
        let newRoom = generateRandomRoom();
        while (activeRooms.has(newRoom)) {
            newRoom = generateRandomRoom();
        }
        socket.join(newRoom);
        activeRooms.add(newRoom);
        console.log(activeRooms);
        io.to(socket.id).emit('created', newRoom); // Emit to specific user id
    });

    function generateRandomRoom() {
        const digits = 6;
        let room = '';
        for (let i = 0; i < digits; i++) {
            room += Math.floor(Math.random() * 10);
        }
        return room;
    }

    socket.on('join', (room) => {
        console.log('join room: ' + room);
        if (activeRooms.has(room)) {
            socket.join(room);
            const usersInRoom = getUsersInRoom(room);
            io.to(room).emit('joined', { room, users: usersInRoom });
        } else {
            io.to(socket.id).emit('room does not exist', room);
        }
    });


    socket.on('check if room exists', (room) => {
        console.log('check if room exists: ' + room);
        if (activeRooms.has(room)) {
            io.to(socket.id).emit('room exists', room);
        } else {
            io.to(socket.id).emit('room does not exist', room);
        }
    });
}
);


server.listen(port, () => {
    console.log(`listening on Port ${port}`);
});  