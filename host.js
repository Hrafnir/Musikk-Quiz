/* Version: #433 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let hostLobbyView, gameCodeDisplay, playerLobbyList, startGameBtn,
    spotifyConnectView, spotifyLoginBtn,
    readyToPlayView, startFirstRoundBtn, forceNewGameBtn,
    hostGameView, playerHud, hostTurnIndicator, gameHeader, gameCodeDisplayPermanent,
    hostSongDisplay, hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear, receivedYearRange,
    hostFasitDisplay, fasitAlbumArt, fasitArtist, fasitTitle, fasitYear, nextTurnBtn,
    skipPlayerBtn;

// === STATE ===
let user = null;
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

// === Angrepsfase State ===
let attackPhaseTimer = null;
let executionPhaseTimer = null;
let potentialAttackers = [];
let declaredAttackers = { besserwisser: [], hijack: [] };
let besserwisserAnswers = [];
let hijackBids = [];
let roundFeedback = { main: "", attack: "" };

// === Promise for Spotify SDK ===
let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("[DIAGNOSTIC] window.onSpotifyWebPlaybackSDKReady has been called.");
    if (resolveSpotifySdkReady) resolveSpotifySdkReady();
};


// === HJELPEFUNKSJONER ===

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

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,/#!$%^&*;:{}=\-_`~()']/g, "").replace(/\s+/g, ' ').trim();
}


// === DATABASE INTERACTIONS ===

async function updateDatabaseGameState(newState) {
    const currentState = { players, currentPlayerIndex, isGameRunning, songHistory, currentSong, isSkipTurn };
    const finalState = { ...currentState, ...newState };
    const { error } = await supabaseClient
        .from('games')
        .update({ game_state: finalState, updated_at: new Date().toISOString() })
        .eq('game_code', gameCode);
    if (error) console.error("Error updating game state in DB:", error);
}

async function checkForActiveGame() {
    const localGameCode = localStorage.getItem('mquiz_host_gamecode');
    const localHostId = localStorage.getItem('mquiz_host_id');

    if (!user || !localGameCode || localHostId !== user.id) {
        await initializeLobby();
        return;
    }

    try {
        const { data, error } = await supabaseClient.from('games').select('*').eq('game_code', localGameCode).single();
        if (error || !data) throw new Error(error?.message || "Game not found");
        await resumeGame(data);
    } catch (e) {
        await initializeLobby();
    }
}

async function resumeGame(gameData) {
    gameCode = gameData.game_code;
    const gameState = gameData.game_state;
    players = gameState.players || [];
    currentPlayerIndex = gameState.currentPlayerIndex || 0;
    isGameRunning = gameState.isGameRunning || false;
    songHistory = gameState.songHistory || [];
    currentSong = gameState.currentSong || null;
    isSkipTurn = gameState.isSkipTurn || false;

    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;

    await setupChannel(); 

    if (gameData.status === 'in_progress') {
        hostLobbyView.classList.add('hidden');
        spotifyConnectView.classList.add('hidden');
        readyToPlayView.classList.add('hidden');
        await handleStartFirstRoundClick();
    } else { // 'lobby'
        hostLobbyView.classList.remove('hidden');
        updatePlayerLobby();
    }
}


// === LOBBY & GAME SETUP ===

async function initializeLobby() {
    localStorage.removeItem('mquiz_host_gamecode');
    localStorage.removeItem('mquiz_host_id');

    let success = false;
    let attempts = 0;
    while (!success && attempts < 5) {
        attempts++;
        gameCode = Math.floor(100000 + Math.random() * 900000).toString();
        const initialGameState = { players: [], currentPlayerIndex: 0, isGameRunning: false, songHistory: [], currentSong: null, isSkipTurn: false };
        const { error } = await supabaseClient.from('games').insert({ game_code: gameCode, host_id: user.id, game_state: initialGameState, status: 'lobby' });
        if (!error) success = true;
    }
    
    localStorage.setItem('mquiz_host_gamecode', gameCode);
    localStorage.setItem('mquiz_host_id', user.id);
    players = [];
    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;
    
    await setupChannel(); 
    
    hostLobbyView.classList.remove('hidden');
    spotifyConnectView.classList.add('hidden');
    readyToPlayView.classList.add('hidden');
    updatePlayerLobby();
}

async function setupChannel() {
    const channelName = `game-${gameCode}`;
    if (gameChannel) supabaseClient.removeChannel(gameChannel);
    gameChannel = supabaseClient.channel(channelName);

    gameChannel
        .on('broadcast', { event: 'player_join' }, (payload) => {
            const newPlayerName = payload.payload.name;
            if (!players.find(p => p.name === newPlayerName)) {
                players.push({ name: newPlayerName, sp: 0, credits: 3, handicap: 5, roundHandicap: 0, stats: {} });
                updatePlayerLobby();
                updateDatabaseGameState({ players });
            }
        })
        .on('broadcast', { event: 'submit_answer' }, handleAnswer)
        .on('broadcast', { event: 'buy_handicap' }, handleBuyHandicap)
        .on('broadcast', { event: 'skip_song' }, handleSkipSong)
        .on('broadcast', { event: 'declare_besserwisser' }, (payload) => {
            if (potentialAttackers.includes(payload.payload.name)) declaredAttackers.besserwisser.push(payload.payload.name);
            checkAttackDeclarations();
        })
        .on('broadcast', { event: 'declare_hijack' }, (payload) => {
            if (potentialAttackers.includes(payload.payload.name)) declaredAttackers.hijack.push(payload.payload.name);
            checkAttackDeclarations();
        })
        .on('broadcast', { event: 'submit_besserwisser' }, (payload) => {
            besserwisserAnswers.push(payload.payload);
            checkAttackSubmissions();
        })
        .on('broadcast', { event: 'submit_hijack' }, (payload) => {
            hijackBids.push(payload.payload);
            checkAttackSubmissions();
        });
    
    return new Promise(resolve => {
        gameChannel.subscribe(status => {
            if (status === 'SUBSCRIBED') resolve();
        });
    });
}

async function handleStartGameClick() {
    const token = await getValidSpotifyToken();
    if (token) {
        await supabaseClient.from('games').update({ status: 'in_progress' }).eq('game_code', gameCode);
        hostLobbyView.classList.add('hidden');
        await handleStartFirstRoundClick();
    } else {
        hostLobbyView.classList.add('hidden');
        spotifyConnectView.classList.remove('hidden');
    }
}

async function forceNewGame() {
    if (confirm("Er du sikker på at du vil avslutte dette spillet og starte et nytt?")) {
        await supabaseClient.from('games').delete().eq('game_code', gameCode);
        localStorage.removeItem('mquiz_host_gamecode');
        localStorage.removeItem('mquiz_host_id');
        window.location.reload();
    }
}


// === GAME START & CORE LOOP ===

async function handleStartFirstRoundClick() {
    console.log("[DIAGNOSTIC] handleStartFirstRoundClick called.");
    await supabaseClient.from('games').update({ status: 'in_progress' }).eq('game_code', gameCode);
    readyToPlayView.classList.add('hidden');
    hostGameView.classList.remove('hidden');
    gameHeader.classList.remove('hidden');
    hostTurnIndicator.textContent = "Laster Spotify-spiller...";
    
    console.log("[DIAGNOSTIC] Waiting for Spotify SDK Promise...");
    await spotifySdkReadyPromise;
    console.log("[DIAGNOSTIC] Spotify SDK Promise resolved.");
    
    await initializeSpotifyPlayer();
    
    if (isGameRunning && currentSong) {
        updateHud();
        hostTurnIndicator.textContent = `Venter på svar fra ${players[currentPlayerIndex].name}...`;
        hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
        hostSongDisplay.classList.remove('hidden');
        playTrack(currentSong.spotifyid);
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


// === RUNDE-LOGIKK ===

async function startTurn() {
    isSkipTurn = false;
    players.forEach(p => p.roundHandicap = 0);
    potentialAttackers = [];
    declaredAttackers = { besserwisser: [], hijack: [] };
    besserwisserAnswers = [];
    hijackBids = [];
    roundFeedback = { main: "", attack: "" };
    clearTimeout(attackPhaseTimer);
    clearTimeout(executionPhaseTimer);
    
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
        await updateDatabaseGameState({ currentSong, songHistory });
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({ type: 'broadcast', event: 'new_turn', payload: { name: currentPlayer.name } });
        }
    }
}

async function handleAnswer(payload) {
    const { name, artist, title, year } = payload.payload;
    const respondingPlayer = players.find(p => p.name === name);
    if (!respondingPlayer) return;

    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';
    hostAnswerDisplay.classList.remove('hidden');
    hostSongDisplay.classList.add('hidden');

    const evaluation = evaluatePlayerAnswer(respondingPlayer, payload.payload);
    respondingPlayer.sp += evaluation.roundSp;
    respondingPlayer.credits += evaluation.roundCredits;
    roundFeedback.main = evaluation.feedbackMessages.length > 0 ? `${name}: ${evaluation.feedbackMessages.join(' ')}` : `${name} fikk ingen poeng.`;

    const canBesserwiss = !evaluation.artistIsCorrect && !evaluation.titleIsCorrect;
    const canHijack = !evaluation.yearIsCorrect;

    if (canBesserwiss || canHijack) {
        startAttackPhase(canBesserwiss, canHijack);
    } else {
        showFasit();
    }
}

function evaluatePlayerAnswer(player, answer) {
    const { artist, title, year } = answer;
    const yearGuess = parseInt(year, 10);
    let roundSp = 0, roundCredits = 0, feedbackMessages = [];
    const artistIsCorrect = normalizeString(artist) === normalizeString(currentSong.artist);
    const titleIsCorrect = normalizeString(title) === normalizeString(currentSong.title);
    let yearIsCorrect = false;

    if (artistIsCorrect && titleIsCorrect) {
        roundCredits += 3;
        feedbackMessages.push("Artist & Tittel: +3 credits!");
    } else {
        if (artistIsCorrect) { roundCredits += 1; feedbackMessages.push("Artist: +1 credit!"); }
        if (titleIsCorrect) { roundCredits += 1; feedbackMessages.push("Tittel: +1 credit!"); }
    }
    if (!isNaN(yearGuess)) {
        const totalHandicap = player.handicap + player.roundHandicap;
        if (Math.abs(yearGuess - currentSong.year) <= totalHandicap) {
            roundSp += 1;
            yearIsCorrect = true;
            feedbackMessages.push("Årstall: +1 SP!");
        }
        if (yearGuess === currentSong.year) { roundCredits += 3; feedbackMessages.push("Perfekt år: +3 credits!"); }
        receivedYearRange.textContent = `${yearGuess} (${yearGuess - totalHandicap} - ${yearGuess + totalHandicap})`;
    } else {
        receivedYearRange.textContent = 'Ikke besvart';
    }
    return { roundSp, roundCredits, feedbackMessages, artistIsCorrect, titleIsCorrect, yearIsCorrect };
}

function startAttackPhase(canBesserwiss, canHijack) {
    hostTurnIndicator.textContent = "Angrepsfase!";
    const currentPlayerName = players[currentPlayerIndex].name;
    potentialAttackers = players.filter(p => p.name !== currentPlayerName).map(p => p.name);
    if (potentialAttackers.length === 0) { resolveAttackPhase(); return; }
    gameChannel.send({ type: 'broadcast', event: 'attack_phase_start', payload: { canBesserwiss, canHijack, attacker: currentPlayerName } });
    attackPhaseTimer = setTimeout(startAttackExecutionPhase, 10000);
}

function checkAttackDeclarations() {
    const totalDeclarations = [...new Set([...declaredAttackers.besserwisser, ...declaredAttackers.hijack])].length;
    if (totalDeclarations === potentialAttackers.length) {
        clearTimeout(attackPhaseTimer);
        startAttackExecutionPhase();
    }
}

function startAttackExecutionPhase() {
    hostTurnIndicator.textContent = "Venter på angrep...";
    const hasBesserwisser = declaredAttackers.besserwisser.length > 0;
    const hasHijack = declaredAttackers.hijack.length > 0;
    if (!hasBesserwisser && !hasHijack) { resolveAttackPhase(); return; }
    if (hasBesserwisser) { gameChannel.send({ type: 'broadcast', event: 'execute_besserwisser', payload: { players: declaredAttackers.besserwisser } }); }
    if (hasHijack) { gameChannel.send({ type: 'broadcast', event: 'execute_hijack', payload: { players: declaredAttackers.hijack } }); }
    executionPhaseTimer = setTimeout(resolveAttackPhase, 60000);
}

function checkAttackSubmissions() {
    const totalSubmissions = besserwisserAnswers.length + hijackBids.length;
    const totalDeclarations = declaredAttackers.besserwisser.length + declaredAttackers.hijack.length;
    if (totalSubmissions === totalDeclarations) {
        clearTimeout(executionPhaseTimer);
        resolveAttackPhase();
    }
}

function resolveAttackPhase() {
    let attackResults = [];
    besserwisserAnswers.forEach(answer => {
        const attacker = players.find(p => p.name === answer.name);
        if (!attacker) return;
        const artistCorrect = normalizeString(answer.artist) === normalizeString(currentSong.artist);
        const titleCorrect = normalizeString(answer.title) === normalizeString(currentSong.title);
        if (artistCorrect && titleCorrect) {
            attacker.sp += 2;
            attackResults.push(`<div class="attack-result success">${attacker.name} klarte Besserwisser! +2 SP</div>`);
        } else {
            attacker.credits = Math.max(0, attacker.credits - 1);
            attackResults.push(`<div class="attack-result fail">${attacker.name} feilet Besserwisser. -1 Credit</div>`);
        }
    });
    if (hijackBids.length > 0) {
        hijackBids.sort((a, b) => b.bid - a.bid);
        const winningBid = hijackBids[0];
        const winner = players.find(p => p.name === winningBid.name);
        if (winner) {
            winner.credits = Math.max(0, winner.credits - winningBid.bid);
            if (parseInt(winningBid.year, 10) === currentSong.year) {
                winner.sp += 1;
                attackResults.push(`<div class="attack-result success">${winner.name} vant Hijack med bud på ${winningBid.bid}! +1 SP</div>`);
            } else {
                attackResults.push(`<div class="attack-result fail">${winner.name} vant Hijack, men svarte feil år. Mistet ${winningBid.bid} credits.</div>`);
            }
        }
    }
    roundFeedback.attack = attackResults.length > 0 ? `<h3>Angrep</h3>${attackResults.join('')}` : "<h3>Angrep</h3><p>Ingen vellykkede angrep.</p>";
    showFasit();
}

function showFasit() {
    fasitAlbumArt.src = currentSong.albumarturl || '';
    fasitArtist.textContent = currentSong.artist;
    fasitTitle.textContent = currentSong.title;
    fasitYear.textContent = currentSong.year;
    hostFasitDisplay.classList.remove('hidden');
    nextTurnBtn.classList.remove('hidden');
    gameChannel.send({ type: 'broadcast', event: 'round_result', payload: { players, feedback: roundFeedback.main, song: currentSong, attackResultsHTML: roundFeedback.attack } });
    updateHud();
    updateDatabaseGameState({ players });
}

function handleBuyHandicap(payload) {
    const player = players.find(p => p.name === payload.payload.name);
    if (player && player.credits > 0) {
        player.credits--;
        player.roundHandicap += 2;
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players } });
        updateHud();
    }
}

function handleSkipPlayer() {
    if (!isGameRunning) return;
    const skippedPlayer = players[currentPlayerIndex].name;
    roundFeedback.main = `${skippedPlayer} ble hoppet over av hosten.`;
    isSkipTurn = false;
    triggerAttackPhaseFromSkip();
}

function handleSkipSong(payload) {
    const player = players.find(p => p.name === payload.payload.name);
    if (player && player.credits > 0) {
        player.credits--;
        roundFeedback.main = `${player.name} brukte 1 credit for å bytte sang.`;
        isSkipTurn = true;
        triggerAttackPhaseFromSkip();
        updateHud();
        updateDatabaseGameState({ players });
    }
}

function triggerAttackPhaseFromSkip() {
    hostAnswerDisplay.classList.add('hidden');
    hostSongDisplay.classList.add('hidden');
    startAttackPhase(true, true);
}

async function advanceToNextTurn() {
    if (!isSkipTurn) {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    await updateDatabaseGameState({ currentPlayerIndex, isSkipTurn: false });
    await startTurn();
}


// === SPOTIFY & OTHER HELPERS ===
function loadSpotifySdk() {
    if (window.Spotify) { window.onSpotifyWebPlaybackSDKReady(); return; }
    console.log("[DIAGNOSTIC] Loading Spotify SDK script...");
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
}
async function initializeSpotifyPlayer() {
    return new Promise(resolve => {
        spotifyPlayer = new Spotify.Player({ name: 'MQuiz Host', getOAuthToken: async cb => { const token = await getValidSpotifyToken(); if (token) cb(token); }, volume: 0.5 });
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
    if (!accessToken || !expiresAt || Date.now() > parseInt(expiresAt) - 30000) { 
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
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: SPOTIFY_CLIENT_ID, }),
    });
    if (!response.ok) { return null; }
    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token);
    localStorage.setItem('spotify_token_expires_at', Date.now() + data.expires_in * 1000);
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
async function fetchSpotifyAccessToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) return false;
    const redirectUri = window.location.href.split('?')[0];
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier, }),
    });
    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_token_expires_at', Date.now() + data.expires_in * 1000);
        return true;
    }
    return false;
}

async function main() {
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyCode = urlParams.get('code');
    if (spotifyCode) {
        await fetchSpotifyAccessToken(spotifyCode);
        window.location.replace(window.location.pathname);
        return;
    }
    await checkForActiveGame();
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
    forceNewGameBtn = document.getElementById('force-new-game-btn');
    hostGameView = document.getElementById('host-game-view');
    playerHud = document.getElementById('player-hud');
    hostTurnIndicator = document.getElementById('host-turn-indicator');
    gameHeader = document.getElementById('game-header');
    gameCodeDisplayPermanent = document.getElementById('game-code-display-permanent');
    nextTurnBtn = document.getElementById('next-turn-btn');
    skipPlayerBtn = document.getElementById('skip-player-btn');

    // Felles lyttere
    startGameBtn.addEventListener('click', handleStartGameClick);
    spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin);
    startFirstRoundBtn.addEventListener('click', handleStartFirstRoundClick);
    forceNewGameBtn.addEventListener('click', forceNewGame);
    nextTurnBtn.addEventListener('click', advanceToNextTurn);
    skipPlayerBtn.addEventListener('click', handleSkipPlayer);
    
    // ENDRET: Laster SDK-en proaktivt
    loadSpotifySdk();

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        user = session.user;
        await main();
    } else {
        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                subscription.unsubscribe();
                window.location.reload();
            }
        });
        if (!window.location.hash.includes('access_token')) {
            window.location.href = 'index.html';
        }
    }
});
/* Version: #433 */
