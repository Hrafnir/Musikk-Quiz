/* Version: #44 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Verifiserer er klar.');

    const songSelector = document.getElementById('song-selector');
    const displayArea = document.getElementById('song-display-area');
    let allSongs = [];

    /**
     * Laster sanger fra songs.json og fyller ut nedtrekksmenyen
     */
    async function loadAndPopulateSongs() {
        try {
            const response = await fetch('songs.json');
            if (!response.ok) {
                throw new Error(`Klarte ikke hente songs.json: ${response.statusText}`);
            }
            allSongs = await response.json();

            // Tøm standard-valget
            songSelector.innerHTML = '<option value="">-- Velg en sang --</option>';

            // Fyll listen med sanger
            allSongs.forEach((song, index) => {
                const option = document.createElement('option');
                option.value = index; // Bruk indeksen som verdi
                option.textContent = `${song.artist} - ${song.title}`;
                songSelector.appendChild(option);
            });

            console.log(`${allSongs.length} sanger lastet inn.`);

        } catch (error) {
            displayArea.innerHTML = `<p style="color: #FF4136;"><strong>FEIL:</strong> ${error.message}</p>`;
            console.error(error);
        }
    }

    /**
     * Viser detaljene for en valgt sang
     */
    function displaySongDetails() {
        const selectedIndex = songSelector.value;
        
        if (selectedIndex === "") {
            displayArea.innerHTML = '<p>Velg en sang fra listen over for å se detaljer.</p>';
            return;
        }

        const song = allSongs[selectedIndex];

        if (!song) {
            displayArea.innerHTML = `<p style="color: #FF4136;"><strong>FEIL:</strong> Fant ikke sang med indeks ${selectedIndex}.</p>`;
            return;
        }

        displayArea.innerHTML = `
            <h3>${song.artist} - ${song.title} (${song.year})</h3>
            <hr>
            <h4>Album Cover Test:</h4>
            <p>Hvis bildet under er ødelagt, er lenken i JSON-filen feil.</p>
            <img 
                src="${song.albumArtUrl}" 
                alt="Album cover for ${song.title}" 
                style="max-width: 200px; border-radius: 8px; margin: 10px 0; border: 2px solid #fff;"
                onerror="this.style.display='none'; document.getElementById('error-msg').style.display='block';"
            >
            <p id="error-msg" style="display: none; color: #FF4136;"><strong>Bilde-URL feilet!</strong></p>
            
            <h4>Detaljer:</h4>
            <ul>
                <li><strong>Spotify ID:</strong> ${song.spotifyId}</li>
                <li><strong>Varighet (ms):</strong> ${song.duration_ms}</li>
                <li><strong>Sjangre:</strong> ${song.genres.join(', ')}</li>
                <li><strong>Trivia:</strong> ${song.trivia}</li>
            </ul>
            
            <button id="play-song-btn" style="margin-top: 20px;">Test avspilling</button>
        `;

        document.getElementById('play-song-btn').addEventListener('click', () => {
            window.open(`https://open.spotify.com/track/${song.spotifyId}`, 'spotify_test_player');
        });
    }

    // Kjør funksjoner og sett opp lyttere
    loadAndPopulateSongs();
    songSelector.addEventListener('change', displaySongDetails);
});
/* Version: #44 */
