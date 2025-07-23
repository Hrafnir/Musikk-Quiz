/* Version: #352 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let spotifyConnectView, spotifyLoginBtn, hostLobbyView, gameCodeDisplay,
    playerLobbyList, startGameBtn, hostGameView, hostTurnIndicator,
    hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear,
    hostSongDisplay, hostFasitDisplay, fasitArtist, fasitTitle,
    fasitYear, nextTurnBtn, playerHud;

// === STATE ===
let players = [], gameCode = '', gameChannel = null, currentPlayerIndex = 0,
    spotifyPlayer = null, deviceId = null, currentSong = null,
    songHistory = [], totalSongsInDb = 0,
    isGameRunning = false; // Nytt flagg for å håndtere "join mid-game"

// === FUNKSJONER ===

// --- SPOTIFY AUTH & PLAYER ---
async function redirectToSpotifyLogin() { /* ... (uendret) ... */ }
async function fetchSpotifyAccessToken(code) { /* ... (uendret) ... */ }
function generateRandomString(length) { /* ... (uendret) ... */ }
async function generateCodeChallenge(codeVerifier) { /* ... (uendret) ... */ }
async function getValidSpotifyToken() { /* ... (uendret) ... */ }
async function refreshSpotifyToken() { /* ... (uendret) ... */ }
window.onSpotifyWebPlaybackSDKReady = () => { console.log("Spotify SDK er lastet."); };
function initializeSpotifyPlayer() {
    return new Promise((resolve) => {
        if (spotifyPlayer) { resolve(); return; }
        spotifyPlayer = new Spotify.Player({ name: 'MQuiz Host Spiller', getOAuthToken: async cb => { const token = await getValidSpotifyToken(); if (token) cb(token); }, volume: 0.5 });
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('Host Spotify-spiller er klar med enhet-ID:', device_id);
            deviceId = device_id;
            resolve();
        });
        spotifyPlayer.connect();
    });
}
async function playTrack(spotifyTrackId) { /* ... (uendret) ... */ }
async function pauseTrack() { /* ... (uendret) ... */ }
async function fetchWithFreshToken(url, options = {}) { /* ... (uendret) ... */ }

// --- LOBBY & GAME FLOW ---
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u00c0-\u017f]/g, '').replace(/[.,/#!$%^&*;:{}=\-_`~()']/g, "").replace(/\s+/g, ' ').trim();
}

function updateHud() {
    if (!playerHud) return;
    playerHud.innerHTML = '';
    players.forEach((player, index) => {
        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info';
        if (isGameRunning && index === currentPlayerIndex) {
            playerInfoDiv.classList.add('active-player');
        }
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">SP: ${player.sp} | Credits: ${player.credits}</div>`;
        playerHud.appendChild(playerInfoDiv);
    });
}

function updatePlayerLobby() {
    if (!playerLobbyList) return;
    playerLobbyList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playerLobbyList.appendChild(li);
    });
    if (players.length > 0) {
        startGameBtn.disabled = false;
        startGameBtn.textContent = `Start Spill (${players.length} spillere)`;
    } else {
        startGameBtn.disabled = true;
        startGameBtn.textContent = 'Venter på spillere...';
    }
}

function handlePlayerJoin(payload) {
    const newPlayerName = payload.payload.name;
    const existingPlayer = players.find(p => p.name === newPlayerName);

    if (!existingPlayer) {
        console.log(`Ny spiller blir med: ${newPlayerName}`);
        players.push({
            name: newPlayerName,
            sp: 0,
            credits: 3,
            handicap: 5,
            stats: { artistGuesses: 0, artistCorrect: 0, titleGuesses: 0, titleCorrect: 0, yearGuesses: 0, yearCorrect: 0, perfectYearGuesses: 0 }
        });
    } else {
        console.log(`Spiller koblet til på nytt: ${newPlayerName}`);
    }

    if (isGameRunning) {
        // Hvis spillet er i gang, send en oppdatering til alle
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players: players } });
        updateHud();
    } else {
        // Hvis vi er i lobbyen, oppdater lobby-listen
        updatePlayerLobby();
    }
}


