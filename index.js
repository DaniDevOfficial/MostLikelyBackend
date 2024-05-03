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

let activeRooms = {}
let userRooms = {};
let rooms = {};
let connectedSockets = {};

const fs = require('fs');
const path = require('path');

// Function to create or append to a log file
function writeToLog(message) {
    const logFilePath = path.join(__dirname, 'logs', 'app.log');
    if (!fs.existsSync(path.join(__dirname, 'logs'))) {
        fs.mkdirSync(path.join(__dirname, 'logs'));
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}
writeToLog("Server Started");

function restartServer() {
    writeToLog("Server Restarted");
    console.log('Server Restarted')
    activeRooms = {};
    userRooms = {};
    rooms = {};
    io.emit('server restart');
}

function calculateTimeUntilRestart() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(3, 33, 0, 0);
    const timeUntilRestart = tomorrow - now;
    return timeUntilRestart;
}

// Schedule server restart every day at 00:00 UTC
function scheduleServerRestart() {
    const timeUntilRestart = calculateTimeUntilRestart();
    const warningInterval = 60000;

    for (let i = 10; i > 0; i--) {
        const warningTime = timeUntilRestart - (i * warningInterval);
        setTimeout(() => {
            console.log('Server will restart in', i, 'minutes');
            io.emit('restart warning', { timeUntilRestart: i * warningInterval });
        }, warningTime);
    }

    console.log('Server will restart in', timeUntilRestart, 'milliseconds');
    setTimeout(() => {
        restartServer();
        scheduleServerRestart();
    }, timeUntilRestart);
}

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



setInterval(() => {

    Object.keys(activeRooms).forEach(roomId => {
        const currentTime = new Date().getTime();
        console.log(checkIfActiveRoomIsEmpty(roomId))
        if (checkIfActiveRoomIsEmpty(roomId)) {
            delete activeRooms[roomId];
            delete rooms[roomId];
            console.log('Room deleted due to inactivity:', roomId);
            writeToLog('Room deleted due to inactivity: ' + roomId);
        }
        if (isRoomInactive(roomId, 15 * 60)) {
            delete activeRooms[roomId];
            delete rooms[roomId];
            console.log('Room deleted due to inactivity:', roomId);
            io.to(roomId).emit('room deleted', roomId);
            writeToLog('Room deleted due to inactivity: ' + roomId);
        }
    });
}, 60 * 1000);


function checkIfRoomIsEmpty(roomId) {
    const room = rooms[roomId];
    return room && room.players.length === 0;
}

function checkIfActiveRoomIsEmpty(roomId) {
    const clients = io.sockets.adapter.rooms.get(roomId);
    console.log("Clients in room: ", clients)
    if (!clients) {
        console.log("Room is empty: ", roomId)
        return true;
    }
    console.log("Room is not empty: ", roomId)
    return false;

}



/**
 * Checks if a room is inactive based on the provided maximum inactive time.
 *
 * @param {string} roomId - The ID of the room to check.
 * @param {number} maxInactiveTime - The maximum allowed inactive time in seconds.
 * @returns {boolean} Returns `true` if the room is inactive, `false` otherwise.
 */

function isRoomInactive(roomId, maxInactiveTime) {
    const currentTime = new Date();
    const lastUpdatedTime = new Date(activeRooms[roomId])
    const timeDifference = calculateSecondsBetweenDates(lastUpdatedTime, currentTime);
    if (timeDifference > maxInactiveTime) {
        console.log("Room is inactive: ", roomId)
        return true;
    } else {
        console.log("Room is active: ", roomId)
        return false;
    }
}
function calculateSecondsBetweenDates(date1, date2) {
    const date1Ms = date1.getTime();
    const date2Ms = date2.getTime();

    const differenceMs = Math.abs(date1Ms - date2Ms);

    const seconds = Math.floor(differenceMs / 1000);

    return seconds;
}

function updateLastUpdateDate(roomId) {
    activeRooms[roomId] = new Date();
}


function kickPlayer(playerId) {
    const socket = connectedSockets[playerId];
    if (socket) {
        // Emit a message to the player's socket to force disconnect
        socket.emit('room does not exist', 'You have been kicked from the game.');
        // Disconnect the player's socket
    }
}

