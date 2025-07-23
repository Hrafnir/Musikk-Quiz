/* Version: #318 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
const gameCodeDisplay = document.getElementById('game-code-display');
const playerLobbyList = document.getElementById('player-lobby-list');
const startGameBtn = document.getElementById('start-game-btn');

// === STATE ===
let players = [];
let gameCode = '';
let gameChannel = null;

// === FUNCTIONS ===

// Oppdaterer spillerlisten i UI
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

// Hovedfunksjon for å sette opp spillet
async function setupGame() {
    // 1. Generer en unik, 6-sifret kode
    gameCode = Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;

    // 2. Opprett en unik sanntidskanal for dette spillet
    gameChannel = supabaseClient.channel(`game-${gameCode}`);

    // 3. Sett opp en lytter for når spillere blir med
    gameChannel.on('broadcast', { event: 'player_join' }, (payload) => {
        console.log('Spiller ble med:', payload);
        const newPlayerName = payload.payload.name;
        
        // Unngå duplikater
        if (!players.some(p => p.name === newPlayerName)) {
            players.push({ name: newPlayerName });
            updatePlayerLobby();
        }
    });

    // 4. Abonner på kanalen for å begynne å motta meldinger
    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Vellykket tilkobling til kanal: game-${gameCode}`);
        } else {
            console.error('Kunne ikke koble til kanalen.');
            gameCodeDisplay.textContent = "FEIL";
        }
    });
}

// === EVENT LISTENERS ===
// TODO: Legg til funksjonalitet for start-knappen i neste steg
// startGameBtn.addEventListener('click', () => { ... });

// === INITIALIZE ===
document.addEventListener('DOMContentLoaded', () => {
    setupGame();
});
/* Version: #318 */
