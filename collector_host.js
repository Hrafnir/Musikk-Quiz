/* Version: #443 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let collectorLobbyView, gameCodeDisplay, playerLobbyList, startGameBtn, songsToWinInput,
    collectorGameView, playerHud, roundTimer, realtimeAnswerStatus, songPlayingDisplay,
    roundResultContainer, nextSongBtn, nextSongStatus,
    collectorVictoryView, winnerAnnouncement,
    gameHeader, gameCodeDisplayPermanent;

// === STATE ===
let user = null;
let gameCode = '';
let gameState = {}; // Alt av spilltilstand bor her
let gameChannel = null;
let answersChannel = null;

// === Promise for Spotify SDK (for senere bruk) ===
let resolveSpotifySdkReady;
const spotifySdkReadyPromise = new Promise(resolve => {
    resolveSpotifySdkReady = resolve;
});
window.onSpotifyWebPlaybackSDKReady = () => {
    if (resolveSpotifySdkReady) resolveSpotifySdkReady();
};


// === HOVEDFUNKSJONER ===

/**
 * Tar imot et spillobjekt fra databasen og oppdaterer hele UI-en for å matche.
 * Dette er den sentrale render-funksjonen.
 * @param {object} gameData - Hele raden fra 'games'-tabellen.
 */
function renderGame(gameData) {
    if (!gameData) return;

    console.log("Rendering game state for status:", gameData.status);
    gameState = gameData.game_state;
    
    // Skjul alle hovedvisninger
    collectorLobbyView.classList.add('hidden');
    collectorGameView.classList.add('hidden');
    collectorVictoryView.classList.add('hidden');
    gameHeader.classList.remove('hidden');

    // Oppdater felles elementer
    gameCodeDisplayPermanent.textContent = gameCode;
    updateHud();

    // Vis riktig hovedvisning basert på status
    switch (gameData.status) {
        case 'lobby':
            collectorLobbyView.classList.remove('hidden');
            gameHeader.classList.add('hidden'); // Skjul permanent kode i lobby
            updatePlayerLobby();
            break;
        case 'in_progress':
            collectorGameView.classList.remove('hidden');
            // TODO: Logikk for å vise timer, sanginfo etc.
            break;
        case 'round_summary':
            collectorGameView.classList.remove('hidden');
            roundResultContainer.classList.remove('hidden');
            // TODO: Logikk for å vise resultater
            break;
        case 'finished':
            collectorVictoryView.classList.remove('hidden');
            winnerAnnouncement.textContent = `Vinneren er ${gameState.winner}!`;
            break;
    }
}

/**
 * Oppdaterer spillerlisten i lobbyen.
 */
