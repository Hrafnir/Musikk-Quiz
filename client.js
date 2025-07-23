/* Version: #320 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('client.js lastet. Supabase-klient klar.');

// === DOM ELEMENTS ===
const joinView = document.getElementById('join-view');
const waitingView = document.getElementById('waiting-view');
const gameCodeInput = document.getElementById('game-code-input');
const playerNameInput = document.getElementById('player-name-input');
const joinBtn = document.getElementById('join-btn');
const joinStatus = document.getElementById('join-status');
const displayPlayerName = document.getElementById('display-player-name');

// === STATE ===
let gameChannel = null;

// === FUNCTIONS ===
async function joinGame() {
    console.log('joinGame() funksjon kalt.');
    const gameCode = gameCodeInput.value.trim();
    const playerName = playerNameInput.value.trim();

    if (!gameCode || !playerName) {
        console.error('Mangler spillkode eller navn.');
        joinStatus.textContent = 'Du må fylle ut både spillkode og navn.';
        return;
    }

    console.log(`Forsøker å bli med i spill: ${gameCode} som ${playerName}`);
    joinStatus.textContent = 'Kobler til...';
    joinBtn.disabled = true;

    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    console.log(`Opprettet referanse til kanal: ${channelName}`);

    console.log('Kaller gameChannel.subscribe()...');
    gameChannel.subscribe((status) => {
        // DENNE VIL LOGGE ALLE STATUS-ENDRINGER
        console.log(`Subscribe-status endret til: ${status}`);

        if (status === 'SUBSCRIBED') {
            console.log('Vellykket tilkobling! Sender "player_join" melding.');
            gameChannel.send({
                type: 'broadcast',
                event: 'player_join',
                payload: { name: playerName },
            });

            console.log('Oppdaterer UI til "waiting-view".');
            joinView.classList.add('hidden');
            waitingView.classList.remove('hidden');
            displayPlayerName.textContent = playerName;
            joinStatus.textContent = '';

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`Kanalfeil eller timeout. Status: ${status}`);
            joinStatus.textContent = 'Feil: Fant ikke spillet. Sjekk koden.';
            joinBtn.disabled = false;
        }
    });
}

// === EVENT LISTENERS ===
console.log('Legger til event listener på joinBtn.');
joinBtn.addEventListener('click', joinGame);
/* Version: #320 */
