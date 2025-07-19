/* Version: #69 */
// === CONFIGURATION ===
const CLIENT_ID = '61939bcc94514b76bcdc268a7b258740';
// KORRIGERT: Må matche nøyaktig det du har i Spotify Dashboard
const REDIRECT_URI = 'https://hrafnir.github.io/Musikk-Quiz/callback.html'; 
const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state'
];

// === STATE ===
let accessToken = null;
let spotifyPlayer = null;
let deviceId = null;

// === SPOTIFY SDK INITIALIZATION ===
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify SDK er klar.');
    if (accessToken) {
        initializeSpotifyPlayer();
    }
};

/**
 * Hovedfunksjon som kjører når hele HTML-dokumentet er lastet og klart.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM er fullstendig lastet. Starter app-logikk.');

    const loginBtn = document.getElementById('login-btn');
    const testPlayBtn = document.getElementById('test-play-btn');

    if (!loginBtn) {
        console.error('FEIL: Fant ikke "login-btn". Sjekk index.html.');
        return;
    }

    loginBtn.addEventListener('click', redirectToSpotifyLogin);
    testPlayBtn.addEventListener('click', () => {
        playTrack('spotify:track:2WfaOiMkCvy7F5fcp2zZ8L');
    });

    // Lytt etter melding fra callback-vinduet
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) {
            return;
        }
        const { type, token, error } = event.data;
        if (type === 'spotify-auth') {
            if (token) {
                accessToken = token;
                localStorage.setItem('spotify_access_token', accessToken);
                console.log('Mottok Access Token fra callback!', accessToken);
                handleSuccessfulLogin();
            } else if (error) {
                alert(`Innlogging feilet: ${error}`);
            }
        }
    });

    handlePageLoad();
});

// === FUNCTIONS ===

function handlePageLoad() {
    accessToken = localStorage.getItem('spotify_access_token');
    if (accessToken) {
        console.log('Fant Access Token i localStorage.');
        handleSuccessfulLogin();
    } else {
        console.log('Ingen Access Token funnet.');
        initializeUI(false);
    }
}

function handleSuccessfulLogin() {
    initializeUI(true);
    if (window.Spotify) {
        initializeSpotifyPlayer();
    }
}

function initializeUI(isLoggedIn) {
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    if (isLoggedIn) {
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
    }
}

function redirectToSpotifyLogin() {
    console.log('Åpner Spotify innloggingsvindu...');
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;
    // Åpne i et popup-vindu for en bedre opplevelse
    const width = 500, height = 600;
    const left = (screen.width / 2) - (width / 2);
    const top = (screen.height / 2) - (height / 2);
    window.open(authUrl, 'Spotify', `width=${width},height=${height},top=${top},left=${left}`);
}

function initializeSpotifyPlayer() {
    if (spotifyPlayer) return;

    const playerDeviceIdDiv = document.getElementById('player-device-id');
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Spiller',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    spotifyPlayer.addListener('initialization_error', ({ message }) => console.error('Init Error:', message));
    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Auth Error:', message);
        localStorage.removeItem('spotify_access_token');
        accessToken = null;
        alert('Innlogging utløpt. Vennligst logg inn på nytt.');
        initializeUI(false);
    });
    spotifyPlayer.addListener('account_error', ({ message }) => console.error('Account Error:', message));
    spotifyPlayer.addListener('playback_error', ({ message }) => console.error('Playback Error:', message));
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spilleren er klar med Device ID:', device_id);
        deviceId = device_id;
        playerDeviceIdDiv.textContent = `Enhet klar: ${device_id}`;
    });

    spotifyPlayer.connect().then(success => {
        if (success) console.log('Spotify Player er koblet til!');
    });
}

async function playTrack(trackUri) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet. Åpne Spotify på en enhet og prøv igjen.');
        return;
    }
    const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    try {
        const response = await fetch(url, {
            method: 'PUT',
            body: JSON.stringify({ uris: [trackUri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
        });
        if (response.ok) {
            console.log(`Starter avspilling av ${trackUri}`);
        } else {
            console.error('Klarte ikke starte avspilling:', await response.json());
        }
    } catch (error) {
        console.error('Nettverksfeil ved forsøk på avspilling:', error);
    }
}
/* Version: #69 */
