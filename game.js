/* Version: #183 */
// === CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;

// === DOM ELEMENTS ===
let preGameView, inGameView, startGameBtn,
    answerDisplay, albumArt, songTitle, songDetails,
    guessArea, yearGuessInput, submitGuessBtn,
    roundStatus, gameControls, nextRoundBtn;


// === SPOTIFY SDK & PLAYER ===
window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        initializeSpotifyPlayer(spotifyAccessToken);
    } else {
        // Hvis ingen token finnes, kan ikke spillet starte. Send tilbake.
        alert('Spotify-tilkobling mangler. Sender deg tilbake til hovedsiden.');
        window.location.href = 'index.html';
    }
};

function initializeSpotifyPlayer(token) {
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Spiller',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
        // Nå som spilleren er klar, kan vi aktivere startknappen
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Start Spill';
    });

    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Enhet har gått offline', device_id);
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Autentisering feilet:', message);
        alert('Spotify-autentisering feilet. Prøv å koble til på nytt fra hovedsiden.');
        window.location.href = 'index.html';
    });

    spotifyPlayer.connect();
}

async function playTrack(spotifyTrackId) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet. Åpne Spotify på en enhet og prøv igjen.');
        return;
    }
    const trackUri = `spotify:track:${spotifyTrackId}`;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${spotifyAccessToken}`
        },
    });
}


// === GAME LOGIC ===
async function fetchRandomSong() {
    // Steg 1: Få totalt antall sanger
    const { count, error: countError } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true });

    if (countError || count === 0) {
        console.error('Kunne ikke hente antall sanger:', countError);
        return null;
    }

    // Steg 2: Velg et tilfeldig tall
    const randomIndex = Math.floor(Math.random() * count);

    // Steg 3: Hent den ene, tilfeldige sangen
    const { data: song, error: songError } = await supabase
        .from('songs')
        .select('*')
        .range(randomIndex, randomIndex)
        .single();

    if (songError) {
        console.error('Kunne ikke hente tilfeldig sang:', songError);
        return null;
    }
    
    return song;
}

function startGame() {
    preGameView.classList.add('hidden');
    inGameView.classList.remove('hidden');
    playNextRound();
}

async function playNextRound() {
    // Tilbakestill UI for en ny runde
    roundStatus.textContent = 'Henter en ny sang...';
    guessArea.classList.remove('hidden');
    answerDisplay.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    yearGuessInput.value = '';
    albumArt.src = ''; // Tøm forrige bilde

    currentSong = await fetchRandomSong();

    if (currentSong) {
        roundStatus.textContent = 'Sangen spilles... Gjett årstallet!';
        await playTrack(currentSong.spotifyid);
    } else {
        roundStatus.textContent = 'Klarte ikke hente en sang. Prøv igjen.';
    }
}

function handleSubmitGuess() {
    const guess = parseInt(yearGuessInput.value, 10);
    if (!guess) {
        roundStatus.textContent = 'Vennligst skriv inn et årstall.';
        return;
    }

    if (guess === currentSong.year) {
        roundStatus.textContent = 'RIKTIG!';
        roundStatus.style.color = '#1DB954';
    } else {
        roundStatus.textContent = `FEIL! Riktig år var ${currentSong.year}.`;
        roundStatus.style.color = '#FF4136';
    }

    showAnswer();
}

function showAnswer() {
    // Vis sanginformasjon
    albumArt.src = currentSong.albumarturl || 'placeholder.png'; // Bruk et plassholderbilde hvis URL mangler
    songTitle.textContent = currentSong.title;
    songDetails.textContent = `${currentSong.artist} (${currentSong.year})`;
    
    // Oppdater UI
    answerDisplay.classList.remove('hidden');
    guessArea.classList.add('hidden');
    nextRoundBtn.classList.remove('hidden');
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent alle DOM-elementer
    preGameView = document.getElementById('pre-game-view');
    inGameView = document.getElementById('in-game-view');
    startGameBtn = document.getElementById('start-game-btn');
    answerDisplay = document.getElementById('answer-display');
    albumArt = document.getElementById('album-art');
    songTitle = document.getElementById('song-title');
    songDetails = document.getElementById('song-details');
    guessArea = document.getElementById('guess-area');
    yearGuessInput = document.getElementById('year-guess-input');
    submitGuessBtn = document.getElementById('submit-guess-btn');
    roundStatus = document.getElementById('round-status');
    gameControls = document.getElementById('game-controls');
    nextRoundBtn = document.getElementById('next-round-btn');

    // Deaktiver startknappen til Spotify er klar
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Kobler til Spotify...';

    // Sett opp event listeners
    startGameBtn.addEventListener('click', startGame);
    submitGuessBtn.addEventListener('click', handleSubmitGuess);
    nextRoundBtn.addEventListener('click', playNextRound);
});
/* Version: #183 */
