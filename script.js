/* Version: #73 */
// === CONFIGURATION ===
const CLIENT_ID = '61939bcc94514b76bcdc268a7b258740';
// DEN ENE, SANNE URI. Denne må være 100% identisk med det som er lagret i Spotify Dashboard.
const REDIRECT_URI = 'https://hrafnir.github.io/Musikk-Quiz/'; 
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

// === PKCE HELPER FUNCTIONS ===
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// === MAIN LOGIC ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM er fullstendig lastet. Starter app-logikk.');
    
    const loginBtn = document.getElementById('login-btn');
    const testPlayBtn = document.getElementById('test-play-btn');

    if (!loginBtn) {
        console.error('FEIL: Fant ikke "login-btn".');
        return;
    }

    loginBtn.addEventListener('click', redirectToSpotifyLogin);
    testPlayBtn.addEventListener('click', () => {
        playTrack('spotify:track:2WfaOiMkCvy7F5fcp2zZ8L');
    });

    handlePageLoad();
});

async function redirectToSpotifyLogin() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}`;
    
    console.log('Omdirigerer til Spotify for innlogging...');
    window.location = authUrl;
}

function handlePageLoad() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('Mottok autorisasjonskode fra Spotify. Henter access token...');
        fetchAccessToken(code);
        window.history.pushState({}, document.title, window.location.pathname);
    } else {
        accessToken = localStorage.getItem('spotify_access_token');
        if (accessToken) {
            console.log('Fant Access Token i localStorage.');
            handleSuccessfulLogin();
        } else {
            console.log('Ingen Access Token eller kode funnet.');
            initializeUI(false);
        }
    }
}

async function fetchAccessToken(code) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
        console.error("Mangler code_verifier. Kan ikke hente token.");
        initializeUI(false);
        return;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    });

    if (response.ok) {
        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('spotify_access_token', accessToken);
        console.log('Mottok Access Token!', accessToken);
        handleSuccessfulLogin();
    } else {
        console.error('Klarte ikke hente access token', await response.json());
        alert('En feil oppstod under innlogging. Prøv igjen.');
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

function initializeSpotifyPlayer() {
    if (spotifyPlayer) return;
    const playerDeviceIdDiv = document.getElementById('player-device-id');
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Spiller',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spilleren er klar med Device ID:', device_id);
        deviceId = device_id;
        playerDeviceIdDiv.textContent = `Enhet klar: ${device_id}`;
    });
    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Auth Error:', message);
        localStorage.removeItem('spotify_access_token');
        accessToken = null;
        alert('Innlogging utløpt. Vennligst logg inn på nytt.');
        initializeUI(false);
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
        if (!response.ok) {
            console.error('Klarte ikke starte avspilling:', await response.json());
        }
    } catch (error) {
        console.error('Nettverksfeil ved forsøk på avspilling:', error);
    }
}
/* Version: #73 */
