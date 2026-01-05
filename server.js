const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));

let songs = [];
try {
    songs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));
} catch (err) {
    console.error("Error reading songs.json:", err);
}

let voteCount = 0;
let timer = 25;
let timerInterval;
let isVotingActive = false;
let currentPerformance = { singer: "", song: "" };

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/mobile.html'));
});

io.on('connection', (socket) => {
    socket.emit('performance-update', currentPerformance);
    if (isVotingActive) socket.emit('voting-start');

    socket.on('request-init', () => {
        socket.emit('init-data', { songs });
    });

    socket.on('add-song-to-file', (newSong) => {
        songs.push(newSong);
        fs.writeFile('songs.json', JSON.stringify(songs, null, 2), (err) => {
            if (err) console.error("Error saving new song to file:", err);
        });
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
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timer--;
            io.emit('timer-update', timer);
            if (timer <= 0) endVoting();
        }, 1000);
    });

    socket.on('cancel-voting', () => {
        clearInterval(timerInterval);
        isVotingActive = false;
        io.emit('voting-end', 0);
    });

    socket.on('cast-vote', () => {
        if (!isVotingActive) return;
        voteCount++;
        io.emit('count-update', voteCount);
        
        const connectedDevices = io.engine.clientsCount - 1;
        if (voteCount >= connectedDevices && connectedDevices > 0) {
            endVoting();
        }
    });

    function endVoting() {
        if (!isVotingActive) return;
        clearInterval(timerInterval);
        isVotingActive = false;
        io.emit('voting-end', voteCount);
    }
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
});
