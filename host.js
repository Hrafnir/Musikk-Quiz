/* Version: #420 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let hostLobbyView, gameCodeDisplay, playerLobbyList, startGameBtn,
    spotifyConnectView, spotifyLoginBtn,
    readyToPlayView, startFirstRoundBtn,
    hostGameView, playerHud, hostTurnIndicator, gameHeader, gameCodeDisplayPermanent,
    hostSongDisplay, hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear, receivedYearRange,
    hostFasitDisplay, fasitAlbumArt, fasitArtist, fasitTitle, fasitYear, nextTurnBtn,
    skipPlayerBtn;

// === STATE ===
let user = null; // NY: For å holde på innlogget bruker
let players = [];
let gameCode = '';
let gameChannel = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let songHistory = [];
let isGameRunning = false;
let currentPlayerIndex = 0;
let isSkipTurn = false;

// === Promise for Spotify SDK ===
let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});
window.onSpotifyWebPlaybackSDKReady = () => {
    if (resolveSpotifySdkReady) resolveSpotifySdkReady();
};


// === DATABASE INTERACTIONS ===

// NY: Oppdaterer hele spilltilstanden i databasen
async function updateDatabaseGameState(newState) {
    const currentState = {
        players,
        currentPlayerIndex,
        isGameRunning,
        songHistory,
        currentSong,
        isSkipTurn,
    };

    const finalState = { ...currentState, ...newState };

    const { error } = await supabaseClient
        .from('games')
        .update({ game_state: finalState })
        .eq('game_code', gameCode);

    if (error) {
        console.error("Error updating game state in DB:", error);
    }
}

// NY: Sjekker om det finnes et aktivt spill for denne hosten
async function checkForActiveGame() {
    const localGameCode = localStorage.getItem('mquiz_host_gamecode');
    const localHostId = localStorage.getItem('mquiz_host_id');

    if (!user || !localGameCode || localHostId !== user.id) {
        // Ingen aktivt spill funnet, eller det tilhører en annen bruker
        await initializeLobby();
        return;
    }

    console.log(`Found active game ${localGameCode} for host ${localHostId}. Attempting to resume...`);

    const { data, error } = await supabaseClient
        .from('games')
        .select('*')
        .eq('game_code', localGameCode)
        .single();

    if (error || !data) {
        console.error("Could not fetch active game, starting a new one.", error);
        localStorage.removeItem('mquiz_host_gamecode');
        localStorage.removeItem('mquiz_host_id');
        await initializeLobby();
    } else {
        console.log("Successfully fetched game state. Resuming session.");
        await resumeGame(data);
    }
}

// NY: Gjenopptar et spill fra databasen
async function resumeGame(gameData) {
    gameCode = gameData.game_code;
    const gameState = gameData.game_state;

    // Gjenopprett lokal state fra databasen
    players = gameState.players || [];
    currentPlayerIndex = gameState.currentPlayerIndex || 0;
    isGameRunning = gameState.isGameRunning || false;
    songHistory = gameState.songHistory || [];
    currentSong = gameState.currentSong || null;
    isSkipTurn = gameState.isSkipTurn || false;

    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;

    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    setupChannelListeners();
    gameChannel.subscribe();

    // Vis riktig skjerm
    if (gameData.status === 'in_progress') {
        hostLobbyView.classList.add('hidden');
        spotifyConnectView.classList.add('hidden');
        await handleStartFirstRoundClick(true); // true for å indikere at det er en resume
    } else { // 'lobby'
        hostLobbyView.classList.remove('hidden');
        updatePlayerLobby();
    }
}


// === LOBBY & GAME SETUP ===

async function initializeLobby() {
    console.log("Initializing new lobby...");
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;
    
    // Initial state
    const initialGameState = {
        players: [],
        currentPlayerIndex: 0,
        isGameRunning: false,
        songHistory: [],
        currentSong: null,
        isSkipTurn: false
    };

    const { data, error } = await supabaseClient
        .from('games')
        .insert({
            game_code: gameCode,
            host_id: user.id,
            game_state: initialGameState,
            status: 'lobby'
        })
        .select()
        .single();

    if (error) {
        console.error("FATAL: Could not create new game in database.", error);
        alert("Kunne ikke starte et nytt spill. Prøv å laste siden på nytt.");
        return;
    }
    
    // Lagre i localStorage for reconnect
    localStorage.setItem('mquiz_host_gamecode', gameCode);
    localStorage.setItem('mquiz_host_id', user.id);

    players = []; // Start med tom spillerliste
    
    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    setupChannelListeners();
    gameChannel.subscribe();
    
    hostLobbyView.classList.remove('hidden');
}


function setupChannelListeners() {
    if (gameChannel.state === 'joined') {
        // Unngå å feste lyttere flere ganger på samme kanal-objekt
        return;
    }
    gameChannel
        .on('broadcast', { event: 'player_join' }, (payload) => {
            const newPlayerName = payload.payload.name;
            if (!players.find(p => p.name === newPlayerName)) {
                players.push({
                    name: newPlayerName, sp: 0, credits: 3, handicap: 5,
                    roundHandicap: 0, stats: {}
                });
                updatePlayerLobby();
                updateDatabaseGameState({ players: players }); // Oppdater DB
            }
        })
        // Midlertidig fjernet angrepslyttere
        .on('broadcast', { event: 'submit_answer' }, () => console.log("Answer received, logic to be re-implemented"))
        .on('broadcast', { event: 'buy_handicap' }, () => console.log("Buy handicap received, logic to be re-implemented"))
        .on('broadcast', { event: 'skip_song' }, () => console.log("Skip song received, logic to be re-implemented"));
}

function handleStartGameClick() {
    // Viser Spotify-connect, men selve spillstart-logikken
    // er nå i handleStartFirstRoundClick
    hostLobbyView.classList.add('hidden');
    spotifyConnectView.classList.remove('hidden');
}


// === GAME START & CORE LOOP ===

// Endret til å håndtere resume
async function handleStartFirstRoundClick(isResume = false) {
    if (!isResume) {
        // Oppdater status i DB bare hvis det er en fersk start
        const { error } = await supabaseClient.from('games').update({ status: 'in_progress' }).eq('game_code', gameCode);
        if (error) {
            console.error("Could not update game status to in_progress", error);
            return;
        }
    }

    readyToPlayView.classList.add('hidden');
    spotifyConnectView.classList.add('hidden'); // Sørg for at denne er skjult
    hostGameView.classList.remove('hidden');
    gameHeader.classList.remove('hidden');
    hostTurnIndicator.textContent = "Laster Spotify-spiller...";
    
    await spotifySdkReadyPromise;
    await initializeSpotifyPlayer();
    
    if (isResume && currentSong) {
        // Hvis vi gjenopptar midt i en sang
        updateHud();
        hostTurnIndicator.textContent = `Venter på svar fra ${players[currentPlayerIndex].name}...`;
        hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
        hostSongDisplay.classList.remove('hidden');
        playTrack(currentSong.spotifyid); // Start sangen på nytt
    } else {
        await startGameLoop();
    }
}

async function startGameLoop() {
    isGameRunning = true;
    updateHud();
    await updateDatabaseGameState({ isGameRunning: true });
    await startTurn();
}

async function startTurn() {
    isSkipTurn = false;
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
        await updateDatabaseGameState({ currentSong, songHistory }); // Lagre ny sang i DB

        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({ type: 'broadcast', event: 'new_turn', payload: { name: currentPlayer.name } });
        } else {
            // Håndter avspillingsfeil
        }
    } else {
        // Håndter feil ved henting av sang
    }
}

async function advanceToNextTurn() {
    if (!isSkipTurn) {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    await updateDatabaseGameState({ currentPlayerIndex, isSkipTurn: false });
    await startTurn();
}


// === SPOTIFY & OTHER HELPERS (for det meste uendret) ===

function loadSpotifySdk() {
    if (window.Spotify) { window.onSpotifyWebPlaybackSDKReady(); return; }
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
        spotifyPlayer.addListener('ready', ({ device_id }) => { deviceId = device_id; resolve(); });
        spotifyPlayer.connect();
    });
}
async function fetchRandomSong() {
    const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory });
    if (error || !data || !data[0]) { return null; }
    return data[0];
}
async function playTrack(spotifyTrackId) {
    if (!deviceId) return false;
    const token = await getValidSpotifyToken();
    if (!token) return false;
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    await new Promise(resolve => setTimeout(resolve, 100));
    const trackUri = `spotify:track:${spotifyTrackId}`;
    const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    const response = await fetch(url, { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
    return response && response.ok;
}
async function getValidSpotifyToken() {
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken || !expiresAt) return null;
    if (Date.now() > parseInt(expiresAt) - (5 * 60 * 1000)) { return await refreshSpotifyToken(); }
    return accessToken;
}
async function refreshSpotifyToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID, }),
    });
    if (!response.ok) { return null; }
    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) { localStorage.setItem('spotify_refresh_token', data.refresh_token); }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_token_expires_at', expiresAt);
    return data.access_token;
}
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

// === MAIN ENTRY POINT ===
document.addEventListener('DOMContentLoaded', async () => {
    // DOM-tildeling
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
    // ... resten av DOM-elementene
    nextTurnBtn = document.getElementById('next-turn-btn');
    skipPlayerBtn = document.getElementById('skip-player-btn');

    // Lytter for auth-endringer for å få tak i bruker-objektet
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            user = session.user;
            console.log("User is logged in:", user.email);
            // Nå som vi har bruker, kan vi sjekke etter et aktivt spill
            await checkForActiveGame();
        } else {
            user = null;
            // Hvis brukeren logger ut, tving start på nytt
            localStorage.removeItem('mquiz_host_gamecode');
            localStorage.removeItem('mquiz_host_id');
            // Vis en "logg inn"-melding eller omdiriger
        }
    });

    const spotifyCode = new URLSearchParams(window.location.search).get('code');
    if (spotifyCode) {
        await fetchSpotifyAccessToken(spotifyCode);
        window.history.replaceState(null, '', window.location.pathname);
        // Håndter visning av ready-to-play-view
        hostLobbyView.classList.add('hidden');
        spotifyConnectView.classList.add('hidden');
        readyToPlayView.classList.remove('hidden');
    }

    // Felles lyttere
    startGameBtn.addEventListener('click', handleStartGameClick);
    spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin);
    startFirstRoundBtn.addEventListener('click', () => handleStartFirstRoundClick(false));
    nextTurnBtn.addEventListener('click', advanceToNextTurn);
    // skipPlayerBtn-lytter er fjernet herfra, da den krever mer logikk
});
/* Version: #420 */
