/* Version: #216 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer,
    testSpotifyBtn, spotifyTestStatus;

// === AUTHENTICATION FUNCTIONS ===
async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' }
    });
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

// === DATA FETCHING & HANDLING ===
async function populateCheckboxes() {
    const { data: genres, error: genresError } = await supabaseClient.from('genre').select('id, name');
    if (genresError) {
        genresContainer.textContent = 'Kunne ikke laste sjangre.';
        console.error('Feil ved henting av sjangre:', genresError);
    } else {
        genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');
    }

    const { data: tags, error: tagsError } = await supabaseClient.from('tags').select('id, name');
    if (tagsError) {
        tagsContainer.textContent = 'Kunne ikke laste tags.';
        console.error('Feil ved henting av tags:', tagsError);
    } else {
        tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
    }
}

// ENDRET: Funksjonen er nå smartere og kan håndtere fulle URLer
async function handleTestSpotifyId() {
    let spotifyIdInput = document.getElementById('spotifyId');
    let rawInput = spotifyIdInput.value.trim();
    spotifyTestStatus.textContent = '';

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

    // --- NY LOGIKK FOR Å HÅNDTERE URL ---
    let spotifyId = rawInput;
    if (rawInput.includes('spotify.com/track/')) {
        try {
            // Prøver å trekke ut ID-en fra URL-en
            const url = new URL(rawInput);
            spotifyId = url.pathname.split('/track/')[1];
        } catch (e) {
            spotifyTestStatus.textContent = 'FEIL: Ugyldig Spotify lenke.';
            spotifyTestStatus.style.color = '#FF4136';
            return;
        }
    }
    // Fjern eventuelle query-parametere som ?si=...
    spotifyId = spotifyId.split('?')[0];
    // --- SLUTT PÅ NY LOGIKK ---

    spotifyTestStatus.textContent = 'Tester ID...';
    spotifyTestStatus.style.color = '#fff';

    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
            headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error('Ugyldig Spotify ID.');
            throw new Error(`Spotify API svarte med status ${response.status}`);
        }

        const track = await response.json();
        
        // Oppdater input-feltet med den rene ID-en
        spotifyIdInput.value = spotifyId;

        // Autofyll resten av skjemaet
        document.getElementById('artist').value = track.artists.map(a => a.name).join(', ');
        document.getElementById('title').value = track.name;
        document.getElementById('album').value = track.album.name;
        document.getElementById('year').value = track.album.release_date.substring(0, 4);
        if (track.album.images && track.album.images.length > 0) {
            document.getElementById('albumArtUrl').value = track.album.images[0].url;
        }

        spotifyTestStatus.textContent = '✓ Vellykket! Skjemaet er autofylt.';
        spotifyTestStatus.style.color = '#1DB954';

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
    if (!session) {
        statusMessage.textContent = 'FEIL: Du er ikke logget inn.';
        statusMessage.style.color = '#FF4136';
        return;
    }
    
    const userId = session.user.id;
    const form = event.target;

    const songData = {
        artist: form.artist.value.trim(),
        title: form.title.value.trim(),
        album: form.album.value.trim() || null,
        year: parseInt(form.year.value, 10),
        spotifyid: form.spotifyId.value.trim(),
        albumarturl: form.albumArtUrl.value.trim() || null, 
        trivia: form.trivia.value.trim() || null,
        user_id: userId,
    };

    const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single();
    if (songError) {
        statusMessage.textContent = `FEIL ved lagring av sang: ${songError.message}`;
        statusMessage.style.color = '#FF4136';
        console.error(songError);
        return;
    }
    const newSongId = newSong.id;

    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedGenreIds.length > 0) {
        const songGenresData = selectedGenreIds.map(genreId => ({ song_id: newSongId, genre_id: genreId }));
        const { error: genreLinkError } = await supabaseClient.from('song_genres').insert(songGenresData);
        if (genreLinkError) { statusMessage.textContent = `FEIL ved kobling av sjangre: ${genreLinkError.message}`; return; }
    }

    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedTagIds.length > 0) {
        const songTagsData = selectedTagIds.map(tagId => ({ song_id: newSongId, tag_id: tagId }));
        const { error: tagLinkError } = await supabaseClient.from('song_tags').insert(songTagsData);
        if (tagLinkError) { statusMessage.textContent = `FEIL ved kobling av tags: ${tagLinkError.message}`; return; }
    }

    statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til i databasen.`;
    statusMessage.style.color = '#1DB954';
    addSongForm.reset();
    spotifyTestStatus.textContent = '';
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

    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleAddSong);
    testSpotifyBtn.addEventListener('click', handleTestSpotifyId);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            await populateCheckboxes();
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});
/* Version: #216 */