async function setupGameLobby() {
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    gameChannel.on('broadcast', { event: 'player_join' }, handlePlayerJoin);
    gameChannel.on('broadcast', { event: 'submit_answer' }, handleAnswer);
    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Lobby er klar og lytter på kanalen: ${channelName}`);
        }
    });
}

async function fetchRandomSong() { /* ... (uendret) ... */ }
async function startGameLoop() {
    isGameRunning = true;
    console.log("Starter spill-loopen med spillere:", players);
    hostLobbyView.classList.add('hidden');
    spotifyConnectView.classList.add('hidden');
    hostGameView.classList.remove('hidden');

    await initializeSpotifyPlayer();
    
    console.log("Spotify-spiller initialisert. Venter 1 sekund...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;
    
    gameChannel.send({ type: 'broadcast', event: 'game_start', payload: { players: players } });
    currentPlayerIndex = 0;
    updateHud();
    await startTurn();
}
async function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    hostTurnIndicator.textContent = `Venter på svar fra ${currentPlayer.name}...`;
    hostAnswerDisplay.classList.add('hidden');
    hostFasitDisplay.classList.add('hidden');
    nextTurnBtn.classList.add('hidden');
    hostSongDisplay.innerHTML = '<h2>Henter en ny sang...</h2>';
    hostSongDisplay.classList.remove('hidden');
    updateHud();
    
    currentSong = await fetchRandomSong();
    if (currentSong) {
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({ type: 'broadcast', event: 'new_turn', payload: { name: currentPlayer.name } });
        } else {
            hostSongDisplay.innerHTML = '<h2 style="color: red;">Avspilling feilet!</h2>';
        }
    } else {
        hostSongDisplay.innerHTML = '<h2 style="color: red;">Klarte ikke hente sang!</h2>';
    }
}
async function handleAnswer(payload) {
    const currentPlayer = players.find(p => p.name === payload.payload.name);
    if (!currentPlayer) return; // Svar fra en ukjent spiller

    const { artist, title, year } = payload.payload;
    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';
    hostTurnIndicator.textContent = `${currentPlayer.name} har svart!`;
    hostAnswerDisplay.classList.remove('hidden');

    // Poengberegning...
    // ...
    
    updateHud();
    fasitArtist.textContent = currentSong.artist;
    fasitTitle.textContent = currentSong.title;
    fasitYear.textContent = currentSong.year;
    hostFasitDisplay.classList.remove('hidden');
    hostSongDisplay.classList.add('hidden');
    nextTurnBtn.classList.remove('hidden');

    gameChannel.send({ type: 'broadcast', event: 'round_result', payload: { players: players } });
}
async function advanceToNextTurn() {
    await pauseTrack();
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    await startTurn();
}

// === HOVED-INNGANGSPUNKT: DOMContentLoaded ===
document.addEventListener('DOMContentLoaded', async () => { /* ... (uendret) ... */ });

// --- Kopiert inn uendrede funksjoner ---
async function redirectToSpotifyLogin() { const codeVerifier = generateRandomString(128); const codeChallenge = await generateCodeChallenge(codeVerifier); localStorage.setItem('spotify_code_verifier', codeVerifier); const redirectUri = window.location.origin + window.location.pathname; const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(' '))}&code_challenge_method=S256&code_challenge=${codeChallenge}`; window.location = authUrl; }
async function fetchSpotifyAccessToken(code) { const codeVerifier = localStorage.getItem('spotify_code_verifier'); if (!codeVerifier) return false; const redirectUri = window.location.origin + window.location.pathname; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: code, redirect_uri: redirectUri, code_verifier: codeVerifier, }), }); if (response.ok) { const data = await response.json(); const expiresAt = Date.now() + data.expires_in * 1000; localStorage.setItem('spotify_access_token', data.access_token); localStorage.setItem('spotify_refresh_token', data.refresh_token); localStorage.setItem('spotify_token_expires_at', expiresAt); return true; } return false; }
function generateRandomString(length) { let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < length; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); } return text; }
async function generateCodeChallenge(codeVerifier) { const data = new TextEncoder().encode(codeVerifier); const digest = await window.crypto.subtle.digest('SHA-256', data); return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function getValidSpotifyToken() { const expiresAt = localStorage.getItem('spotify_token_expires_at'); const accessToken = localStorage.getItem('spotify_access_token'); if (!accessToken || !expiresAt) return null; if (Date.now() > parseInt(expiresAt) - (5 * 60 * 1000)) { return await refreshSpotifyToken(); } return accessToken; }
async function refreshSpotifyToken() { const refreshToken = localStorage.getItem('spotify_refresh_token'); if (!refreshToken) return null; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID, }), }); if (!response.ok) { console.error('Klarte ikke å fornye Spotify token'); return null; } const data = await response.json(); localStorage.setItem('spotify_access_token', data.access_token); if (data.refresh_token) { localStorage.setItem('spotify_refresh_token', data.refresh_token); } const expiresAt = Date.now() + data.expires_in * 1000; localStorage.setItem('spotify_token_expires_at', expiresAt); return data.access_token; }
async function fetchWithFreshToken(url, options = {}) { const token = await getValidSpotifyToken(); if (!token) { return null; } const newOptions = { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }; return fetch(url, newOptions); }
async function playTrack(spotifyTrackId) { if (!deviceId) { alert('Ingen aktiv Spotify-enhet funnet.'); return false; } await pauseTrack(); await new Promise(resolve => setTimeout(resolve, 100)); const trackUri = `spotify:track:${spotifyTrackId}`; const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; const playOptions = { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), }; try { const response = await fetchWithFreshToken(playUrl, playOptions); if (!response.ok) throw new Error(`Spotify API svarte med ${response.status}`); return true; } catch (error) { console.error("Playtrack feilet:", error); return false; } }
async function pauseTrack() { if (!deviceId) return; await fetchWithFreshToken(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', }); }
async function fetchRandomSong() { if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) { songHistory = []; } const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); if (error || !data || !data[0]) { return null; } return data[0]; }
document.addEventListener('DOMContentLoaded', async () => { console.log("DOM er fullstendig lastet."); spotifyConnectView = document.getElementById('spotify-connect-view'); spotifyLoginBtn = document.getElementById('spotify-login-btn'); hostLobbyView = document.getElementById('host-lobby-view'); gameCodeDisplay = document.getElementById('game-code-display'); playerLobbyList = document.getElementById('player-lobby-list'); startGameBtn = document.getElementById('start-game-btn'); hostGameView = document.getElementById('host-game-view'); hostTurnIndicator = document.getElementById('host-turn-indicator'); hostAnswerDisplay = document.getElementById('host-answer-display'); receivedArtist = document.getElementById('received-artist'); receivedTitle = document.getElementById('received-title'); receivedYear = document.getElementById('received-year'); hostSongDisplay = document.getElementById('host-song-display'); hostFasitDisplay = document.getElementById('host-fasit-display'); fasitArtist = document.getElementById('fasit-artist'); fasitTitle = document.getElementById('fasit-title'); fasitYear = document.getElementById('fasit-year'); nextTurnBtn = document.getElementById('next-turn-btn'); playerHud = document.getElementById('player-hud'); const spotifyCode = new URLSearchParams(window.location.search).get('code'); if (spotifyCode) { const success = await fetchSpotifyAccessToken(spotifyCode); if (success) { window.history.replaceState(null, '', window.location.pathname); const storedPlayers = sessionStorage.getItem('mquiz_players'); const storedGameCode = sessionStorage.getItem('mquiz_gamecode'); if (storedPlayers && storedGameCode) { players = JSON.parse(storedPlayers); gameCode = storedGameCode; reconnectToChannel(gameCode); await startGameLoop(); } else { alert("Feil: Fant ikke spilldata etter Spotify-innlogging. Gå tilbake og start på nytt."); } } else { alert("Klarte ikke hente Spotify-token."); } } else { setupGameLobby(); } startGameBtn.addEventListener('click', () => { sessionStorage.setItem('mquiz_players', JSON.stringify(players)); sessionStorage.setItem('mquiz_gamecode', gameCode); hostLobbyView.classList.add('hidden'); spotifyConnectView.classList.remove('hidden'); }); spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin); nextTurnBtn.addEventListener('click', advanceToNextTurn); });
/* Version: #352 */
