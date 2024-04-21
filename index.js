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


io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
    });
    socket.on('join', (room) => {
        console.log('join room: ' + room);
        socket.join(room);
    });
    socket.on('message', (msg) => {
        console.log('message: ' + msg);
        socket.broadcast.emit('broadcast message', msg);
    }
    );
}
);


server.listen(port, () => {
    console.log(`listening on Port ${port}`);
});