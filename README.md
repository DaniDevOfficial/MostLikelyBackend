# WhoWouldDoIt Backend

WhoWouldDoIt Backend is a Socket.io Backend for my multiplayer game. It is hosted on [Render.com](https://render.com/) 



## Installation

For the installation you simply need to run 
```bash
npm install
```

If you want to change the CORS you can do it in the index.js file: 
```javascript
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
```

## Usage

### All the Socket Events

```javascript
    io.on('connection', (socket) => {

    socket.on('disconnect', () => {

    socket.on('create', () => {

    socket.on('join', (room) => {

    socket.on('user selection', (data) => {

    socket.on('settings update', (newSettings) => {

    socket.on('start game', (roomId) => {

    socket.on('player finished writing', (questionsWithRoomId) => {

    socket.on('vote', (voteData) => {

    socket.on('next vote', (roomId) => {

    socket.on('kick player', (kickData) => {

    socket.on('reset game', (roomId) => {

    socket.on('leave', (room) => {

    socket.on('check if room exists', (room) => {

```

If you want to work on this for yourself i must warn you because all the code in in a Single 600 Lines file, so have fun 😊😊.


## What does it do?

Its a Socket.Io Backend which manages all the game data for the Frontend. 

### Removing inacvite Rooms 

If a lobby is inacvite for longer than 15 Minutes straight the lobby gets simply closed and all the players get kicked:

``` javascript
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

```
There are many more small optimisation thigs, but on their own not as important, like removing a room if all players quit form it. The host can also kick players from the lobby. 

## Dockerize

You can use this Backend in a Dockercontainer with these commands:

```bash
docker build -t mostlikelybackend .

docker run -d -p 3000:3000 mostlikelybackend
```

## License

You are allowed to change it etc, but you need to give @DaniDevOfficial visible Credit and also with a link to the original. 