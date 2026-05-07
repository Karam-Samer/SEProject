// ============================================
// JS/login/login.js
// ============================================

function switchTab(name) {
    ['login', 'register'].forEach(n => {
        document.getElementById('tab-' + n).classList.toggle('active', n === name);
        document.getElementById('panel-' + n).classList.toggle('active', n === name);
    });

    const footer = document.getElementById('card-footer');
    footer.innerHTML = name === 'login'
        ? `Don't have an account? <a href="#" onclick="switchTab('register'); return false;">Create one</a>`
        : `Already have an account? <a href="#" onclick="switchTab('login'); return false;">Sign in</a>`;
}
