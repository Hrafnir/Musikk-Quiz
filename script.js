/* Version: #63 */
// === CONFIGURATION ===
const CLIENT_ID = '61939bcc94514b76bcdc268a7b258740';
const REDIRECT_URI = 'https://hrafnir.github.io/Musikk-Quiz/'; // Må matche det du satt i Spotify Dashboard
const SCOPES = [
    'streaming',                // Nødvendig for Web Playback SDK
    'user-read-email',          // For å bekrefte brukeren
    'user-read-private',        // For å bekrefte brukeren
    'user-modify-playback-state' // For å kunne styre avspilling
];

// === STATE ===
let accessToken = null;
let spotifyPlayer = null;
let deviceId = null;

// === DOM ELEMENTS ===
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const loginBtn = document.getElementById('login-btn');
const testPlayBtn = document.getElementById('test-play-btn');
const playerDeviceIdDiv = document.getElementById('player-device-id');


// === FUNCTIONS ===

/**
 * Håndterer logikken som kjører når siden lastes.
 * Sjekker om vi kommer tilbake fra Spotify med en nøkkel.
 */
function onPageLoad() {
    const hash = window.location.hash;
    window.location.hash = ""; // Fjern hash fra URL for en renere adresse

    if (hash) {
        const params = new URLSearchParams(hash.substring(1)); // fjerner #
        accessToken = params.get('access_token');
    }

    if (accessToken) {
        console.log('Har Access Token!', accessToken);
        localStorage.setItem('spotify_access_token', accessToken);
        initializeUI(true);
        initializeSpotifyPlayer();
    } else {
        // Prøv å hente fra localStorage i tilfelle refresh
        accessToken = localStorage.getItem('spotify_access_token');
        if (accessToken) {
            console.log('Fant Access Token i localStorage.');
            initializeUI(true);
            initializeSpotifyPlayer();
        } else {
            console.log('Ingen Access Token funnet.');
            initializeUI(false);
        }
    }
}

/**
 * Viser/skjuler UI-elementer basert på innloggingsstatus
 * @param {boolean} isLoggedIn 
 */
function initializeUI(isLoggedIn) {
    if (isLoggedIn) {
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
    }
}

/**
 * Sender brukeren til Spotify for å logge inn.
 */
function redirectToSpotifyLogin() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;
    window.location = authUrl;
}

/**
 * Initialiserer Spotify Web Playback SDK
 */
function initializeSpotifyPlayer() {
    window.onSpotifyWebPlaybackSDKReady = () => {
        spotifyPlayer = new Spotify.Player({
            name: 'MQuiz Spiller',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.5
        });

        // Feilhåndtering
        spotifyPlayer.addListener('initialization_error', ({ message }) => { console.error('Initialization Error:', message); });
        spotifyPlayer.addListener('authentication_error', ({ message }) => {
            console.error('Authentication Error:', message);
            // Token er sannsynligvis utløpt, tøm og send til login
            localStorage.removeItem('spotify_access_token');
            accessToken = null;
            initializeUI(false);
        });
        spotifyPlayer.addListener('account_error', ({ message }) => { console.error('Account Error:', message); });
        spotifyPlayer.addListener('playback_error', ({ message }) => { console.error('Playback Error:', message); });

        // Spilleren er klar
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('Spilleren er klar med Device ID:', device_id);
            deviceId = device_id;
            playerDeviceIdDiv.textContent = `Enhet klar: ${device_id}`;
        });

        // Koble til spilleren
        spotifyPlayer.connect().then(success => {
            if (success) {
                console.log('Spotify Player er koblet til!');
            }
        });
    };
}

/**
 * Spiller en sang ved å bruke API-kall (ikke SDK direkte)
 * @param {string} trackUri - Spotify URI for sangen (f.eks. "spotify:track:TRACK_ID")
 */
async function playTrack(trackUri) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet. Sjekk at du er online.');
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


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loginBtn.addEventListener('click', redirectToSpotifyLogin);
    
    testPlayBtn.addEventListener('click', () => {
        // Hardkodet a-ha - Take On Me for testing
        playTrack('spotify:track:2WfaOiMkCvy7F5fcp2zZ8L');
    });

    onPageLoad();
});
/* Version: #63 */
