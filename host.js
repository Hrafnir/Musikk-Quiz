/* Version: #324 */
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

// === STATE ===
let players = [];
let gameCode = '';
let gameChannel = null;
let currentPlayerIndex = 0;

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
function startGame() {
    console.log("Starter spillet...");
    hostLobbyView.classList.add('hidden');
    hostGameView.classList.remove('hidden');

    // Send melding til alle klienter om at spillet starter
    gameChannel.send({ type: 'broadcast', event: 'game_start' });
    
    // Start første runde
    currentPlayerIndex = 0;
    startTurn();
}

function startTurn() {
    const currentPlayer = players[currentPlayerIndex];
    console.log(`Starter tur for ${currentPlayer.name}`);
    hostTurnIndicator.textContent = `Venter på svar fra ${currentPlayer.name}...`;
    hostAnswerDisplay.classList.add('hidden'); // Skjul forrige svar

    // Send melding til alle om hvem sin tur det er
    gameChannel.send({
        type: 'broadcast',
        event: 'new_turn',
        payload: { name: currentPlayer.name }
    });
}

function handleAnswer(payload) {
    console.log("Svar mottatt:", payload);
    const { artist, title, year } = payload.payload;
    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';

    hostTurnIndicator.textContent = `${players[currentPlayerIndex].name} har svart!`;
    hostAnswerDisplay.classList.remove('hidden');

    // TODO: I neste steg vil vi vise fasit og gå til neste spiller
}

// === SETUP ===
async function setupGame() {
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);

    // Lytter etter spillere som blir med
    gameChannel.on('broadcast', { event: 'player_join' }, (payload) => {
        const newPlayerName = payload.payload.name;
        if (!players.some(p => p.name === newPlayerName)) {
            players.push({ name: newPlayerName });
            updatePlayerLobby();
        }
    });

    // NYTT: Lytter etter svar fra spillere
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
/* Version: #324 */