function updatePlayerLobby() {
    if (!playerLobbyList) return;
    const players = gameState.players || [];
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

/**
 * Oppdaterer HUD-en under spillet med sanger samlet.
 */
function updateHud() {
    if (!playerHud) return;
    const players = gameState.players || [];
    playerHud.innerHTML = '';
    players.forEach(player => {
        const songsCollected = player.songsCollected || 0;
        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info';
        // TODO: Legg til 'active-player' logikk hvis vi trenger det
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">Sanger: ${songsCollected}</div>`;
        playerHud.appendChild(playerInfoDiv);
    });
}


// === DATABASE & REALTIME ===

/**
 * Setter opp sanntids-abonnementer for spillet.
 */
function setupSubscriptions() {
    // Abonner på endringer i hoved-spillobjektet
    gameChannel = supabaseClient
        .channel(`game-${gameCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `game_code=eq.${gameCode}` }, 
            (payload) => {
                console.log('Game state change received:', payload);
                renderGame(payload.new);
            }
        )
        .subscribe();

    // Abonner på nye svar som kommer inn
    answersChannel = supabaseClient
        .channel(`answers-${gameCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_answers', filter: `game_code=eq.${gameCode}` },
            (payload) => {
                console.log('New answer received:', payload);
                // TODO: Oppdater UI for å vise at en spiller har svart
                const answer = payload.new;
                const statusEl = document.getElementById(`player-status-${answer.player_id}`);
                if (statusEl) {
                    statusEl.textContent = '✓';
                }
            }
        )
        .subscribe();
}

/**
 * Oppretter et helt nytt spill i databasen.
 */
async function initializeLobby() {
    console.log("Initializing new lobby...");
    // ENDRET: Bruker unik nøkkel
    localStorage.removeItem('mquiz_collector_host_gamecode');
    localStorage.removeItem('mquiz_collector_host_id');

    let success = false;
    while (!success) {
        gameCode = Math.floor(100000 + Math.random() * 900000).toString();
        const initialGameState = {
            players: [],
            songsToWin: parseInt(songsToWinInput.value, 10) || 10,
            currentRound: 0,
            currentSong: null,
            roundWinner: null
        };
        const { error } = await supabaseClient.from('games').insert({
            game_code: gameCode,
            host_id: user.id,
            game_state: initialGameState,
            status: 'lobby'
        });
        if (!error) success = true;
    }
    
    // ENDRET: Bruker unik nøkkel
    localStorage.setItem('mquiz_collector_host_gamecode', gameCode);
    localStorage.setItem('mquiz_collector_host_id', user.id);
    
    gameCodeDisplay.textContent = gameCode;
    setupSubscriptions();
    renderGame({ status: 'lobby', game_state: { players: [] } }); // Manuell første render
}


// === SPILLFLYT-HANDLINGER ===

async function handleStartGameClick() {
    console.log("Start game button clicked.");
    // TODO: Legg til Spotify-sjekk her senere
    
    const { error } = await supabaseClient
        .from('games')
        .update({ status: 'in_progress' })
        .eq('game_code', gameCode);

    if (error) console.error("Could not start game:", error);
}

async function startRound() {
    console.log("Starting a new round...");
    // Dette er en placeholder. Logikken kommer i neste steg.
}


// === MAIN ENTRY POINT ===

document.addEventListener('DOMContentLoaded', async () => {
    // Tildel DOM-elementer
    collectorLobbyView = document.getElementById('collector-lobby-view');
    gameCodeDisplay = document.getElementById('game-code-display');
    playerLobbyList = document.getElementById('player-lobby-list');
    startGameBtn = document.getElementById('start-game-btn');
    songsToWinInput = document.getElementById('songs-to-win-input');
    collectorGameView = document.getElementById('collector-game-view');
    playerHud = document.getElementById('player-hud');
    roundTimer = document.getElementById('round-timer');
    realtimeAnswerStatus = document.getElementById('realtime-answer-status');
    songPlayingDisplay = document.getElementById('song-playing-display');
    roundResultContainer = document.getElementById('round-result-container');
    nextSongBtn = document.getElementById('next-song-btn');
    nextSongStatus = document.getElementById('next-song-status');
    collectorVictoryView = document.getElementById('collector-victory-view');
    winnerAnnouncement = document.getElementById('winner-announcement');
    gameHeader = document.getElementById('game-header');
    gameCodeDisplayPermanent = document.getElementById('game-code-display-permanent');
    
    // Felles lyttere
    startGameBtn.addEventListener('click', handleStartGameClick);

    // Hoved oppstartslogikk
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        user = session.user;
        // ENDRET: Bruker unik nøkkel
        const localGameCode = localStorage.getItem('mquiz_collector_host_gamecode');
        const localHostId = localStorage.getItem('mquiz_collector_host_id');

        if (localGameCode && localHostId === user.id) {
            // Prøv å gjenoppta
            const { data: gameData, error } = await supabaseClient.from('games').select('*').eq('game_code', localGameCode).single();
            if (gameData && !error) {
                gameCode = localGameCode;
                setupSubscriptions();
                renderGame(gameData);
            } else {
                await initializeLobby();
            }
        } else {
            await initializeLobby();
        }
    } else {
        window.location.href = 'index.html';
    }
});
/* Version: #443 */
