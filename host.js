/* Version: #405 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let hostLobbyView, gameCodeDisplay, playerLobbyList, startGameBtn,
    spotifyConnectView, spotifyLoginBtn,
    readyToPlayView, startFirstRoundBtn,
    hostGameView, playerHud, hostTurnIndicator, gameHeader, gameCodeDisplayPermanent,
    hostSongDisplay, hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear, receivedYearRange,
    hostFasitDisplay, fasitAlbumArt, fasitArtist, fasitTitle, fasitYear, nextTurnBtn;

// === STATE ===
let players = [];
let gameCode = '';
let gameChannel = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let songHistory = [];
let totalSongsInDb = 0;
let isGameRunning = false;
let currentPlayerIndex = 0;
let autocompleteData = { artistList: [], titleList: [] };

let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});

window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Global: onSpotifyWebPlaybackSDKReady has been called by the SDK.");
    if (resolveSpotifySdkReady) {
        resolveSpotifySdkReady();
    }
};

// === UTILITY & HELPERS ===

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
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

function normalizeString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()']/g, "")
        .replace(/\s+/g, ' ')
        .trim();
}


// === LOBBY & GAME SETUP ===

// NY: Sentral funksjon for å feste alle lyttere til kanalen
function setupChannelListeners() {
    gameChannel
        .on('broadcast', { event: 'player_join' }, (payload) => {
            console.log('Player join received:', payload);
            const newPlayerName = payload.payload.name;
            if (!players.find(p => p.name === newPlayerName)) {
                // Gjeninnfører full spiller-objekt-opprettelse
                players.push({
                    name: newPlayerName,
                    sp: 0,
                    credits: 3,
                    handicap: 5, // Standard handicap
                    roundHandicap: 0,
                    stats: { /* Initialiserer stats-objekt */ }
                });
                updatePlayerLobby();
            }
        })
        .on('broadcast', { event: 'submit_answer' }, handleAnswer)
        .on('broadcast', { event: 'buy_handicap' }, handleBuyHandicap)
        .on('broadcast', { event: 'skip_song' }, handleSkipSong);
    
    console.log("Channel listeners for player_join, submit_answer, etc. are now active.");
}

