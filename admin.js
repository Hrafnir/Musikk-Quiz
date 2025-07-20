/* Version: #97 */
// === SUPABASE CONFIGURATION ===
// Samme nøkler som i script.js
const SUPABASE_URL = 'https://vqzyrmpfuxfnciwgyge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxenlybXBmdXhmbmpjaXdneWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDQ0NjksImV4cCI6MjA2ODU4MDQ2OX0.NWYzvjHwsIVn1D78_I3sdXta1-03Lze7MXiQcole65M';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// === DOM ELEMENTS ===
const addSongForm = document.getElementById('add-song-form');
const statusMessage = document.getElementById('status-message');


/**
 * Håndterer innsending av skjemaet
 * @param {Event} event
 */
async function handleAddSong(event) {
    event.preventDefault(); // Forhindrer at siden lastes på nytt

    // Vis en "jobber"-melding
    statusMessage.textContent = 'Lagrer sang...';
    statusMessage.style.color = '#FFDC00'; // Gul farge for "pågår"

    // Hent ut data fra skjemaet
    const form = event.target;
    const artist = form.artist.value.trim();
    const title = form.title.value.trim();
    const year = parseInt(form.year.value, 10);
    const spotifyId = form.spotifyId.value.trim();
    const albumArtUrl = form.albumArtUrl.value.trim();
    const trivia = form.trivia.value.trim();
    
    // Konverter kommaseparert sjanger-streng til en array
    const genres = form.genres.value
        .split(',') // Del strengen ved hvert komma
        .map(genre => genre.trim()) // Fjern mellomrom før/etter hver sjanger
        .filter(genre => genre !== ''); // Fjern tomme sjangre

    // Bygg objektet som skal sendes til databasen
    const newSong = {
        artist,
        title,
        year,
        spotifyId,
        albumArtUrl: albumArtUrl || null, // Send null hvis feltet er tomt
        trivia: trivia || null,
        genres: genres.length > 0 ? genres : null
    };

    console.log('Sender denne sangen til Supabase:', newSong);

    // Send data til Supabase
    const { error } = await supabaseClient
        .from('songs') // Velg 'songs'-tabellen
        .insert([newSong]); // Sett inn den nye sangen

    // Håndter responsen
    if (error) {
        console.error('Feil ved lagring til Supabase:', error);
        statusMessage.textContent = `FEIL: ${error.message}`;
        statusMessage.style.color = '#FF4136'; // Rød farge for feil
    } else {
        console.log('Sang lagret vellykket!');
        statusMessage.textContent = `Vellykket! "${title}" av ${artist} er lagt til.`;
        statusMessage.style.color = '#1DB954'; // Grønn farge for suksess
        
        // Tøm skjemaet for neste sang
        addSongForm.reset();
        // Sett fokus tilbake på første felt
        form.artist.focus();
    }
}


// === INITIALIZATION ===
addSongForm.addEventListener('submit', handleAddSong);
/* Version: #97 */
