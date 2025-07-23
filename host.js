/* Version: #397 (merged #394 + #396)
   - Restored robust Spotify SDK loader (from #394)
   - Kept Supabase channel cleanup & broadcast config (from #396)
   - Removed duplicate DOMContentLoaded listener
   - startGameLoop now awaits loadSpotifySdk() before initializeSpotifyPlayer()
   - Ready/Connect/Lobby view handling unified
*/

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS (declared globally, assigned in DOMContentLoaded) ===
let spotifyConnectView, spotifyLoginBtn, hostLobbyView, gameCodeDisplay,
    playerLobbyList, startGameBtn, hostGameView, hostTurnIndicator,
    hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear,
    hostSongDisplay, hostFasitDisplay, fasitArtist, fasitTitle,
    fasitYear, nextTurnBtn, playerHud, gameHeader, gameCodeDisplayPermanent,
    fasitAlbumArt, receivedYearRange, readyToPlayView, startFirstRoundBtn;

// === STATE (global) ===
let players = [], gameCode = '', gameChannel = null, currentPlayerIndex = 0,
    spotifyPlayer = null, deviceId = null, currentSong = null,
    songHistory = [], totalSongsInDb = 0, isGameRunning = false,
    autocompleteData = { artistList: [], titleList: [] };

// === ROBUST SPOTIFY SDK LOADING ===
let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});

window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Spotify SDK er lastet.");
    if (resolveSpotifySdkReady) resolveSpotifySdkReady();
};

function loadSpotifySdk() {
    return new Promise((resolve, reject) => {
        // Already loaded
        if (window.Spotify) {
            console.log("Spotify SDK er allerede lastet.");
            resolve();
            return;
        }
        console.log("Laster Spotify SDK dynamisk...");
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        script.onerror = () => {
            console.error('Kunne ikke laste Spotify SDK.');
            reject(new Error('Spotify SDK load error'));
        };
        document.body.appendChild(script);

        spotifySdkReadyPromise.then(() => {
            console.log('Promise for Spotify SDK er løst.');
            resolve();
        });
    });
}

function initializeSpotifyPlayer() {
    return new Promise((resolve) => {
        if (spotifyPlayer) { resolve(); return; }
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
            resolve();
        });

        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
            console.warn('Spotify Player not ready', device_id);
        });
        spotifyPlayer.addListener('initialization_error', ({ message }) => console.error(message));
        spotifyPlayer.addListener('authentication_error', ({ message }) => console.error(message));
        spotifyPlayer.addListener('account_error', ({ message }) => console.error(message));

        spotifyPlayer.connect();
    });
}

// === AUTH / TOKEN HELPERS ===
async function redirectToSpotifyLogin() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(' '))}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    window.location = authUrl;
}

async function fetchSpotifyAccessToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) return false;
    const redirectUri = window.location.origin + window.location.pathname;
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
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

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: SPOTIFY_CLIENT_ID,
        }),
    });
    if (!response.ok) {
        console.error('Klarte ikke å fornye Spotify token');
        return null;
    }
    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_token_expires_at', expiresAt);
    return data.access_token;
}

async function fetchWithFreshToken(url, options = {}) {
    const token = await getValidSpotifyToken();
    if (!token) { return null; }
    const newOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    return fetch(url, newOptions);
}

// === UTILITY ===
function normalizeString(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u00c0-\u017f]/g, '')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()']/g, "")
        .replace(/\s+/g, ' ')
        .trim();
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
        players.push({
            name: newPlayerName, sp: 0, credits: 3, handicap: 5, roundHandicap: 0,
            stats: {}
        });
    }
    if (isGameRunning) {
        updateHud();
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players: players, ...autocompleteData } });
    } else {
        updatePlayerLobby();
    }
}