async function initializeLobby() {
    console.log("Phase 1: Initializing Lobby");
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;

    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);

    setupChannelListeners(); // Kaller den nye funksjonen

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Successfully subscribed to channel: ${channelName}`);
            hostLobbyView.classList.remove('hidden');
        } else if (status === 'CHANNEL_ERROR') {
            alert('Kunne ikke koble til spill-kanalen. Prøv å laste siden på nytt.');
        }
    });

    startGameBtn.addEventListener('click', handleStartGameClick);
}

function handleStartGameClick() {
    console.log("Phase 2: Start Game button clicked. Moving to Spotify Connect.");
    sessionStorage.setItem('mquiz_gamecode', gameCode);
    sessionStorage.setItem('mquiz_players', JSON.stringify(players));
    hostLobbyView.classList.add('hidden');
    spotifyConnectView.classList.remove('hidden');
}


// === SPOTIFY AUTHENTICATION FLOW ===

async function redirectToSpotifyLogin() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    const redirectUri = window.location.href.split('?')[0];
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(' '))}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    window.location = authUrl;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchSpotifyAccessToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) return false;
    const redirectUri = window.location.href.split('?')[0];
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: code,
            redirect_uri: redirectUri, code_verifier: codeVerifier,
        }),
    });
    if (response.ok) {
        const data = await response.json();
        const expiresAt = Date.now() + data.expires_in * 1000;
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_token_expires_at', expiresAt);
        return true;
    }
    return false;
}

async function getValidSpotifyToken() {
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken || !expiresAt) return null;
    if (Date.now() > parseInt(expiresAt) - (5 * 60 * 1000)) {
        return await refreshSpotifyToken();
    }
    return accessToken;
}

async function refreshSpotifyToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID,
        }),
    });
    if (!response.ok) { console.error('Could not refresh Spotify token'); return null; }
    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) { localStorage.setItem('spotify_refresh_token', data.refresh_token); }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_token_expires_at', expiresAt);
    return data.access_token;
}


// === GAME START & CORE LOOP ===

async function handleStartFirstRoundClick() {
    console.log("Phase 4: Start First Round button clicked. Initializing game.");
    readyToPlayView.classList.add('hidden');
    hostGameView.classList.remove('hidden');
    gameHeader.classList.remove('hidden');
    hostTurnIndicator.textContent = "Laster Spotify-spiller...";
    await spotifySdkReadyPromise;
    console.log("Spotify SDK is confirmed ready via Promise.");
    await initializeSpotifyPlayer();
    await startGameLoop();
}

function loadSpotifySdk() {
    if (window.Spotify) { window.onSpotifyWebPlaybackSDKReady(); return; }
    console.log("Dynamically loading Spotify SDK script...");
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
}

async function initializeSpotifyPlayer() {
    return new Promise(resolve => {
        spotifyPlayer = new Spotify.Player({
            name: 'MQuiz Host',
            getOAuthToken: async cb => { const token = await getValidSpotifyToken(); if (token) cb(token); },
            volume: 0.5
        });
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('Spotify Player is ready with Device ID:', device_id);
            deviceId = device_id;
            resolve();
        });
        spotifyPlayer.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline:', device_id); });
        spotifyPlayer.connect();
    });
}

async function startGameLoop() {
    isGameRunning = true;
    updateHud();
    const { data: artists, error: artistError } = await supabaseClient.rpc('get_distinct_artists');
    if (!artistError) autocompleteData.artistList = artists.map(item => item.artist_name);
    const { data: titles, error: titleError } = await supabaseClient.rpc('get_distinct_titles');
    if (!titleError) autocompleteData.titleList = titles.map(item => item.title_name);
    const { count } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    totalSongsInDb = count;
    gameChannel.send({ type: 'broadcast', event: 'game_start', payload: { players, ...autocompleteData } });
    await startTurn();
}

async function startTurn() {
    players.forEach(p => p.roundHandicap = 0); // Nullstill runde-handicap
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
        songHistory.push(currentSong.id);
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({ type: 'broadcast', event: 'new_turn', payload: { name: currentPlayer.name } });
        } else {
            hostSongDisplay.innerHTML = '<h2 style="color: red;">Avspilling feilet! Prøver neste...</h2>';
            setTimeout(advanceToNextTurn, 2000);
        }
    } else {
        hostSongDisplay.innerHTML = '<h2 style="color: red;">Klarte ikke hente sang! Prøver neste...</h2>';
        setTimeout(advanceToNextTurn, 2000);
    }
}

// OPPDATERT: Gjeninnfører full poenglogikk
async function handleAnswer(payload) {
    console.log("Answer received:", payload);
    await pauseTrack();
    
    const { name, artist, title, year } = payload.payload;
    const respondingPlayer = players.find(p => p.name === name);
    if (!respondingPlayer) return;

    const artistGuess = normalizeString(artist);
    const titleGuess = normalizeString(title);
    const yearGuess = parseInt(year, 10);
    const correctArtistNorm = normalizeString(currentSong.artist);
    const correctTitleNorm = normalizeString(currentSong.title);
    const correctYear = currentSong.year;

    let roundSp = 0, roundCredits = 0, feedbackMessages = [];

    const artistIsCorrect = artistGuess !== '' && artistGuess === correctArtistNorm;
    const titleIsCorrect = titleGuess !== '' && titleGuess === correctTitleNorm;

    if (artistIsCorrect && titleIsCorrect) {
        roundCredits += 3;
        feedbackMessages.push("Artist & Tittel: +3 credits!");
    } else {
        if (artistIsCorrect) { roundCredits += 1; feedbackMessages.push("Artist: +1 credit!"); }
        if (titleIsCorrect) { roundCredits += 1; feedbackMessages.push("Tittel: +1 credit!"); }
    }

    if (!isNaN(yearGuess)) {
        const totalHandicap = respondingPlayer.handicap + respondingPlayer.roundHandicap;
        if (yearGuess === correctYear) {
            roundCredits += 3;
            feedbackMessages.push("Perfekt år: +3 credits!");
        }
        if (Math.abs(yearGuess - correctYear) <= totalHandicap) {
            roundSp += 1;
            feedbackMessages.push("Årstall: +1 SP!");
        }
        receivedYearRange.textContent = `${yearGuess} (${yearGuess - totalHandicap} - ${yearGuess + totalHandicap})`;
    } else {
        receivedYearRange.textContent = 'Ikke besvart';
    }

    respondingPlayer.sp += roundSp;
    respondingPlayer.credits += roundCredits;
    const feedbackText = feedbackMessages.length > 0 ? `${name}: ${feedbackMessages.join(' ')}` : `${name} fikk ingen poeng.`;

    // Vis mottatt svar og fasit
    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';
    hostAnswerDisplay.classList.remove('hidden');

    fasitAlbumArt.src = currentSong.albumarturl || '';
    fasitArtist.textContent = currentSong.artist;
    fasitTitle.textContent = currentSong.title;
    fasitYear.textContent = currentSong.year;
    hostSongDisplay.classList.add('hidden');
    hostFasitDisplay.classList.remove('hidden');
    nextTurnBtn.classList.remove('hidden');
    
    // Send resultat til klientene og oppdater HUD
    gameChannel.send({ type: 'broadcast', event: 'round_result', payload: { players: players, feedback: feedbackText, song: currentSong } });
    updateHud();
}

// NY: Håndterer kjøp av handicap
function handleBuyHandicap(payload) {
    const playerName = payload.payload.name;
    const player = players.find(p => p.name === playerName);
    if (player && player.credits > 0) {
        player.credits--;
        player.roundHandicap += 2; // Legger til handicap for denne runden
        hostTurnIndicator.textContent = `${playerName} kjøpte handicap!`;
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players: players } });
        updateHud();
    }
}

// NY: Håndterer skip av sang
async function handleSkipSong(payload) {
    const playerName = payload.payload.name;
    const player = players.find(p => p.name === playerName);
    if (player && player.credits > 0) {
        player.credits--;
        hostTurnIndicator.textContent = `${playerName} brukte 1 credit for å skippe sangen.`;
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players: players } });
        updateHud();
        await pauseTrack();
        await new Promise(resolve => setTimeout(resolve, 1500));
        await startTurn();
    }
}


async function advanceToNextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    await startTurn();
}


// === SPOTIFY PLAYBACK ===

async function fetchWithFreshToken(url, options = {}) {
    const token = await getValidSpotifyToken();
    if (!token) { return null; }
    const newOptions = { ...options, headers: { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    return fetch(url, newOptions);
}

async function playTrack(spotifyTrackId) {
    if (!deviceId) return false;
    await pauseTrack();
    await new Promise(resolve => setTimeout(resolve, 100));
    const trackUri = `spotify:track:${spotifyTrackId}`;
    const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    const response = await fetchWithFreshToken(url, { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }) });
    return response && response.ok;
}

async function pauseTrack() {
    if (!deviceId) return;
    await fetchWithFreshToken(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT' });
}

async function fetchRandomSong() {
    if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) { songHistory = []; }
    const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory });
    if (error || !data || !data[0]) { console.error('Could not fetch random song:', error); return null; }
    return data[0];
}


// === MAIN ENTRY POINT ===

document.addEventListener('DOMContentLoaded', async () => {
    hostLobbyView = document.getElementById('host-lobby-view');
    gameCodeDisplay = document.getElementById('game-code-display');
    playerLobbyList = document.getElementById('player-lobby-list');
    startGameBtn = document.getElementById('start-game-btn');
    spotifyConnectView = document.getElementById('spotify-connect-view');
    spotifyLoginBtn = document.getElementById('spotify-login-btn');
    readyToPlayView = document.getElementById('ready-to-play-view');
    startFirstRoundBtn = document.getElementById('start-first-round-btn');
    hostGameView = document.getElementById('host-game-view');
    playerHud = document.getElementById('player-hud');
    hostTurnIndicator = document.getElementById('host-turn-indicator');
    gameHeader = document.getElementById('game-header');
    gameCodeDisplayPermanent = document.getElementById('game-code-display-permanent');
    hostSongDisplay = document.getElementById('host-song-display');
    hostAnswerDisplay = document.getElementById('host-answer-display');
    receivedArtist = document.getElementById('received-artist');
    receivedTitle = document.getElementById('received-title');
    receivedYear = document.getElementById('received-year');
    receivedYearRange = document.getElementById('received-year-range');
    hostFasitDisplay = document.getElementById('host-fasit-display');
    fasitAlbumArt = document.getElementById('fasit-album-art');
    fasitArtist = document.getElementById('fasit-artist');
    fasitTitle = document.getElementById('fasit-title');
    fasitYear = document.getElementById('fasit-year');
    nextTurnBtn = document.getElementById('next-turn-btn');

    const spotifyCode = new URLSearchParams(window.location.search).get('code');

    if (spotifyCode) {
        console.log("Phase 3: Returned from Spotify. Processing code...");
        const success = await fetchSpotifyAccessToken(spotifyCode);
        window.history.replaceState(null, '', window.location.pathname);

        if (success) {
            gameCode = sessionStorage.getItem('mquiz_gamecode');
            const storedPlayers = sessionStorage.getItem('mquiz_players');
if (storedPlayers) players = JSON.parse(storedPlayers);
            
            if (gameCode) {
                const channelName = `game-${gameCode}`;
                gameChannel = supabaseClient.channel(channelName);
                setupChannelListeners(); // Kaller den nye funksjonen for å feste lyttere
                gameChannel.subscribe();
            }

            loadSpotifySdk();
            hostLobbyView.classList.add('hidden');
            spotifyConnectView.classList.add('hidden');
            readyToPlayView.classList.remove('hidden');
            startFirstRoundBtn.addEventListener('click', handleStartFirstRoundClick);
        } else {
            alert('Noe gikk galt med Spotify-innloggingen. Prøv igjen.');
            sessionStorage.clear();
            window.location.href = window.location.pathname;
        }
    } else {
        await initializeLobby();
        spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin);
        nextTurnBtn.addEventListener('click', advanceToNextTurn);
    }
});
/* Version: #405 */
