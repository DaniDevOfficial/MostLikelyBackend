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

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', (room) => {
        console.log('user disconnected: ' + socket.id);

    });
    socket.on('create', (room) => {
        console.log('create room: ' + room);
        socket.join(room);
        activeRooms.add(room);
        console.log(activeRooms);
    });

    socket.on('join', (room) => {
        console.log('join room: ' + room);
        if (activeRooms.has(room)) {
            socket.join(room);
            io.emit('joined', room);
        } else {
            console.log('Room does not exist: ' + room);
            io.emit('room does not exist', room);
        }
    });
    socket.on('check if room exists', (room) => {
        console.log('check if room exists: ' + room);
        if (activeRooms.has(room)) {
            io.emit('room exists', room);
            console.log('Was checked by ' + socket.id);
        } else {
            io.emit('room does not exist', room);
        }
    });
}
);


server.listen(port, () => {
    console.log(`listening on Port ${port}`);
});  