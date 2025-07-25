/* Version: #466 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let collectorJoinView, gameCodeInput, playerNameInput, joinBtn, joinStatus,
    collectorGameView, playerHud, gameStatusText, displayPlayerName,
    answerSubmissionView,
    artistGuessInput, submitArtistBtn, artistSubmitStatus,
    titleGuessInput, submitTitleBtn, titleSubmitStatus,
    yearGuessInput, submitYearBtn, yearSubmitStatus,
    roundSummaryView,
    newGameLink;

// === STATE ===
let gameCode = '';
let myName = '';
let gameChannel = null;
let answersChannel = null;
let gameState = {};

// === HOVEDFUNKSJONER ===

function renderGame(gameData) {
    if (!gameData) return;
    gameState = gameData.game_state;
    collectorJoinView.classList.add('hidden');
    collectorGameView.classList.remove('hidden');
    answerSubmissionView.classList.add('hidden');
    roundSummaryView.classList.add('hidden');
    updateHud();
    switch (gameData.status) {
        case 'lobby': gameStatusText.textContent = "Venter på at hosten skal starte spillet..."; break;
        case 'in_progress': gameStatusText.textContent = `Runde ${gameState.currentRound} pågår!`; answerSubmissionView.classList.remove('hidden'); artistSubmitStatus.textContent = ''; titleSubmitStatus.textContent = ''; yearSubmitStatus.textContent = ''; break;
        case 'round_summary': gameStatusText.textContent = `Runde ${gameState.currentRound} er ferdig.`; roundSummaryView.classList.remove('hidden'); break;
        case 'finished': gameStatusText.textContent = "Spillet er over!"; break;
    }
}

function updateHud() {
    if (!playerHud) return;
    const players = gameState.players || [];
    playerHud.innerHTML = '';
    players.forEach(player => {
        const songsCollected = player.songsCollected || 0;
        const playerInfoDiv = document.createElement('div');
        playerInfoDiv.className = 'player-info'; 
        if (player.name === myName) playerInfoDiv.classList.add('active-player');
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">Sanger: ${songsCollected}</div>`;
        playerHud.appendChild(playerInfoDiv);
    });
}

// === DATABASE & REALTIME ===

function setupSubscriptions() {
    gameChannel = supabaseClient.channel(`game-${gameCode}`);
    gameChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `game_code=eq.${gameCode}` }, 
            (payload) => renderGame(payload.new)
        )
        .subscribe();

    answersChannel = supabaseClient.channel(`answers-${gameCode}`);
    answersChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_answers', filter: `game_code=eq.${gameCode}` },
            (payload) => {
                if (payload.new.player_id === myName) {
                    if (payload.new.artist_answer) artistSubmitStatus.textContent = '✓ Artist lagret';
                    if (payload.new.title_answer) titleSubmitStatus.textContent = '✓ Tittel lagret';
                    if (payload.new.year_answer) yearSubmitStatus.textContent = '✓ År lagret';
                }
            }
        )
        .subscribe();
}

async function handleJoinGame() {
    gameCode = gameCodeInput.value.trim();
    myName = playerNameInput.value.trim();
    if (!gameCode || !myName) { joinStatus.textContent = 'Du må fylle ut både spillkode og navn.'; return; }
    joinBtn.disabled = true;
    joinStatus.textContent = 'Sjekker spillkode...';

    try {
        const { data: gameData, error: gameError } = await supabaseClient.from('games').select('game_state, status').eq('game_code', gameCode).single();
        if (gameError || !gameData) throw new Error("Fant ikke noe spill med den koden.");
        if (gameData.status !== 'lobby') throw new Error("Det spillet har allerede startet.");
        
        const currentPlayers = gameData.game_state.players || [];
        if (currentPlayers.some(p => p.name === myName)) throw new Error("En spiller med det navnet er allerede med.");
        
        const newPlayer = { name: myName, songsCollected: 0 };
        const updatedPlayers = [...currentPlayers, newPlayer];
        
        const { error: updateError } = await supabaseClient.from('games').update({ game_state: { ...gameData.game_state, players: updatedPlayers } }).eq('game_code', gameCode);
        if (updateError) throw new Error("Kunne ikke legge deg til i spillet.");
        
        // ENDRET: Sender "ping" etter vellykket databaseoppdatering
        const channel = supabaseClient.channel(`game-${gameCode}`);
        channel.subscribe(status => {
            if (status === 'SUBSCRIBED') {
                console.log("LOG (Client): Channel subscribed, sending ping.");
                channel.send({ type: 'broadcast', event: 'ping', payload: { message: 'player_joined' } });
                supabaseClient.removeChannel(channel); // Rydd opp
            }
        });

        joinStatus.textContent = 'Koblet til!';
        localStorage.setItem('mquiz_collector_client_gamecode', gameCode);
        localStorage.setItem('mquiz_collector_playername', myName);
        
        displayPlayerName.textContent = myName;
        gameState = { ...gameData.game_state, players: updatedPlayers };
        setupSubscriptions();
        renderGame({ status: 'lobby', game_state: gameState });
    } catch (error) {
        joinStatus.textContent = `Feil: ${error.message}`;
        joinBtn.disabled = false;
    }
}

async function submitAnswerPart(part, value, statusElement) {
    if (!value) return;
    statusElement.textContent = 'Sender...';
    const answerData = {
        game_code: gameCode,
        round_number: gameState.currentRound,
        player_id: myName,
        [`${part}_answer`]: value,
        submitted_at: new Date().toISOString()
    };
    const { error } = await supabaseClient.from('round_answers').upsert(answerData, { onConflict: 'game_code,round_number,player_id' });
    if (error) {
        statusElement.textContent = 'Feil!';
    } else {
        // Ping for svar
        const channel = supabaseClient.channel(`game-${gameCode}`);
        channel.subscribe(status => {
            if (status === 'SUBSCRIBED') {
                channel.send({ type: 'broadcast', event: 'ping', payload: { message: 'player_answered', player: myName, part: part } });
                supabaseClient.removeChannel(channel);
            }
        });
    }
}

function handleLeaveGame(event) {
    event.preventDefault();
    if (confirm("Er du sikker?")) {
        localStorage.removeItem('mquiz_collector_client_gamecode');
        localStorage.removeItem('mquiz_collector_playername');
        window.location.reload();
    }
}


// === MAIN ENTRY POINT ===
document.addEventListener('DOMContentLoaded', () => {
    collectorJoinView = document.getElementById('collector-join-view');
    gameCodeInput = document.getElementById('game-code-input');
    playerNameInput = document.getElementById('player-name-input');
    joinBtn = document.getElementById('join-btn');
    joinStatus = document.getElementById('join-status');
    collectorGameView = document.getElementById('collector-game-view');
    playerHud = document.getElementById('player-hud');
    gameStatusText = document.getElementById('game-status-text');
    displayPlayerName = document.getElementById('display-player-name');
    answerSubmissionView = document.getElementById('answer-submission-view');
    roundSummaryView = document.getElementById('round-summary-view');
    newGameLink = document.getElementById('new-game-link');
    artistGuessInput = document.getElementById('artist-guess-input');
    submitArtistBtn = document.getElementById('submit-artist-btn');
    artistSubmitStatus = document.getElementById('artist-submit-status');
    titleGuessInput = document.getElementById('title-guess-input');
    submitTitleBtn = document.getElementById('submit-title-btn');
    titleSubmitStatus = document.getElementById('title-submit-status');
    yearGuessInput = document.getElementById('year-guess-input');
    submitYearBtn = document.getElementById('submit-year-btn');
    yearSubmitStatus = document.getElementById('year-submit-status');

    joinBtn.addEventListener('click', handleJoinGame);
    newGameLink.addEventListener('click', handleLeaveGame);
    submitArtistBtn.addEventListener('click', () => submitAnswerPart('artist', artistGuessInput.value, artistSubmitStatus));
    submitTitleBtn.addEventListener('click', () => submitAnswerPart('title', titleGuessInput.value, titleSubmitStatus));
    submitYearBtn.addEventListener('click', () => submitAnswerPart('year', yearGuessInput.value, yearSubmitStatus));

    const savedCode = localStorage.getItem('mquiz_collector_client_gamecode');
    const savedName = localStorage.getItem('mquiz_collector_playername');
    if (savedCode && savedName) {
        gameCode = savedCode;
        myName = savedName;
        displayPlayerName.textContent = myName;
        supabaseClient.from('games').select('*').eq('game_code', gameCode).single().then(({data, error}) => {
            if (data && !error) {
                setupSubscriptions();
                renderGame(data);
            } else {
                localStorage.clear();
                window.location.reload();
            }
        });
    }
});
/* Version: #466 */
