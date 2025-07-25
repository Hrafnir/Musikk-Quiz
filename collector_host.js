/* Version: #469 (Diagnostic) */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let collectorLobbyView, gameCodeDisplay, playerLobbyList, startGameBtn, songsToWinInput,
    spotifyConnectView, spotifyLoginBtn,
    readyToPlayView, startFirstRoundBtn, forceNewGameBtn,
    collectorGameView, playerHud, roundTimer, realtimeAnswerStatus, songPlayingDisplay, playingAlbumArt,
    roundResultContainer, nextSongBtn, nextSongStatus, forceNewGameFromSummaryBtn,
    collectorVictoryView, winnerAnnouncement,
    gameHeader, gameCodeDisplayPermanent;

// === STATE ===
let user = null;
let gameCode = '';
let gameState = {};
let gameChannel = null;
let spotifyPlayer = null;
let deviceId = null;
let roundTimerInterval = null;

// === Promise for Spotify SDK ===
let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});
window.onSpotifyWebPlaybackSDKReady = () => {
    if (resolveSpotifySdkReady) resolveSpotifySdkReady();
};


// === HOVEDFUNKSJONER ===

function renderGame(gameData) {
    if (!gameData) return;
    console.log(`[UI RENDER] (Host) Kaller renderGame. Status: ${gameData.status}, Spillere: ${gameData.game_state.players.length}`);
    gameState = gameData.game_state;
    
    [collectorLobbyView, collectorGameView, collectorVictoryView, spotifyConnectView, readyToPlayView].forEach(view => view.classList.add('hidden'));
    gameHeader.classList.remove('hidden');

    gameCodeDisplayPermanent.textContent = gameCode;
    updateHud();

    switch (gameData.status) {
        case 'lobby':
            collectorLobbyView.classList.remove('hidden');
            gameHeader.classList.add('hidden');
            updatePlayerLobby();
            break;
        // ... (resten av casene forblir de samme)
        case 'in_progress': collectorGameView.classList.remove('hidden'); roundResultContainer.classList.add('hidden'); songPlayingDisplay.classList.remove('hidden'); if (gameState.currentSong) playingAlbumArt.src = gameState.currentSong.albumarturl || ''; startRoundTimer(gameState.roundEndsAt); break;
        case 'round_summary': collectorGameView.classList.remove('hidden'); roundResultContainer.classList.remove('hidden'); songPlayingDisplay.classList.add('hidden'); break;
        case 'finished': collectorVictoryView.classList.remove('hidden'); winnerAnnouncement.textContent = `Vinneren er ${gameState.winner}!`; break;
    }
}

function updatePlayerLobby() {
    if (!playerLobbyList) return;
    const players = gameState.players || [];
    playerLobbyList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playerLobbyList.appendChild(li);
    });
    startGameBtn.disabled = players.length === 0;
    startGameBtn.textContent = players.length > 0 ? `Start Spill (${players.length} spillere)` : 'Venter på spillere...';
}

function updateHud() {
    if (!playerHud) return;
    const players = gameState.players || [];
    playerHud.innerHTML = '';
    players.forEach(player => {
        const songsCollected = player.songsCollected || 0;
        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info';
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">Sanger: ${songsCollected}</div>`;
        playerHud.appendChild(playerInfoDiv);
    });
}


// === DATABASE & REALTIME ===

async function forceGameStateSync() {
    console.log("[DB READ] (Host) Ping mottatt. Henter fersk data fra DB...");
    const { data, error } = await supabaseClient.from('games').select('*').eq('game_code', gameCode).single();
    if (error) {
        console.error("[DB READ] (Host) Kunne ikke hente fersk data:", error);
    } else if (data) {
        console.log("[DB READ] (Host) Fersk data hentet. Antall spillere:", data.game_state.players.length);
        renderGame(data);
    }
}

