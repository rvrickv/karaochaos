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
let voters = new Set();

function loadSongs() {
    try {
        const data = fs.readFileSync('./songs.json', 'utf8');
        masterSongs = JSON.parse(data);
        console.log(`✅ Loaded ${masterSongs.length} songs.`);
    } catch (err) {
        console.error("❌ Error loading songs.json:", err);
        masterSongs = [];
    }
}
loadSongs();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/mobile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mobile.html')));

io.on('connection', (socket) => {
    socket.on('request-init', () => {
        socket.emit('init-data', { songs: masterSongs });
    });

    socket.on('add-song', (newSong) => {
        newSong.active = true; // Ensure it's active
        masterSongs.push(newSong);
        fs.writeFileSync('./songs.json', JSON.stringify(masterSongs, null, 4));
        io.emit('init-data', { songs: masterSongs }); // Broadcast update
    });

    socket.on('delete-song', (songTitle) => {
        const song = masterSongs.find(s => s.title === songTitle);
        if (song) {
            song.active = false; // "Comment out" logic
            fs.writeFileSync('./songs.json', JSON.stringify(masterSongs, null, 4));
            io.emit('init-data', { songs: masterSongs });
        }
    });

    socket.on('start-voting', () => {
        if (isVotingActive) return;
        isVotingActive = true;
        globalVoteCount = 0; 
        currentTimer = 25;
        voters.clear();
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

    socket.on('cast-vote', (fingerprint) => {
        if (isVotingActive && fingerprint && !voters.has(fingerprint)) {
            voters.add(fingerprint); 
            globalVoteCount++;
            io.emit('count-update', globalVoteCount);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KARAOCHAOS Admin Server running on port ${PORT}`);
});