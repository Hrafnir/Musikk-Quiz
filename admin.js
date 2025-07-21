/* Version: #220 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
// KORRIGERT: Limt inn den korrekte, fullstendige nøkkelen på nytt
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer,
    testSpotifyBtn, spotifyTestStatus, testCoverArt;

// === SPOTIFY PLAYER INITIALIZATION ===
window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        initializeSpotifyPlayer(spotifyAccessToken);
    }
};

function initializeSpotifyPlayer(token) {
    if (spotifyPlayer) return;
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Admin Tester',
        getOAuthToken: cb => { cb(token); }
    });
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Admin Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
    });
    spotifyPlayer.connect();
}

async function playTestTrack(trackId) {
    if (!deviceId) {
        spotifyTestStatus.textContent += ' | Ingen Spotify-spiller funnet.';
        spotifyTestStatus.style.color = '#FFDC00';
        return;
    }
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        headers: { 'Authorization': `Bearer ${spotifyAccessToken}` },
    });
}

// === AUTHENTICATION & DATA ===
async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' }
    });
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

async function populateCheckboxes() {
    const { data: genres, error: genresError } = await supabaseClient.from('genre').select('id, name');
    if (genresError) { genresContainer.textContent = 'Kunne ikke laste sjangre.'; console.error(genresError); } 
    else { genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join(''); }

    const { data: tags, error: tagsError } = await supabaseClient.from('tags').select('id, name');
    if (tagsError) { tagsContainer.textContent = 'Kunne ikke laste tags.'; console.error(tagsError); } 
    else { tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join(''); }
}

async function handleTestSpotifyId() {
    let spotifyIdInput = document.getElementById('spotifyId');
    let rawInput = spotifyIdInput.value.trim();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');

    if (!spotifyAccessToken) {
        spotifyTestStatus.textContent = 'Du må koble til Spotify på hovedsiden først.';
        spotifyTestStatus.style.color = '#FF4136';
        return;
    }
    if (!rawInput) {
        spotifyTestStatus.textContent = 'Lim inn en Spotify ID eller lenke for å teste.';
        spotifyTestStatus.style.color = '#FFDC00';
        return;
    }

    let spotifyId = rawInput;
    if (rawInput.includes('spotify.com/track/')) {
        try {
            const url = new URL(rawInput);
            spotifyId = url.pathname.split('/track/')[1];
        } catch (e) {
            spotifyTestStatus.textContent = 'FEIL: Ugyldig Spotify lenke.';
            spotifyTestStatus.style.color = '#FF4136';
            return;
        }
    }
    spotifyId = spotifyId.split('?')[0];

    spotifyTestStatus.textContent = 'Tester ID...';
    spotifyTestStatus.style.color = '#fff';

    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
            headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
        });

        if (!response.ok) throw new Error(`Ugyldig ID eller feil fra Spotify (${response.status})`);
        
        const track = await response.json();
        
        spotifyIdInput.value = spotifyId;
        document.getElementById('artist').value = track.artists.map(a => a.name).join(', ');
        document.getElementById('title').value = track.name;
        document.getElementById('album').value = track.album.name;
        document.getElementById('year').value = track.album.release_date.substring(0, 4);
        
        const imageUrl = (track.album.images && track.album.images.length > 0) ? track.album.images[0].url : '';
        document.getElementById('albumArtUrl').value = imageUrl;

        testCoverArt.src = imageUrl;
        testCoverArt.classList.remove('hidden');

        spotifyTestStatus.textContent = '✓ Vellykket! Spiller av test-lyd...';
        spotifyTestStatus.style.color = '#1DB954';
        
        await playTestTrack(spotifyId);

    } catch (error) {
        spotifyTestStatus.textContent = `FEIL: ${error.message}`;
        spotifyTestStatus.style.color = '#FF4136';
        console.error("Feil ved test av Spotify ID:", error);
    }
}

async function handleAddSong(event) {
    event.preventDefault();
    statusMessage.textContent = 'Lagrer sang...';
    statusMessage.style.color = '#FFDC00';
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { statusMessage.textContent = 'FEIL: Du er ikke logget inn.'; statusMessage.style.color = '#FF4136'; return; }
    
    const form = event.target;
    const songData = {
        artist: form.artist.value.trim(),
        title: form.title.value.trim(),
        album: form.album.value.trim() || null,
        year: parseInt(form.year.value, 10),
        spotifyid: form.spotifyId.value.trim(),
        albumarturl: form.albumArtUrl.value.trim() || null, 
        trivia: form.trivia.value.trim() || null,
        user_id: session.user.id,
    };

    const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single();
    if (songError) { statusMessage.textContent = `FEIL ved lagring: ${songError.message}`; statusMessage.style.color = '#FF4136'; console.error(songError); return; }
    
    const newSongId = newSong.id;
    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedGenreIds.length > 0) {
        const songGenresData = selectedGenreIds.map(genreId => ({ song_id: newSongId, genre_id: genreId }));
        const { error: genreLinkError } = await supabaseClient.from('song_genres').insert(songGenresData);
        if (genreLinkError) { statusMessage.textContent = `FEIL ved sjangerkobling: ${genreLinkError.message}`; return; }
    }
    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedTagIds.length > 0) {
        const songTagsData = selectedTagIds.map(tagId => ({ song_id: newSongId, tag_id: tagId }));
        const { error: tagLinkError } = await supabaseClient.from('song_tags').insert(songTagsData);
        if (tagLinkError) { statusMessage.textContent = `FEIL ved tag-kobling: ${tagLinkError.message}`; return; }
    }

    statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til.`;
    statusMessage.style.color = '#1DB954';
    addSongForm.reset();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
    form.spotifyId.focus();
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    loginView = document.getElementById('admin-login-view');
    mainView = document.getElementById('admin-main-view');
    googleLoginBtn = document.getElementById('google-login-btn');
    logoutBtn = document.getElementById('logout-btn');
    addSongForm = document.getElementById('add-song-form');
    statusMessage = document.getElementById('status-message');
    genresContainer = document.getElementById('genres-container');
    tagsContainer = document.getElementById('tags-container');
    testSpotifyBtn = document.getElementById('test-spotify-btn');
    spotifyTestStatus = document.getElementById('spotify-test-status');
    testCoverArt = document.getElementById('test-cover-art');

    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleAddSong);
    testSpotifyBtn.addEventListener('click', handleTestSpotifyId);

    populateCheckboxes(); 

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            if (window.Spotify && spotifyAccessToken) {
                initializeSpotifyPlayer(spotifyAccessToken);
            }
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});
/* Version: #220 */
