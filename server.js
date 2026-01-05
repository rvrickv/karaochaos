const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));

let songs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));
let voteCount = 0;
let timer = 25;
let timerInterval;

let currentPerformance = { singer: "", song: "" };
let isVotingActive = false;

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/mobile.html'));
});

io.on('connection', (socket) => {
    socket.emit('performance-update', currentPerformance);
    if (isVotingActive) socket.emit('voting-start');

    socket.on('request-init', () => {
        socket.emit('init-data', { songs });
    });

    socket.on('update-performance', (data) => {
        currentPerformance = data;
        io.emit('performance-update', data);
    });

    socket.on('start-voting', () => {
        voteCount = 0;
        timer = 25;
        isVotingActive = true;
        io.emit('voting-start');
        io.emit('count-update', 0); // Reset count on screens
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timer--;
            io.emit('timer-update', timer);
            if (timer <= 0) {
                endVoting();
            }
        }, 1000);
    });

    socket.on('cast-vote', () => {
        if (!isVotingActive) return;
        voteCount++;
        io.emit('count-update', voteCount);

        // Auto-end if everyone voted (excluding the main TV/admin socket)
        const connectedDevices = io.engine.clientsCount - 1; 
        if (voteCount >= connectedDevices && connectedDevices > 0) {
            endVoting();
        }
    });

    function endVoting() {
        if (!isVotingActive) return;
        clearInterval(timerInterval);
        isVotingActive = false;
        // Award 1 point per vote cast
        const bonus = voteCount; 
        io.emit('voting-end', bonus);
    }
});

http.listen(3000, () => {
    console.log('Server running on port 3000');
});