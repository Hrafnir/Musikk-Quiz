/* Version: #3 */
// === STATE ===
// Her vil vi lagre all informasjon om spillets tilstand
let allSongs = [];
let players = [];
let gameSettings = {};

// === DOM ELEMENTS ===
// Her lagrer vi referanser til HTML-elementer vi trenger
// (Kommer i neste steg)

// === FUNCTIONS ===
/**

Laster sanger fra songs.json-filen
*/
async function loadSongs() {
try {
const response = await fetch('songs.json');
if (!response.ok) {
throw new Error(HTTP error! status: ${response.status});
}
allSongs = await response.json();
console.log('Sanger lastet inn:', allSongs);
} catch (error) {
console.error('Kunne ikke laste sangfilen:', error);
// Vis en feilmelding til brukeren i HTML
const setupScreen = document.getElementById('game-setup');
setupScreen.innerHTML = '<h1>Feil</h1><p>Kunne ikke laste inn sangdata. Sjekk at filen songs.json finnes og er korrekt formatert.</p>';
}
}

// === INITIALIZATION ===
/**

Kjøres når siden er lastet inn
/
document.addEventListener('DOMContentLoaded', () => {
console.log('Quiz-appen er klar!');
loadSongs();
});
/ Version: #3 */
