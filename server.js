const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;

let globalVoteCount = 0;
let isVotingActive = false;
let currentTimer = 0;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/mobile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mobile.html')));

io.on('connection', (socket) => {
    if (isVotingActive) {
        socket.emit('start-voting');
        socket.emit('timer-update', currentTimer);
        socket.emit('count-update', globalVoteCount);
    }

    socket.on('request-init', () => {
        try {
            const songData = JSON.parse(fs.readFileSync('./songs.json', 'utf8'));
            // localIp is left empty so the client uses its own browser URL for QR generation
            socket.emit('init-data', { songs: songData, localIp: "" });
        } catch (err) { 
            socket.emit('init-data', { songs: [], localIp: "" }); 
        }
    });

    socket.on('start-voting', () => {
        isVotingActive = true;
        globalVoteCount = 0; 
        currentTimer = 25;
        io.emit('count-update', 0);
        io.emit('start-voting');
        
        let interval = setInterval(() => {
            currentTimer--;
            io.emit('timer-update', currentTimer);
            if (currentTimer <= 0) {
                clearInterval(interval);
                isVotingActive = false;
                io.emit('voting-end', globalVoteCount); 
            }
        }, 1000);
    });

    socket.on('cast-vote', () => {
        if (isVotingActive) {
            globalVoteCount++;
            io.emit('count-update', globalVoteCount);
        }
    });
});

// Listen on 0.0.0.0 to allow connections from any device on the network
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KARAOCHAOS LIVE ON PORT ${PORT}`);
});
