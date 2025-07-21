/* Version: #186 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === SPOTIFY CONFIGURATION ===
const SPOTIFY_CLIENT_ID = '61939bcc94514b76bcdc268a7b258740';
const SPOTIFY_REDIRECT_URI = 'https://hrafnir.github.io/Musikk-Quiz/index.html';
const SPOTIFY_SCOPES = [
    'streaming', 'user-read-email', 'user-read-private', 'user-modify-playback-state'
];

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;

// === DOM ELEMENTS ===
// NY: Lagt til startQuizBtn
let loginView, loggedInView, googleLoginBtn, logoutBtn, userEmailSpan,
    spotifyConnectView, spotifyConnectedView, spotifyLoginBtn, testPlayBtn, startQuizBtn;

// === SPOTIFY SDK INITIALIZATION ===
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify SDK er klar.');
    // Henter token fra localStorage i tilfelle siden lastes på nytt
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        initializeSpotifyPlayer();
    }
};

// ... (Resten av funksjonene er uendret) ...
function generateRandomString(length) { let text = ''; const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < length; i++) { text += possible.charAt(Math.floor(Math.random() * possible.length)); } return text; }
async function generateCodeChallenge(codeVerifier) { const data = new TextEncoder().encode(codeVerifier); const digest = await window.crypto.subtle.digest('SHA-256', data); return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function signInWithGoogle() { await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/index.html' } }); }
async function signOut() { await supabaseClient.auth.signOut(); localStorage.removeItem('spotify_access_token'); spotifyAccessToken = null; }
async function redirectToSpotifyLogin() { const codeVerifier = generateRandomString(128); const codeChallenge = await generateCodeChallenge(codeVerifier); localStorage.setItem('spotify_code_verifier', codeVerifier); const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES.join(' '))}&code_challenge_method=S256&code_challenge=${codeChallenge}`; window.location = authUrl; }
async function fetchSpotifyAccessToken(code) { const codeVerifier = localStorage.getItem('spotify_code_verifier'); if (!codeVerifier) return; const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: code, redirect_uri: SPOTIFY_REDIRECT_URI, code_verifier: codeVerifier, }), }); if (response.ok) { const data = await response.json(); spotifyAccessToken = data.access_token; localStorage.setItem('spotify_access_token', spotifyAccessToken); console.log('Mottok Spotify Access Token!'); updateSpotifyUI(true); if (window.Spotify && !spotifyPlayer) initializeSpotifyPlayer(); } else { console.error('Klarte ikke hente Spotify access token'); } }
function updateUI(user) { if (user) { loginView.classList.add('hidden'); loggedInView.classList.remove('hidden'); userEmailSpan.textContent = user.email; } else { loginView.classList.remove('hidden'); loggedInView.classList.add('hidden'); userEmailSpan.textContent = ''; updateSpotifyUI(false); } }
function updateSpotifyUI(isConnected) { if (isConnected) { spotifyConnectView.classList.add('hidden'); spotifyConnectedView.classList.remove('hidden'); } else { spotifyConnectView.classList.remove('hidden'); spotifyConnectedView.classList.add('hidden'); } }
function initializeSpotifyPlayer() { if (spotifyPlayer) return; spotifyPlayer = new Spotify.Player({ name: 'MQuiz Spiller', getOAuthToken: cb => { cb(spotifyAccessToken); }, volume: 0.5 }); spotifyPlayer.addListener('ready', ({ device_id }) => { console.log('Spilleren er klar med Device ID:', device_id); deviceId = device_id; }); spotifyPlayer.addListener('authentication_error', () => { localStorage.removeItem('spotify_access_token'); spotifyAccessToken = null; updateSpotifyUI(false); }); spotifyPlayer.connect(); }
async function playTrack(trackUri) { if (!deviceId) { alert('Ingen aktiv Spotify-enhet funnet. Åpne Spotify på en enhet og prøv igjen.'); return; } const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; await fetch(url, { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${spotifyAccessToken}` }, }); }

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Henter DOM-elementer
    loginView = document.getElementById('auth-login'); 
    loggedInView = document.getElementById('auth-loggedin'); 
    googleLoginBtn = document.getElementById('google-login-btn'); 
    logoutBtn = document.getElementById('logout-btn'); 
    userEmailSpan = document.getElementById('user-email'); 
    spotifyConnectView = document.getElementById('spotify-connect-view'); 
    spotifyConnectedView = document.getElementById('spotify-connected-view'); 
    spotifyLoginBtn = document.getElementById('spotify-login-btn'); 
    testPlayBtn = document.getElementById('test-play-btn');
    // NY: Henter den nye knappen
    startQuizBtn = document.getElementById('start-quiz-btn');

    // Setter opp event listeners
    googleLoginBtn.addEventListener('click', signInWithGoogle); 
    logoutBtn.addEventListener('click', signOut); 
    spotifyLoginBtn.addEventListener('click', redirectToSpotifyLogin); 
    testPlayBtn.addEventListener('click', () => playTrack('spotify:track:2WfaOiMkCvy7F5fcp2zZ8L'));
    // NY: Legger til event listener for den nye knappen
    startQuizBtn.addEventListener('click', () => {
        window.location.href = 'game.html';
    });
    
    // Håndterer auth state
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateUI(session?.user ?? null);
        if (session) {
            const spotifyCode = new URLSearchParams(window.location.search).get('code');
            if (spotifyCode) {
                fetchSpotifyAccessToken(spotifyCode);
                window.history.replaceState(null, '', window.location.pathname);
            } else {
                spotifyAccessToken = localStorage.getItem('spotify_access_token');
                if (spotifyAccessToken) {
                    updateSpotifyUI(true);
                    if (window.Spotify && !spotifyPlayer) {
                        initializeSpotifyPlayer();
                    }
                }
            }
        }
    });
});
/* Version: #186 */
