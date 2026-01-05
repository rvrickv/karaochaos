const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static('public'));

// Load songs from JSON
let songs = [];
try {
    songs = JSON.parse(fs.readFileSync('songs.json', 'utf8'));
} catch (err) {
    console.error("Error loading songs.json:", err);
}

// Game State Tracking
let voteCount = 0;
let timer = 25;
let timerInterval;
let currentPerformance = { singer: "", song: "" };
let isVotingActive = false;

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/mobile.html'));
});

io.on('connection', (socket) => {
    // Immediately sync new connections with current game state
    socket.emit('performance-update', currentPerformance);
    if (isVotingActive) socket.emit('voting-start');

    // Handle initial data request from TV
    socket.on('request-init', () => {
        socket.emit('init-data', { songs });
    });

    // Update what is currently being performed
    socket.on('update-performance', (data) => {
        currentPerformance = data;
        io.emit('performance-update', data);
    });

    // Triggered when "Nailed It" is pressed on TV
    socket.on('start-voting', () => {
        voteCount = 0;
        timer = 25;
        isVotingActive = true;
        
        io.emit('voting-start');
        io.emit('count-update', 0);
        
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timer--;
            io.emit('timer-update', timer);
            if (timer <= 0) {
                endVoting();
            }
        }, 1000);
    });

    // Explicitly kill voting state (Used for the "Quitter" path)
    socket.on('cancel-voting', () => {
        clearInterval(timerInterval);
        isVotingActive = false;
        io.emit('voting-end', 0); // Tells mobile to hide buttons immediately with 0 bonus
    });

    // Handle incoming votes from mobile remotes
    socket.on('cast-vote', () => {
        if (!isVotingActive) return;
        
        voteCount++;
        io.emit('count-update', voteCount);

        // Auto-end if everyone has voted 
        // (Total clients minus the one TV/Admin socket)
        const connectedDevices = io.engine.clientsCount - 1; 
        if (voteCount >= connectedDevices && connectedDevices > 0) {
            endVoting();
        }
    });

    function endVoting() {
        if (!isVotingActive) return;
        
        clearInterval(timerInterval);
        isVotingActive = false;
        
        // Award 1 bonus point per vote cast (1:1 Ratio)
        const bonus = voteCount; 
        io.emit('voting-end', bonus);
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`
    ====================================
    KARAOCHAOS SERVER ACTIVE
    Port: ${PORT}
    Admin URL: http://localhost:${PORT}
    Mobile URL: http://localhost:${PORT}/mobile
    ====================================
    `);
});