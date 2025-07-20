/* Version: #85 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://vqzyrmpfuxfnjciwgyge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxenlybXBmdXhmbmpjaXdneWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDQ0NjksImV4cCI6MjA2ODU4MDQ2OX0.NWYzvjHwsIVn1D78_I3sdXta1-03Lze7MXiQcole65M';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// === DOM ELEMENTS ===
const loginView = document.getElementById('auth-login');
const loggedInView = document.getElementById('auth-loggedin');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');


// === FUNCTIONS ===

async function signInWithGoogle() {
    console.log('Forsøker å logge inn med Google...');
    // Supabase bruker automatisk Site URL fra innstillingene, så vi trenger ikke spesifisere den her lenger.
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) {
        console.error('Feil under Google-innlogging:', error);
        alert('En feil oppstod under innlogging med Google.');
    }
}

async function signOut() {
    console.log('Forsøker å logge ut...');
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Feil under utlogging:', error);
    }
}

function updateUI(user) {
    if (user) {
        loginView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
    } else {
        loginView.classList.remove('hidden');
        loggedInView.classList.add('hidden');
        userEmailSpan.textContent = '';
    }
}


// === INITIALIZATION ===

if (googleLoginBtn && logoutBtn) {
    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
} else {
    console.error('Kunne ikke finne en eller flere knapper. Sjekk ID-ene i index.html.');
}

supabaseClient.auth.getSession().then(({ data: { session } }) => {
    console.log('Nåværende session:', session);
    updateUI(session?.user ?? null);
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    console.log('Innloggingsstatus endret:', session);
    // Rydd opp i URL-en etter at Supabase har hentet nøkkelen
    if (window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
    }
    updateUI(session?.user ?? null);
});
/* Version: #85 */
