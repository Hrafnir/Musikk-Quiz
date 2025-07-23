/* Version: #327 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
const gameCodeDisplay = document.getElementById('game-code-display');
const playerLobbyList = document.getElementById('player-lobby-list');
const startGameBtn = document.getElementById('start-game-btn');
const hostLobbyView = document.getElementById('host-lobby-view');
const hostGameView = document.getElementById('host-game-view');
const hostTurnIndicator = document.getElementById('host-turn-indicator');
const hostAnswerDisplay = document.getElementById('host-answer-display');
const receivedArtist = document.getElementById('received-artist');
const receivedTitle = document.getElementById('received-title');
const receivedYear = document.getElementById('received-year');
const hostSongDisplay = document.getElementById('host-song-display');

// === STATE ===
let players = [];
let gameCode = '';
let gameChannel = null;
let currentPlayerIndex = 0;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let songHistory = [];
let totalSongsInDb = 0;

// === SPOTIFY AUTH & PLAYER FUNCTIONS ===
async function refreshSpotifyToken() { const refreshToken = localStorage.getItem('spotify_refresh_token'); if (!refreshToken) return null; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID, }), }); if (!response.ok) { console.error('Klarte ikke å fornye Spotify token'); return null; } const data = await response.json(); localStorage.setItem('spotify_access_token', data.access_token); if (data.refresh_token) { localStorage.setItem('spotify_refresh_token', data.refresh_token); } const expiresAt = Date.now() + data.expires_in * 1000; localStorage.setItem('spotify_token_expires_at', expiresAt); return data.access_token; }
async function getValidSpotifyToken() { const expiresAt = localStorage.getItem('spotify_token_expires_at'); const accessToken = localStorage.getItem('spotify_access_token'); if (!accessToken || !expiresAt) return null; if (Date.now() > parseInt(expiresAt) - (5 * 60 * 1000)) { return await refreshSpotifyToken(); } return accessToken; }
window.onSpotifyWebPlaybackSDKReady = () => { if (localStorage.getItem('spotify_access_token')) { initializeSpotifyPlayer(); } };
function initializeSpotifyPlayer() {
    if (spotifyPlayer) return;
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Host Spiller',
        getOAuthToken: async cb => {
            const token = await getValidSpotifyToken();
            if (token) cb(token);
        },
        volume: 0.5
    });
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Host Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
    });
    spotifyPlayer.connect();
}
async function fetchWithFreshToken(url, options = {}) { const token = await getValidSpotifyToken(); if (!token) { console.error("Kunne ikke hente gyldig token for API-kall."); return null; } const newOptions = { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }; return fetch(url, newOptions); }
async function transferPlayback() { if (!deviceId) return; await fetchWithFreshToken(`https://api.spotify.com/v1/me/player`, { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }), }); await new Promise(resolve => setTimeout(resolve, 500)); }
async function pauseTrack() { if (!deviceId) return; await fetchWithFreshToken(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', }); }
async function playTrack(spotifyTrackId) { if (!deviceId) { alert('Ingen aktiv Spotify-enhet funnet.'); return false; } await pauseTrack(); await new Promise(resolve => setTimeout(resolve, 100)); const trackUri = `spotify:track:${spotifyTrackId}`; const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; const playOptions = { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), }; try { const response = await fetchWithFreshToken(playUrl, playOptions); if (!response.ok) throw new Error(`Spotify API svarte med ${response.status}`); return true; } catch (error) { if (error.message.includes("403")) { await transferPlayback(); try { const retryResponse = await fetchWithFreshToken(playUrl, playOptions); if (!retryResponse.ok) throw new Error(`Spotify API svarte med ${retryResponse.status} på nytt forsøk`); return true; } catch (retryError) { alert("Klarte ikke starte avspilling. Sjekk at Spotify er aktiv og prøv neste runde."); return false; } } else { return false; } } }
async function fetchRandomSong() { if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) { songHistory = []; } const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); if (error || !data || !data[0]) { songHistory = []; const { data: fallbackData } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); return fallbackData ? fallbackData[0] : null; } return data[0]; }


// === LOBBY FUNCTIONS ===
function updatePlayerLobby() {
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

// === GAME FLOW FUNCTIONS ===
async function startGame() {
    console.log("Starter spillet...");
    hostLobbyView.classList.add('hidden');
    hostGameView.classList.remove('hidden');
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;
    gameChannel.send({ type: 'broadcast', event: 'game_start' });
    currentPlayerIndex = 0;
    await startTurn();
}

async function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    console.log(`Starter tur for ${currentPlayer.name}`);
    hostTurnIndicator.textContent = `Venter på svar fra ${currentPlayer.name}...`;
    hostAnswerDisplay.classList.add('hidden');
    hostSongDisplay.innerHTML = '<h2>Henter en ny sang...</h2>';
    currentSong = await fetchRandomSong();
    
    if (currentSong) {
        songHistory.push(currentSong.id);
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({
                type: 'broadcast',
                event: 'new_turn',
                payload: { name: currentPlayer.name }
            });
        } else {
            hostSongDisplay.innerHTML = '<h2 style="color: red;">Avspilling feilet!</h2>';
        }
    } else {
        hostSongDisplay.innerHTML = '<h2 style="color: red;">Klarte ikke hente sang!</h2>';
    }
}

function handleAnswer(payload) {
    console.log("Svar mottatt:", payload);
    const { artist, title, year } = payload.payload;
    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';
    hostTurnIndicator.textContent = `${players[currentPlayerIndex].name} har svart!`;
    hostAnswerDisplay.classList.remove('hidden');
    // TODO: Gå til neste spiller
}

// === SETUP ===
async function setupGame() {
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    gameChannel.on('broadcast', { event: 'player_join' }, (payload) => {
        const newPlayerName = payload.payload.name;
        if (!players.some(p => p.name === newPlayerName)) {
            players.push({ name: newPlayerName });
            updatePlayerLobby(); // Denne skal nå være korrekt definert
        }
    });
    gameChannel.on('broadcast', { event: 'submit_answer' }, handleAnswer);
    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Host er klar og lytter på kanalen: ${channelName}`);
        } else {
            console.error('Host kunne ikke koble seg til kanalen.');
            gameCodeDisplay.textContent = "FEIL";
        }
    });
}

// === EVENT LISTENERS & INITIALIZE ===
startGameBtn.addEventListener('click', startGame);
document.addEventListener('DOMContentLoaded', setupGame);
/* Version: #327 */
