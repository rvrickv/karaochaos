const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = 3000;

// Global Game State
let globalVoteCount = 0;
let isVotingActive = false;
let currentTimer = 0;
let masterSongs = [];

// --- BOOT SEQUENCE: LOAD SONGS INTO MEMORY ---
// We do this once at startup to save the Pi Zero W's CPU/Disk during the game
try {
    const songPath = path.join(__dirname, 'songs.json');
    if (fs.existsSync(songPath)) {
        masterSongs = JSON.parse(fs.readFileSync(songPath, 'utf8'));
        console.log(`✅ SUCCESS: Loaded ${masterSongs.length} songs from songs.json`);
    } else {
        console.log("⚠️ WARNING: songs.json not found. Starting with empty library.");
    }
} catch (err) {
    console.error("❌ ERROR: Could not parse songs.json:", err);
}

// --- MIDDLEWARE & ROUTING ---
// Serve static files (CSS, Client JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Dashboard (TV Display)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Audience Controller
app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log(`📱 New Connection: ${socket.id}`);

    // If a player joins mid-vote, sync their screen immediately
    if (isVotingActive) {
        socket.emit('start-voting');
        socket.emit('timer-update', currentTimer);
        socket.emit('count-update', globalVoteCount);
    }

    // Provide the game data to the dashboard when it loads
    socket.on('request-init', () => {
        socket.emit('init-data', { 
            songs: masterSongs, 
            localIp: "" // Client uses window.location.origin for QR generation
        });
    });

    // Handle the 25-second voting window
    socket.on('start-voting', () => {
        if (isVotingActive) return; // Prevent double-triggering

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
                // Send final vote count to Dashboard for bonus calculation
                io.emit('voting-end', globalVoteCount); 
            }
        }, 1000);
    });

    // Handle individual votes from mobile devices
    socket.on('cast-vote', () => {
        if (isVotingActive) {
            globalVoteCount++;
            io.emit('count-update', globalVoteCount);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Disconnected: ${socket.id}`);
    });
});

// --- START SERVER ---
// Listen on 0.0.0.0 to ensure it's accessible via the Pi's Hotspot
server.listen(PORT, '0.0.0.0', () => {
    console.log('---------------------------------------');
    console.log(`🚀 KARAOCHAOS LIVE ON PORT ${PORT}`);
    console.log(`🔗 Dashboard: http://karaochaos.local:${PORT}`);
    console.log(`📱 Mobile:    http://karaochaos.local:${PORT}/mobile`);
    console.log('---------------------------------------');
});