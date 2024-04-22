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
const userRooms = {};
const rooms = {};

function getUsersInRoom(roomName) {
    const clients = io.sockets.adapter.rooms.get(roomName);
    if (!clients) {
        return [];
    }
    return Array.from(clients).map(socketId => io.sockets.sockets.get(socketId).id);
}

function generateRandomRoom() {
    const digits = 6;
    let room = '';
    for (let i = 0; i < digits; i++) {
        room += Math.floor(Math.random() * 10);
    }
    return room;
}

function addUserRoom(userId, roomId) {
    if (!userRooms[userId]) {
        userRooms[userId] = [roomId];
    } else {
        if (!userRooms[userId].includes(roomId)) {
            userRooms[userId].push(roomId);
        }
    }
}

function removeUserRoom(userId, roomId) {
    if (userRooms[userId]) {
        const index = userRooms[userId].indexOf(roomId);
        if (index !== -1) {
            userRooms[userId].splice(index, 1);
            if (userRooms[userId].length === 0) {
                delete userRooms[userId];
            }
        }
    }
}
function checkIfRoomIsEmpty(room) {
    const clients = io.sockets.adapter.rooms.get(room);
    if (!clients) {
        return true;
    }
    return Array.from(clients).length === 0;
}

function getUserRooms(userId) {
    return userRooms[userId] || [];
}


io.on('connection', (socket) => {


    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        const rooms = getUserRooms(socket.id);
        rooms.forEach(room => {
            socket.leave(room);
            const usersInRoom = getUsersInRoom(room);
            if (checkIfRoomIsEmpty(room)) {
                activeRooms.delete(room);
                console.log('room is empty: ' + room);
            }
            //  const roomIndex = rooms[room].findIndex(user => user[2] === socket.id);
            //  rooms[room].splice(roomIndex, 1);
            //  const users = rooms[room];
            io.to(room).emit('left', { room, users: usersInRoom });
        });
        delete userRooms[socket.id];
    });
    socket.on('create', () => {
        let newRoom = generateRandomRoom();
        while (activeRooms.has(newRoom)) {
            newRoom = generateRandomRoom();
        }
        socket.join(newRoom);
        activeRooms.add(newRoom);
        console.log('create room' + newRoom);
        io.to(socket.id).emit('created', newRoom);
    });

    socket.on('join', (room) => {
        if (activeRooms.has(room)) {
            socket.join(room);
            console.log(socket.rooms);
            const usersInRoom = getUsersInRoom(room);
            console.log("users in room: " + room + " " + usersInRoom);

            io.to(room).emit('joined', { room, users: usersInRoom });
            addUserRoom(socket.id, room);

        } else {
            io.to(socket.id).emit('room does not exist', room);
        }
    });

    socket.on('user selection', (data) => {
        const roomId = data.room;
        const user = data.name;
        const profilePicture = data.profilePicture;
        const socketId = socket.id;

        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push({ name: user, profilePicture: profilePicture, userId: socketId });
        const users = rooms[roomId];
        console.log(users);

        io.to(roomId).emit('user selected', users);
    });





    socket.on('leave', (room) => {
        socket.leave(room);
        removeUserRoom(socket.id, room);
        const usersInRoom = getUsersInRoom(room);
        if (checkIfRoomIsEmpty(room)) {
            activeRooms.delete(room);
            console.log('deleted room: ' + room);
        }
        // remove user from room
        //  const roomIndex = rooms[room].findIndex(user => user[2] === socket.id);
        //  rooms[room].splice(roomIndex, 1);
        //  const users = rooms[room];
        io.to(room).emit('left', { room, users: usersInRoom });
    });



    socket.on('check if room exists', (room) => {
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