function setupSubscriptions() {
    if (gameChannel) supabaseClient.removeChannel(gameChannel);

    gameChannel = supabaseClient.channel(`game-${gameCode}`);
    
    gameChannel
        .on('broadcast', { event: 'ping' }, (payload) => {
            console.log(`[BROADCAST RECV] (Host) Mottok ping. Årsak: ${payload.payload.message}`);
            forceGameStateSync();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[LISTENING] (Host) Lytter nå på broadcast-kanalen game-${gameCode}`);
            }
        });
}

async function initializeLobby() {
    localStorage.removeItem('mquiz_collector_host_gamecode');
    localStorage.removeItem('mquiz_collector_host_id');
    let success = false;
    let newGameData = null;
    while (!success) {
        gameCode = Math.floor(100000 + Math.random() * 900000).toString();
        const initialGameState = { players: [], songsToWin: parseInt(songsToWinInput.value, 10) || 10, currentRound: 0 };
        const { data, error } = await supabaseClient.from('games').insert({ game_code: gameCode, host_id: user.id, game_state: initialGameState, status: 'lobby' }).select().single();
        if (!error) {
            success = true;
            newGameData = data;
        }
    }
    localStorage.setItem('mquiz_collector_host_gamecode', gameCode);
    localStorage.setItem('mquiz_collector_host_id', user.id);
    gameCodeDisplay.textContent = gameCode;
    
    setupSubscriptions();
    renderGame(newGameData);
}

async function resumeGame(gameData) {
    gameCode = gameData.game_code;
    setupSubscriptions();
    renderGame(gameData);
}


// === SPILLFLYT-HANDLINGER (forkortet, uendret) ===
async function handleStartGameClick() { const token = await getValidSpotifyToken(); if (token) { collectorLobbyView.classList.add('hidden'); readyToPlayView.classList.remove('hidden'); } else { collectorLobbyView.classList.add('hidden'); spotifyConnectView.classList.remove('hidden'); } }
async function handleStartFirstRoundClick() { readyToPlayView.classList.add('hidden'); loadSpotifySdk(); await spotifySdkReadyPromise; await initializeSpotifyPlayer(); await startRound(); }
async function forceNewGame() { if (confirm("Er du sikker?")) { localStorage.removeItem('mquiz_collector_host_gamecode'); localStorage.removeItem('mquiz_collector_host_id'); window.location.reload(); } }
async function startRound() { /* ... logikk kommer senere ... */ }
async function endRound() { /* ... logikk kommer senere ... */ }
function startRoundTimer(endTime) { /* ... logikk kommer senere ... */ }
// ... (resten av de uendrede funksjonene) ...

// === FULLSTENDIGE FUNKSJONER ===
function startRoundTimer(endTime) { clearInterval(roundTimerInterval); if (!endTime) { roundTimer.textContent = "--:--"; return; } const end = new Date(endTime).getTime(); roundTimerInterval = setInterval(() => { const now = new Date().getTime(); const distance = end - now; if (distance < 0) { clearInterval(roundTimerInterval); roundTimer.textContent = "00:00"; endRound(); return; } const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)); const seconds = Math.floor((distance % (1000 * 60)) / 1000); roundTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; }, 1000); }
function loadSpotifySdk() { if (window.Spotify) { window.onSpotifyWebPlaybackSDKReady(); return; } const script = document.createElement('script'); script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true; document.body.appendChild(script); }
async function initializeSpotifyPlayer() { return new Promise(resolve => { spotifyPlayer = new Spotify.Player({ name: 'MQuiz Collector', getOAuthToken: async cb => { const token = await getValidSpotifyToken(); if (token) cb(token); }, volume: 0.5 }); spotifyPlayer.addListener('ready', ({ device_id }) => { deviceId = device_id; resolve(); }); spotifyPlayer.connect(); }); }
async function getValidSpotifyToken() { const expiresAt = localStorage.getItem('spotify_token_expires_at'); const accessToken = localStorage.getItem('spotify_access_token'); if (!accessToken || !expiresAt || Date.now() > parseInt(expiresAt) - 300000) { return await refreshSpotifyToken(); } return accessToken; }
async function refreshSpotifyToken() { const refreshToken = localStorage.getItem('spotify_refresh_token'); if (!refreshToken) return null; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID, }), }); if (!response.ok) return null; const data = await response.json(); localStorage.setItem('spotify_access_token', data.access_token); if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token); localStorage.setItem('spotify_token_expires_at', Date.now() + data.expires_in * 1000); return data.access_token; }
async function redirectToSpotifyLogin() { const codeVerifier = generateRandomString(128); const codeChallenge = await generateCodeChallenge(codeVerifier); localStorage.setItem('spotify_code_verifier', codeVerifier); const redirectUri = window.location.href.split('?')[0]; const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(' '))}&code_challenge_method=S256&code_challenge=${codeChallenge}`; window.location = authUrl; }
async function generateCodeChallenge(codeVerifier) { const data = new TextEncoder().encode(codeVerifier); const digest = await window.crypto.subtle.digest('SHA-256', data); return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function fetchSpotifyAccessToken(code) { const codeVerifier = localStorage.getItem('spotify_code_verifier'); if (!codeVerifier) return false; const redirectUri = window.location.href.split('?')[0]; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier, }), }); if (response.ok) { const data = await response.json(); localStorage.setItem('spotify_access_token', data.access_token); localStorage.setItem('spotify_refresh_token', data.refresh_token); localStorage.setItem('spotify_token_expires_at', Date.now() + data.expires_in * 1000); return true; } return false; }
async function playTrack(spotifyTrackId) { if (!deviceId) { console.error("Cannot play track: no deviceId"); return false; } const token = await getValidSpotifyToken(); if (!token) { console.error("Cannot play track: no token"); return false; } await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); await new Promise(resolve => setTimeout(resolve, 100)); const trackUri = `spotify:track:${spotifyTrackId}`; const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; const response = await fetch(url, { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }); return response.ok; }

