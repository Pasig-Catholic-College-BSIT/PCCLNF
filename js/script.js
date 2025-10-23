  const msgEl = document.getElementById('message');
  const signupFormEl = document.getElementById('signup-form');
  const loginFormEl = document.getElementById('login-form');
  const formTitleEl = document.getElementById('form-title');
  const toggleLinkEl = document.getElementById('toggle-link');

  const USERS_KEY = 'users';
  const CURRENT_USER_KEY = 'currentUser';

  function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  }
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function findUser(username) {
    return getUsers().find(u => u.username === username);
  }
  function findUserAuth(username, password) {
    return getUsers().find(u => u.username === username && u.password === password);
  }
  function showMessage(text, color) {
    msgEl.textContent = text || '';
    msgEl.style.color = color || '#b00';
  }

  function ensureDefaultUsers() {
    const users = getUsers();
    if (!users.some(u => u.username === 'admin')) users.push({ username: 'admin', password: '1234', role: 'admin' });
    if (!users.some(u => u.username === 'student')) users.push({ username: 'student', password: '1234', role: 'student' });
    saveUsers(users);
  }

  function signup() {
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    if (!username || !password) { showMessage('Please fill in all fields.'); return; }
    if (findUser(username)) { showMessage('Username already exists!'); return; }
    const users = getUsers();
    // default role for signups
    users.push({ username, password, role: 'student' });
    saveUsers(users);
    showMessage('Sign-up successful! You can now log in.', 'green');
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    toggleForm();
  }

  function login() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) { showMessage('Please fill in all fields.'); return; }
    const user = findUserAuth(username, password);
    if (user) {
      // Save the current user to localStorage so learningjson.html can read it
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      showMessage(`Welcome back, ${username}! Redirecting...`, 'green');
      // Redirect to learningjson.html (relative path)
      const target = 'learningjson.html';
      setTimeout(()=> window.location.href = target, 600);
    } else {
      showMessage('Invalid username or password.');
    }
  }

  function toggleForm() {
    const showingSignup = signupFormEl.style.display !== 'none';
    signupFormEl.style.display = showingSignup ? 'none' : 'block';
    loginFormEl.style.display = showingSignup ? 'block' : 'none';
    formTitleEl.textContent = showingSignup ? 'Login' : 'Sign Up';
    toggleLinkEl.textContent = showingSignup ? "Don't have an account? Sign Up" : "Already have an account? Login";
    showMessage('');
  }

  document.getElementById('signup-btn').addEventListener('click', signup);
  document.getElementById('login-btn').addEventListener('click', login);
  toggleLinkEl.addEventListener('click', toggleForm);

  ensureDefaultUsers();
