/* Version: #320 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('host.js lastet. Supabase-klient klar.');

// === DOM ELEMENTS ===
const gameCodeDisplay = document.getElementById('game-code-display');
const playerLobbyList = document.getElementById('player-lobby-list');
const startGameBtn = document.getElementById('start-game-btn');

// === STATE ===
let players = [];
let gameCode = '';
let gameChannel = null;

// === FUNCTIONS ===
function updatePlayerLobby() {
    console.log('updatePlayerLobby() kalt. Spillere nå:', players);
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

async function setupGame() {
    console.log('setupGame() starter.');
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    console.log(`Generert spillkode: ${gameCode}`);

    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    console.log(`Opprettet referanse til kanal: ${channelName}`);

    gameChannel.on('broadcast', { event: 'player_join' }, (payload) => {
        console.log('--- MOTTOK "player_join" MELDING! ---');
        console.log('Payload mottatt:', payload);
        
        const newPlayerName = payload.payload.name;
        if (!players.some(p => p.name === newPlayerName)) {
            console.log(`Legger til ny spiller: ${newPlayerName}`);
            players.push({ name: newPlayerName });
            updatePlayerLobby();
        } else {
            console.warn(`Spiller "${newPlayerName}" prøvde å bli med, men finnes allerede.`);
        }
    });

    console.log('Kaller gameChannel.subscribe() for host...');
    gameChannel.subscribe((status) => {
        console.log(`Host subscribe-status endret til: ${status}`);
        if (status === 'SUBSCRIBED') {
            console.log(`Host er nå klar og lytter på kanalen: ${channelName}`);
        } else if (status !== 'SUBSCRIBED') {
            console.error('Host kunne ikke koble seg til kanalen.');
            gameCodeDisplay.textContent = "FEIL";
        }
    });
}

// === INITIALIZE ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('Host DOMContentLoaded.');
    setupGame();
});
/* Version: #320 */