async function main() {
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyCode = urlParams.get('code');
    if (spotifyCode) {
        await fetchSpotifyAccessToken(spotifyCode);
        window.location.replace(window.location.pathname);
        return;
    }
    const localGameCode = localStorage.getItem('mquiz_collector_host_gamecode');
    const localHostId = localStorage.getItem('mquiz_collector_host_id');
    if (localGameCode && localHostId === user.id) {
        const { data: gameData, error } = await supabaseClient.from('games').select('*').eq('game_code', localGameCode).single();
        if (gameData && !error) {
            await resumeGame(gameData);
        } else {
            await initializeLobby();
        }
    } else {
        await initializeLobby();
    }
}

// === MAIN ENTRY POINT ===
document.addEventListener('DOMContentLoaded', async () => {
    // Tildel DOM-elementer
    collectorLobbyView = document.getElementById('collector-lobby-view');
    gameCodeDisplay = document.getElementById('game-code-display');
    playerLobbyList = document.getElementById('player-lobby-list');
    startGameBtn = document.getElementById('start-game-btn');
    songsToWinInput = document.getElementById('songs-to-win-input');
    spotifyConnectView = document.getElementById('spotify-connect-view');
    spotifyLoginBtn = document.getElementById('spotify-login-btn');
    readyToPlayView = document.getElementById('ready-to-play-view');
    startFirstRoundBtn = document.getElementById('start-first-round-btn');
    forceNewGameBtn = document.getElementById('force-new-game-btn');
    collectorGameView = document.getElementById('collector-game-view');
    playerHud = document.getElementById('player-hud');
    roundTimer = document.getElementById('round-timer');
    realtimeAnswerStatus = document.getElementById('realtime-answer-status');
    songPlayingDisplay = document.getElementById('song-playing-display');
    playingAlbumArt = document.getElementById('playing-album-art');
    roundResultContainer = document.getElementById('round-result-container');
    nextSongBtn = document.getElementById('next-song-btn');
    nextSongStatus = document.getElementById('next-song-status');
    forceNewGameFromSummaryBtn = document.getElementById('force-new-game-from-summary-btn');
    collectorVictoryView = document.getElementById('collector-victory-view');
    winnerAnnouncement = document.getElementById('winner-announcement');
    gameHeader = document.getElementById('game-header');
    gameCodeDisplayPermanent = document.getElementById('game-code-display-permanent');
    
    // Felles lyttere
    startGameBtn.addEventListener('click', handleStartGameClick);
    spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin);
    startFirstRoundBtn.addEventListener('click', handleStartFirstRoundClick);
    forceNewGameBtn.addEventListener('click', forceNewGame);
    forceNewGameFromSummaryBtn.addEventListener('click', forceNewGame);
    nextSongBtn.addEventListener('click', startRound);
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        user = session.user;
        await main();
    } else {
        window.location.href = 'index.html';
    }
});
/* Version: #469 (Diagnostic) */
