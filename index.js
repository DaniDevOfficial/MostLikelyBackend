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


const fs = require('fs');
const path = require('path');

// Function to create or append to a log file
function writeToLog(message) {
    const logFilePath = path.join(__dirname, 'logs', 'app.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    }); 
} 
writeToLog("Server Started");


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

function removeUserFromRoom(room, userId) {
    if (!rooms[room]) {
        return rooms[room];
    }
    const roomIndex = rooms[room].players.findIndex(player => player.playerId === userId);
    if (roomIndex === -1) {
        return rooms[room];
    }
    rooms[room].players.splice(roomIndex, 1);

    return rooms[room];
}

function getUserRooms(userId) {
    return userRooms[userId] || [];
}


io.on('connection', (socket) => {

    writeToLog('A user connected: ' + socket.id);
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        writeToLog('A user disconnected: ' + socket.id);

        const disconnectRooms = getUserRooms(socket.id);
        disconnectRooms.forEach(room => {
            socket.leave(room);
            const usersInRoom = getUsersInRoom(room);
            if (checkIfRoomIsEmpty(room)) {
                activeRooms.delete(room);
                writeToLog('room is empty and got deleted: ' + room);
                console.log('room is empty: ' + room);
            }

            const roomInformation = removeUserFromRoom(room, socket.id);
            io.to(room).emit('left', { roomInformation });
        });
        console.log("All now Active Rooms: ", activeRooms);
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
        writeToLog('New Room Created by: ' + socket.id + ". room ID: " + newRoom);
        io.to(socket.id).emit('created', newRoom);
    });

    socket.on('join', (room) => {
        if (activeRooms.has(room)) {
            socket.join(room);
            const usersInRoom = getUsersInRoom(room);
            console.log("users in room: " + room + " " + usersInRoom);
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
            rooms[roomId] = {
                game: {
                    settings: {
                        QuestionWriteTime: 120,
                        VoteTime: 30,
                        AmountOfQuestionsPerPlayer: 2,
                    },
                    state: "lobby",
                },
                players: [],
                questions: [],
            };
        }


        rooms[roomId].players.push({ name: user, profilePicture: profilePicture, playerId: socketId });
        const roomInformation = rooms[roomId];
        console.log("User in room " + roomId + " Created");
        writeToLog('User in room ' + roomId + ' Created, with name: ' + user);
        io.to(roomId).emit('user selected', roomInformation);
    });

    socket.on('settings update', (newSettings) => {
        const roomId = newSettings.roomId;
        if (!rooms[roomId]) {
            return;
        }
        const playerId = socket.id;
        const playerIndex = rooms[roomId].players.findIndex(player => player.playerId === playerId);
        // this is for security reasons, only the first player can change the settings (i hope leo doesnt find out how to glitch this)
        if (playerIndex !== 0) {

            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }
 

        const newSettingsData = newSettings.newSettings;
        console.log(newSettingsData)
        rooms[roomId].game.settings = newSettingsData;
        const newRoomData = rooms[roomId];
        console.log("Settings updated for room ", newSettingsData);
        writeToLog('Settings updated for room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', newRoomData);
    });




    socket.on('leave', (room) => {
        socket.leave(room);
        removeUserRoom(socket.id, room);
        const usersInRoom = getUsersInRoom(room);
        console.log(userRooms)
        if (checkIfRoomIsEmpty(room)) {
            activeRooms.delete(room);
            console.log('deleted room: ' + room);
        }

        if (rooms[room]) {

            const roomInformation = removeUserFromRoom(room, socket.id);
            console.log("Removed user information from room.");
            writeToLog('Removed user information from room: ' + room + ' by: ' + socket.id);
            io.to(room).emit('left', { roomInformation });

        } else {
            writeToLog('Room ' + room + ' does not exist. Yet someone tried to leave it.');
            console.log(`Room ${room} does not exist.`);
        }
    });



    socket.on('check if room exists', (room) => {
        if (activeRooms.has(room)) {
            writeToLog('Room ' + room + ' exists. Checked by: ' + socket.id);
            io.to(socket.id).emit('room exists', room);
        } else {
            writeToLog('Room ' + room + ' does not exist. Checked by: ' + socket.id);
            io.to(socket.id).emit('room does not exist', room);
        }
    });
}
);


server.listen(port, () => {
    console.log(`listening on Port ${port}`);
});  