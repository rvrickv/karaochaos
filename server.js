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
let masterSongs = [];
let voters = new Set(); // Stores unique fingerprints per round

try {
    masterSongs = JSON.parse(fs.readFileSync('./songs.json', 'utf8'));
    console.log(`✅ Loaded ${masterSongs.length} songs.`);
} catch (err) {
    console.error("❌ Error loading songs.json:", err);
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/mobile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mobile.html')));

io.on('connection', (socket) => {
    socket.on('request-init', () => {
        socket.emit('init-data', { songs: masterSongs });
    });

    socket.on('start-voting', () => {
        if (isVotingActive) return;
        isVotingActive = true;
        globalVoteCount = 0; 
        currentTimer = 25;
        voters.clear(); // Reset the bouncer list
        
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

    // The logic that stops the cheating
    socket.on('cast-vote', (fingerprint) => {
        // Check if voting is active AND a fingerprint was actually sent
        if (isVotingActive && fingerprint && !voters.has(fingerprint)) {
            voters.add(fingerprint); 
            globalVoteCount++;
            io.emit('count-update', globalVoteCount);
            console.log(`✅ Valid vote: ${fingerprint}`);
        } else {
            console.log(`❌ Vote rejected. Active: ${isVotingActive}, New: ${!voters.has(fingerprint)}`);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});