async function setupGameLobby(existingCode = null) {
    gameCode = existingCode || Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;
    const channelName = `game-${gameCode}`;

    // Remove old channel if exists
    if (gameChannel) {
        supabaseClient.removeChannel(gameChannel);
    }

    gameChannel = supabaseClient.channel(channelName, {
        config: {
            broadcast: { self: false }
        }
    });

    gameChannel
        .on('broadcast', { event: 'player_join' }, handlePlayerJoin)
        .on('broadcast', { event: 'submit_answer' }, handleAnswer)
        .on('broadcast', { event: 'buy_handicap' }, handleBuyHandicap)
        .on('broadcast', { event: 'skip_song' }, handleSkipSong);
        // legg til flere lyttere her ved behov

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Lobby er klar og lytter på kanalen: ${channelName}`);
        } else {
            console.error(`Feil ved tilkobling til kanal. Status: ${status}`);
        }
    });
}

async function fetchRandomSong() {
    if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) {
        songHistory = [];
    }
    const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory });
    if (error || !data || !data[0]) {
        return null;
    }
    return data[0];
}

async function getAutocompleteLists() {
    console.log("Henter autocomplete-lister...");
    const { data: artists, error: artistError } = await supabaseClient.rpc('get_distinct_artists');
    const { data: titles, error: titleError } = await supabaseClient.rpc('get_distinct_titles');
    if (artistError || titleError) {
        console.error("Kunne ikke hente lister:", artistError || titleError);
        autocompleteData = { artistList: [], titleList: [] };
    } else {
        autocompleteData = {
            artistList: artists.map(item => item.artist_name),
            titleList: titles.map(item => item.title_name)
        };
    }
}

async function playTrack(spotifyTrackId) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet.');
        return false;
    }
    await pauseTrack();
    await new Promise(resolve => setTimeout(resolve, 100));
    const trackUri = `spotify:track:${spotifyTrackId}`;
    const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    const playOptions = {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri] }),
    };
    try {
        const response = await fetchWithFreshToken(playUrl, playOptions);
        if (!response || !response.ok) throw new Error(`Spotify API svarte med ${response && response.status}`);
        return true;
    } catch (error) {
        console.error("Playtrack feilet:", error);
        return false;
    }
}

async function pauseTrack() {
    if (!deviceId) return;
    await fetchWithFreshToken(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT' });
}

async function startGameLoop() {
    isGameRunning = true;
    hostLobbyView.classList.add('hidden');
    spotifyConnectView.classList.add('hidden');
    readyToPlayView.classList.add('hidden');
    gameHeader.classList.remove('hidden');
    hostGameView.classList.remove('hidden');

    await loadSpotifySdk();
    await initializeSpotifyPlayer();
    console.log("Spotify-spiller initialisert. Venter 1 sekund...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    await getAutocompleteLists();
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;

    gameChannel.send({ type: 'broadcast', event: 'game_start', payload: { players: players, ...autocompleteData } });
    currentPlayerIndex = 0;
    updateHud();
    await startTurn();
}

async function startTurn() {
    players.forEach(p => p.roundHandicap = 0);
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
    const respondingPlayer = players.find(p => p.name === payload.payload.name);
    if (!respondingPlayer) return;

    const { artist, title, year } = payload.payload;
    const yearGuess = parseInt(year, 10);
    const totalHandicap = respondingPlayer.handicap + (respondingPlayer.roundHandicap || 0);

    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';

    if (!isNaN(yearGuess)) {
        receivedYearRange.textContent = `${yearGuess} (${yearGuess - totalHandicap} - ${yearGuess + totalHandicap})`;
    } else {
        receivedYearRange.textContent = 'Ikke besvart';
    }

    hostTurnIndicator.textContent = `${respondingPlayer.name} har svart!`;
    hostAnswerDisplay.classList.remove('hidden');

    const artistGuess = normalizeString(artist);
    const titleGuess = normalizeString(title);
    const correctArtistNorm = normalizeString(currentSong.artist);
    const correctTitleNorm = normalizeString(currentSong.title);
    const correctYear = currentSong.year;

    let roundSp = 0, roundCredits = 0, feedbackMessages = [];

    const artistIsCorrect = artistGuess !== '' && artistGuess === correctArtistNorm;
    const titleIsCorrect = titleGuess !== '' && titleGuess === correctTitleNorm;

    if (artist !== '') respondingPlayer.stats.artistGuesses++;
    if (title !== '') respondingPlayer.stats.titleGuesses++;

    if (artistIsCorrect && titleIsCorrect) {
        roundCredits += 3;
        respondingPlayer.stats.artistCorrect++;
        respondingPlayer.stats.titleCorrect++;
        feedbackMessages.push("Artist & Tittel: +3 credits!");
    } else {
        if (artistIsCorrect) {
            roundCredits += 1;
            respondingPlayer.stats.artistCorrect++;
            feedbackMessages.push("Artist: +1 credit!");
        }
        if (titleIsCorrect) {
            roundCredits += 1;
            respondingPlayer.stats.titleCorrect++;
            feedbackMessages.push("Tittel: +1 credit!");
        }
    }

    if (!isNaN(yearGuess)) {
        respondingPlayer.stats.yearGuesses++;
        if (yearGuess === correctYear) {
            roundCredits += 3;
            respondingPlayer.stats.perfectYearGuesses++;
            feedbackMessages.push("Perfekt år: +3 credits!");
        }
        if (Math.abs(yearGuess - correctYear) <= totalHandicap) {
            roundSp += 1;
            respondingPlayer.stats.yearCorrect++;
            feedbackMessages.push("Årstall: +1 SP!");
        }
    }

    respondingPlayer.sp += roundSp;
    respondingPlayer.credits += roundCredits;

    const feedbackText = feedbackMessages.length > 0 ? `${respondingPlayer.name}: ${feedbackMessages.join(' ')}` : `${respondingPlayer.name} fikk ingen poeng.`;

    updateHud();

    fasitAlbumArt.src = currentSong.albumarturl || '';
    fasitArtist.textContent = currentSong.artist;
    fasitTitle.textContent = currentSong.title;
    fasitYear.textContent = currentSong.year;

    hostFasitDisplay.classList.remove('hidden');
    hostSongDisplay.classList.add('hidden');
    nextTurnBtn.classList.remove('hidden');

    gameChannel.send({ type: 'broadcast', event: 'round_result', payload: { players: players, feedback: feedbackText, song: currentSong } });
}

async function advanceToNextTurn() {
    await pauseTrack();
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    await startTurn();
}

function handleBuyHandicap(payload) {
    const playerName = payload.payload.name;
    const player = players.find(p => p.name === playerName);
    if (player && player.credits > 0) {
        player.credits--;
        player.roundHandicap += 2;
        hostTurnIndicator.textContent = `${playerName} kjøpte handicap!`;
        gameChannel.send({ type: 'broadcast', event: 'player_update', payload: { players: players } });
        updateHud();
    }
}

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

// === HOVED-INNGANGSPUNKT ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM er fullstendig lastet.");

    // Assign all DOM nodes
    spotifyConnectView = document.getElementById('spotify-connect-view');
    spotifyLoginBtn = document.getElementById('spotify-login-btn');
    hostLobbyView = document.getElementById('host-lobby-view');
    gameCodeDisplay = document.getElementById('game-code-display');
    playerLobbyList = document.getElementById('player-lobby-list');
    startGameBtn = document.getElementById('start-game-btn');
    readyToPlayView = document.getElementById('ready-to-play-view');
    startFirstRoundBtn = document.getElementById('start-first-round-btn');
    hostGameView = document.getElementById('host-game-view');
    hostTurnIndicator = document.getElementById('host-turn-indicator');
    hostAnswerDisplay = document.getElementById('host-answer-display');
    receivedArtist = document.getElementById('received-artist');
    receivedTitle = document.getElementById('received-title');
    receivedYear = document.getElementById('received-year');
    hostSongDisplay = document.getElementById('host-song-display');
    hostFasitDisplay = document.getElementById('host-fasit-display');
    fasitArtist = document.getElementById('fasit-artist');
    fasitTitle = document.getElementById('fasit-title');
    fasitYear = document.getElementById('fasit-year');
    nextTurnBtn = document.getElementById('next-turn-btn');
    playerHud = document.getElementById('player-hud');
    gameHeader = document.getElementById('game-header');
    gameCodeDisplayPermanent = document.getElementById('game-code-display-permanent');
    fasitAlbumArt = document.getElementById('fasit-album-art');
    receivedYearRange = document.getElementById('received-year-range');

    const spotifyCode = new URLSearchParams(window.location.search).get('code');
    if (spotifyCode) {
        // Returning from Spotify
        const success = await fetchSpotifyAccessToken(spotifyCode);
        if (success) {
            window.history.replaceState(null, '', window.location.pathname);
            const storedPlayers = sessionStorage.getItem('mquiz_players');
            const storedGameCode = sessionStorage.getItem('mquiz_gamecode');
            if (storedPlayers && storedGameCode) {
                players = JSON.parse(storedPlayers);
                setupGameLobby(storedGameCode);
                hostLobbyView.classList.add('hidden');
                spotifyConnectView.classList.add('hidden');
                readyToPlayView.classList.remove('hidden'); // Show "Start Første Runde"
            } else {
                setupGameLobby();
            }
        } else {
            alert('Klarte ikke hente Spotify-token.');
        }
    } else {
        // First load, start lobby
        setupGameLobby();
    }

    startGameBtn.addEventListener('click', () => {
        sessionStorage.setItem('mquiz_players', JSON.stringify(players));
        sessionStorage.setItem('mquiz_gamecode', gameCode);
        hostLobbyView.classList.add('hidden');
        spotifyConnectView.classList.remove('hidden');
    });

    spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin);

    startFirstRoundBtn.addEventListener('click', async () => {
        readyToPlayView.textContent = 'Laster Spotify-spiller...';
        await loadSpotifySdk();
        await startGameLoop();
    });

    nextTurnBtn.addEventListener('click', advanceToNextTurn);
});

/* Version: #397 */
