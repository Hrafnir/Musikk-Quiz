/* Version: #391 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- TEST VERSJON #391 ---");
    console.log("DOM er fullstendig lastet. Starter applikasjonslogikk.");

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

    function setupGameLobby() {
        gameCode = Math.floor(100000 + Math.random() * 900000).toString();
        gameCodeDisplay.textContent = gameCode;
        
        const channelName = `game-${gameCode}`;
        gameChannel = supabaseClient.channel(channelName);
        
        gameChannel.on('broadcast', { event: 'player_join' }, (payload) => {
            const newPlayerName = payload.payload.name;
            if (!players.some(p => p.name === newPlayerName)) {
                players.push({ name: newPlayerName });
                updatePlayerLobby();
            }
        });

        gameChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') { 
                console.log(`Lobby er klar og lytter på kanalen: ${channelName}`); 
            } else {
                console.error("Kunne ikke koble til lobby-kanal.");
            }
        });
    }

    // Start kun lobbyen
    setupGameLobby();
});
/* Version: #391 */