io.on('connection', (socket) => {

    writeToLog('A user connected: ' + socket.id);
    console.log('a user connected: ' + socket.id);
    connectedSockets[socket.id] = socket;

    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        writeToLog('A user disconnected: ' + socket.id);

        const disconnectRooms = getUserRooms(socket.id);
        console.log("Rooms to disconnect: ", disconnectRooms)
        disconnectRooms.forEach(room => {
            socket.leave(room);
            console.log("User left room: " + room);
            writeToLog('User left room: ' + room + ' by: ' + socket.id);
            if (checkIfActiveRoomIsEmpty(room)) {
                delete activeRooms[room];
                delete rooms[room];
                writeToLog('room is empty and got deleted: ' + room);
                console.log('room is empty: ' + room);
            }

            const roomInformation = removeUserFromRoom(room, socket.id);
            io.to(room).emit('room information updated', roomInformation);
        });
        console.log("All now Active Rooms: ", activeRooms);
        delete connectedSockets[socket.id];
        delete userRooms[socket.id];
    });


    socket.on('create', () => {
        let newRoom = generateRandomRoom();
        while (activeRooms[newRoom]) {
            newRoom = Number(newRoom) + 1
            console.log('room already exists, creating new one: ' + newRoom)
        }
        socket.join(newRoom);
        activeRooms[newRoom] = new Date();
        console.log('create room', activeRooms);
        writeToLog('New Room Created by: ' + socket.id + ". room ID: " + newRoom);
        io.to(socket.id).emit('created', newRoom);
    });


    socket.on('join', (room) => {
        const usersRooms = getUserRooms(socket.id);
        usersRooms.forEach(userRoom => {
            if (userRoom !== room) {
                socket.leave(userRoom);
                removeUserRoom(socket.id, userRoom);
                console.log(`User ${socket.id} removed from non-existent room ${userRoom}`);
                if (checkIfRoomIsEmpty(userRoom)) {
                    delete activeRooms[userRoom];
                    delete rooms[userRoom];
                    writeToLog('room is empty and got deleted: ' + room);
                    console.log('room is empty: ' + room);
                } else {
                    const roomInformation = removeUserFromRoom(userRoom, socket.id);
                    console.log(roomInformation)
                    io.to(userRoom).emit('left', { roomInformation });
                }
            }
        });

        if (activeRooms[room]) {
            socket.join(room);
            const usersInRoom = getUsersInRoom(room);
            console.log("users in room: " + room + " " + usersInRoom);
            addUserRoom(socket.id, room);
        } else {
            io.to(socket.id).emit('room does not exist', room);
            usersRooms.forEach(userRoom => {
                socket.leave(userRoom);
                removeUserRoom(socket.id, userRoom);
            });
        }
    });


    socket.on('user selection', (data) => {
        const roomId = data.room;
        const user = data.name;
        const profilePicture = data.profilePicture;
        const socketId = socket.id;

        if (activeRooms[roomId] === undefined) {
            console.log("Room does not exist");
            writeToLog('Room does not exist: ' + roomId);
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }

        if (!rooms[roomId]) {
            rooms[roomId] = {
                roomId: roomId,
                game: {
                    settings: {
                        QuestionWriteTime: 5,
                        VoteTime: 5,
                        AmountOfQuestionsPerPlayer: 2,
                    },
                    state: "waiting",

                },
                players: [],
                questions: [],
                finishedWritingQuestions: [],
                voting: [
                    currentVoteId = 0,
                    currentVoteState = "voting",
                ],
            };
        }

        updateLastUpdateDate(roomId);
        rooms[roomId].players.push({ name: user, profilePicture: profilePicture, playerId: socketId, role: '' });
        const roomInformation = rooms[roomId];
        console.log("User in room " + roomId + " Created");
        writeToLog('User in room ' + roomId + ' Created, with name: ' + user);
        io.to(roomId).emit('room information updated', roomInformation);


    });

    socket.on('settings update', (newSettings) => {
        const roomId = newSettings.roomId;
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }
        const playerId = socket.id;
        const playerIndex = rooms[roomId].players.findIndex(player => player.playerId === playerId);
        // this is for security reasons, only the first player can change the settings (i hope leo doesnt find out how to glitch this)
        if (playerIndex !== 0) {
            writeToLog('User tried to change settings without being the host: ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }


        const newSettingsData = newSettings.newSettings;
        console.log(newSettingsData)
        updateLastUpdateDate(roomId);
        rooms[roomId].game.settings = newSettingsData;
        const newRoomData = rooms[roomId];
        console.log("Settings updated for room ", newSettingsData);
        writeToLog('Settings updated for room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', newRoomData);
    });


    socket.on('start game', (roomId) => {
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);

            return;
        }
        const playerId = socket.id;
        const playerIndex = rooms[roomId].players.findIndex(player => player.playerId === playerId);
        // this is for security reasons, only the first player can change the settings (i hope leo doesnt find out how to glitch this)
        if (playerIndex !== 0) {
            writeToLog('User tried to start game without being the host: ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }
        rooms[roomId].game.state = "questionWriteTime";
        updateLastUpdateDate(roomId);
        const roomInformation = rooms[roomId];
        console.log("Game started for room ", roomId);
        writeToLog('Game started for room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', roomInformation);

        const questionWriteTime = rooms[roomId].game.settings.QuestionWriteTime * 1000;
        console.log("Question Write Time: " + questionWriteTime);
        setTimeout(() => {
            console.log("Question Write Time Over for room " + roomId);
            writeToLog('Question Write Time Over for room ' + roomId);
            updateLastUpdateDate(roomId);
            io.to(roomId).emit('finish writing questions', rooms[roomId]);
        }, questionWriteTime);
    });

    socket.on('player finished writing', (questionsWithRoomId) => {
        const roomId = questionsWithRoomId.roomId;
        const playerId = socket.id;
        const questions = questionsWithRoomId.questions;

        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }

        updateLastUpdateDate(roomId);
        if (!rooms[roomId].finishedWritingQuestions) {
            rooms[roomId].finishedWritingQuestions = [];
        }
        if (rooms[roomId].finishedWritingQuestions.includes(playerId)) {
            return;
        }

        rooms[roomId].finishedWritingQuestions.push(playerId);
        rooms[roomId].questions.push(...questions);
        if (rooms[roomId].finishedWritingQuestions.length === rooms[roomId].players.length) {
            console.log("All players finished writing questions for room ", roomId);
            writeToLog('All players finished writing questions for room ' + roomId);

            rooms[roomId].game.state = "questionVoteTime";
            // shuffle questions
            rooms[roomId].questions.sort(() => Math.random() - 0.5);
            rooms[roomId].questions = rooms[roomId].questions.map((question, index) => ({
                id: index,
                ...question
            }));

            if (rooms[roomId].questions.length <= 0) {
                rooms[roomId].questions = [{ id: 0, question: "No questions were written" }];
            }
            io.to(roomId).emit('room information updated', rooms[roomId]);
            const voteTime = rooms[roomId].game.settings.VoteTime * 1000;
            const forWhichQuestion = rooms[roomId].voting[0];
            console.log("Question to vote for: ", forWhichQuestion)
            // initial voting timer
            setTimeout(() => {
                console.log("Voting time Over for Room " + roomId);
                writeToLog('Voting time Over for Room ' + roomId);
                updateLastUpdateDate(roomId);
                io.to(roomId).emit('finish voting', forWhichQuestion);
            }, voteTime);
        } else {
            console.log("Player finished writing questions for room ", roomId);
            writeToLog('Player finished writing questions for room ' + roomId + ' by: ' + socket.id);
            io.to(roomId).emit('room information updated', rooms[roomId]);
        }
    });

    socket.on('vote', (voteData) => {
        const roomId = voteData.roomId;
        const playerId = socket.id;
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }
        const vote = voteData.vote;
        const questionId = voteData.questionId;
        const currentQuestion = rooms[roomId].questions.find(question => question.id === questionId);
        if (!currentQuestion) {
            return;
        }
        updateLastUpdateDate(roomId);
        if (currentQuestion.votes?.some(vote => vote.fromWhoId === playerId)) {
            console.log("Player already voted for this question ", playerId);
            return;

        } else {


            if (!currentQuestion.votes) {
                currentQuestion.votes = [];
            }
            if (vote) {
                currentQuestion.votes.push(vote);
            }
        }
        if (currentQuestion.votes.length === rooms[roomId].players.length) {
            console.log(currentQuestion)

            rooms[roomId].voting[1] = "finished";
            writeToLog('All players voted for question ' + questionId + ' in room ' + roomId);
            io.to(roomId).emit('room information updated', rooms[roomId]);

            return;
        } else {
            console.log("Player voted for room ", roomId);
            writeToLog('Player voted for room ' + roomId + ' by: ' + socket.id);
            io.to(roomId).emit('room information updated', rooms[roomId]);
        }


    });

    socket.on('next vote', (roomId) => {
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }
        updateLastUpdateDate(roomId);
        if (socket.id !== rooms[roomId].players[0].playerId) {
            console.log("Player tried to start next vote without being the host: ", socket.id);
            writeToLog('Player tried to start next vote without being the host: ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }
        const amountOfQuestions = rooms[roomId].questions.length;
        console.log(amountOfQuestions)
        if (rooms[roomId].voting[0] === amountOfQuestions - 1) {
            rooms[roomId].game.state = "ended";
            console.log("Game ended for room ", roomId);
            writeToLog('Game ended for room ' + roomId + ' by: ' + socket.id);
            io.to(roomId).emit('room information updated', rooms[roomId]);
            return;
        }
        rooms[roomId].voting[0]++;
        rooms[roomId].voting[1] = "voting";
        console.log("Next vote for room ", roomId);
        writeToLog('Next vote for room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', rooms[roomId]);
        const voteTime = rooms[roomId].game.settings.VoteTime * 1000;
        const forWhichQuestion = rooms[roomId].voting[0];
        setTimeout(() => {
            console.log("Voting time Over for Room " + roomId);
            writeToLog('Voting time Over for Room ' + roomId);
            updateLastUpdateDate(roomId);
            io.to(roomId).emit('finish voting', forWhichQuestion);
        }, voteTime);
    });

    socket.on('kick player', (kickData) => {
        const roomId = kickData.roomId;
        const playerId = kickData.playerId;
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);
            return;
        }
        if (socket.id !== rooms[roomId].players[0].playerId) {
            console.log("Player tried to kick someone without being the host: ", socket.id);
            writeToLog('Player tried to kick someone without being the host: ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }

        if (socket.id === playerId) {
            console.log("Player tried to kick himself: ", socket.id);
            writeToLog('Player tried to kick himself (how tf did you do that): ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }

        const playerIndex = rooms[roomId].players.findIndex(player => player.playerId === playerId);
        if (playerIndex === -1) {
            return;
        }
        updateLastUpdateDate(roomId);
        removeUserRoom(playerId, roomId);
        kickPlayer(playerId);

        rooms[roomId].players.splice(playerIndex, 1);
        const roomInformation = rooms[roomId];
        console.log("Player kicked from room ", roomId);
        writeToLog('Player: ' + playerId + ' kicked from room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', roomInformation);
    });

    socket.on('reset game', (roomId) => {
        if (!rooms[roomId]) {
            io.to(socket.id).emit('room does not exist', roomId);

            return;
        }
        updateLastUpdateDate(roomId);

        const playerId = socket.id;
        const playerIndex = rooms[roomId].players.findIndex(player => player.playerId === playerId);
        // this is for security reasons, only the first player can change the settings (i hope leo doesnt find out how to glitch this)
        if (playerIndex !== 0) {
            writeToLog('User tried to reset game without being the host: ' + socket.id);
            io.to(socket.id).emit('room information updated', rooms[roomId]);
            return;
        }
        rooms[roomId].game.state = "waiting";
        rooms[roomId].questions = [];
        rooms[roomId].finishedWritingQuestions = [];
        rooms[roomId].voting = [
            currentVoteId = 0,
            currentVoteState = "voting",
        ];
        console.log("Game reset for room ", roomId);
        console.log(rooms[roomId])
        writeToLog('Game reset for room ' + roomId + ' by: ' + socket.id);
        io.to(roomId).emit('room information updated', rooms[roomId]);
    });

    socket.on('leave', (room) => {
        socket.leave(room);
        removeUserRoom(socket.id, room);

        if (checkIfActiveRoomIsEmpty(room)) {
            delete activeRooms[room];
            console.log('deleted room: ' + room);
        }

        if (rooms[room]) {

            const playerIndex = rooms[room].players.findIndex(player => player.playerId === socket.id);
            if (playerIndex !== -1) {
                rooms[room].players.splice(playerIndex, 1);
            }
            console.log("Removed user information from room.");
            writeToLog('Removed user information from room: ' + room + ' by: ' + socket.id);
            io.to(room).emit('room information updated', rooms[room]);

        } else {
            writeToLog('Room ' + room + ' does not exist. Yet someone tried to leave it.');
            console.log(`Room ${room} does not exist.`);
        }
    });



    socket.on('check if room exists', (room) => {
        if (activeRooms[room]) {
            writeToLog('Room ' + room + ' exists. Checked by: ' + socket.id);
            io.to(socket.id).emit('room exists', room);
        } else {
            writeToLog('Room ' + room + ' does not exist. Checked by: ' + socket.id);
            io.to(socket.id).emit('room does not exist', room);
        }
    });
}
);

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    writeToLog('Uncaught Exception: ' + err.stack);
    process.exit(1); // Exit the process due to the uncaught exception
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    writeToLog('Unhandled Rejection: ' + reason.stack || reason);
});

server.listen(port, '0.0.0.0', () => {
    console.log(`listening on Port ${port}`);

    scheduleServerRestart();
});  