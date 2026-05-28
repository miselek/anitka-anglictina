// =====================================================
// APP.JS - Main application, routing, screens
// =====================================================

const App = {
  currentScreen: 'dashboard',

  init() {
    SpeechManager.init();

    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      this.renderLogin();
      return;
    }

    this.bootAuthenticated();
  },

  bootAuthenticated() {
    DataManager.load();
    DefaultWords.load();
    this.renderHeader();
    this.navigate('dashboard');

    if (typeof DataManager.syncFromCloud === 'function') {
      DataManager.syncFromCloud().then(changed => {
        if (changed) {
          this.renderHeader();
          this.navigate(this.currentScreen || 'dashboard');
        }
      });
    }
  },

  renderLogin(selectedUserId, error) {
    // Clear header — no logged-in user yet.
    const header = document.getElementById('app-header');
    if (header) header.innerHTML = '';

    const content = document.getElementById('app-content');
    const users = Auth.USERS;

    if (!selectedUserId) {
      // Step 1: pick user
      content.innerHTML = `
        <div class="login-screen">
          <div class="login-title">
            <div class="login-logo">🌟</div>
            <h1>Anitčina Angličtina</h1>
            <p>Kdo jsi?</p>
          </div>
          <div class="user-picker">
            ${users.map(u => `
              <button class="user-tile" style="--user-color: ${u.color}" onclick="App.renderLogin('${u.id}')">
                <div class="user-emoji">${u.emoji}</div>
                <div class="user-name">${u.name}</div>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      return;
    }

    // Step 2: enter PIN
    const user = users.find(u => u.id === selectedUserId);
    if (!user) { this.renderLogin(); return; }

    content.innerHTML = `
      <div class="login-screen">
        <div class="login-title">
          <div class="login-user-emoji">${user.emoji}</div>
          <h2>${user.name}, zadej PIN</h2>
          ${error ? `<div class="login-error">${error}</div>` : ''}
        </div>
        <div class="pin-display" id="pin-display">
          <span class="pin-dot empty"></span>
          <span class="pin-dot empty"></span>
          <span class="pin-dot empty"></span>
          <span class="pin-dot empty"></span>
        </div>
        <div class="pin-keypad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-key" onclick="App.pinPress('${n}')">${n}</button>`).join('')}
          <button class="pin-key pin-key-back" onclick="App.renderLogin()">←</button>
          <button class="pin-key" onclick="App.pinPress('0')">0</button>
          <button class="pin-key pin-key-clear" onclick="App.pinClear()">⌫</button>
        </div>
        <div class="login-hint">Zapomenuté PIN? Zeptej se táty.</div>
      </div>
    `;
    this._pinBuffer = '';
    this._pinUserId = selectedUserId;
  },

  pinPress(digit) {
    if (!this._pinBuffer) this._pinBuffer = '';
    if (this._pinBuffer.length >= 4) return;
    this._pinBuffer += digit;
    this._updatePinDisplay();
    if (this._pinBuffer.length === 4) {
      setTimeout(() => this._submitPin(), 150);
    }
  },

  pinClear() {
    if (!this._pinBuffer) return;
    this._pinBuffer = this._pinBuffer.slice(0, -1);
    this._updatePinDisplay();
  },

  _updatePinDisplay() {
    const display = document.getElementById('pin-display');
    if (!display) return;
    const buf = this._pinBuffer || '';
    display.innerHTML = [0,1,2,3].map(i => `<span class="pin-dot ${i < buf.length ? 'filled' : 'empty'}"></span>`).join('');
  },

  _submitPin() {
    const result = Auth.login(this._pinUserId, this._pinBuffer);
    if (result.ok) {
      this._pinBuffer = '';
      this._pinUserId = null;
      this.bootAuthenticated();
    } else {
      // Flash error, clear buffer
      this._pinBuffer = '';
      this._updatePinDisplay();
      this.renderLogin(this._pinUserId, result.error);
    }
  },

  logout() {
    if (!confirm('Opravdu se chceš odhlásit?')) return;
    Auth.logout();
    // Reset transient state
    this.currentScreen = 'dashboard';
    this.renderLogin();
  },

  navigate(screen, params) {
    this.currentScreen = screen;
    const content = document.getElementById('app-content');
    content.classList.add('fade-out');

    setTimeout(() => {
      content.innerHTML = '';
      switch (screen) {
        case 'dashboard': this.renderDashboard(content); break;
        case 'quiz': this.renderQuiz(content, params); break;
        case 'results': this.renderResults(content, params); break;
        case 'stats': this.renderStats(content); break;
        case 'import': this.renderImport(content); break;
        case 'settings': this.renderSettings(content); break;
        case 'category-words': this.renderCategoryWords(content, params); break;
        case 'achievements': this.renderAchievements(content); break;
      }
      content.classList.remove('fade-out');
      content.classList.add('fade-in');
      setTimeout(() => content.classList.remove('fade-in'), 400);
      this.renderHeader();
      window.scrollTo(0, 0);
    }, 150);
  },

  // =============================================
  // HEADER - Always visible progress
  // =============================================
  renderHeader() {
    const progress = DataManager.calculateProgress();
    const xp = DataManager.getXPProgress();
    const daily = DataManager.getDailyProgress();
    const stats = DataManager.data.stats;
    const header = document.getElementById('app-header');

    const pctKnown = progress.total > 0 ? (progress.known / progress.total) * 100 : 0;
    const pctLearning = progress.total > 0 ? (progress.learning / progress.total) * 100 : 0;
    const pctUntested = progress.total > 0 ? (progress.untested / progress.total) * 100 : 0;

    const currentUser = typeof Auth !== 'undefined' && Auth.getCurrent ? Auth.getCurrent() : null;
    const userBadge = currentUser
      ? `<button class="header-user" onclick="App.logout()" title="Odhlásit">
           <span class="header-user-emoji">${currentUser.emoji}</span>
           <span class="header-user-name">${currentUser.name}</span>
         </button>`
      : '';

    header.innerHTML = `
      <div class="header-inner">
        <div class="header-top-row">
          <div class="header-title" onclick="App.navigate('dashboard')">
            <span class="header-logo">🌟</span>
            <span>Anitčina Angličtina</span>
          </div>
          <div class="header-badges">
            ${userBadge}
            <span class="header-badge" title="Level ${xp.level}: ${xp.title}">⭐ ${xp.level}</span>
            <span class="header-badge" title="${stats.currentStreak} dní v řadě">${stats.currentStreak > 0 ? '🔥' : '❄️'} ${stats.currentStreak}</span>
            <span class="header-badge" title="XP body">💎 ${xp.xp}</span>
          </div>
        </div>
        <div class="header-progress">
          <div class="progress-stats">
            <span class="stat stat-known">✅ Umím: <strong>${progress.known}</strong></span>
            <span class="stat stat-learning">📖 Neumím: <strong>${progress.learning}</strong></span>
            <span class="stat stat-untested">❓ Nezkoušeno: <strong>${progress.untested}</strong></span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-segment bar-known" style="width: ${pctKnown}%"></div>
            <div class="progress-bar-segment bar-learning" style="width: ${pctLearning}%"></div>
            <div class="progress-bar-segment bar-untested" style="width: ${pctUntested}%"></div>
          </div>
          <div class="header-bottom-row">
            <span class="progress-percentage">${progress.percentage}% hotovo</span>
            <span class="daily-goal-mini ${daily.completed ? 'daily-done' : ''}">${daily.completed ? '✅' : '📝'} Denní cíl: ${daily.progress}/${daily.goal}</span>
          </div>
        </div>
      </div>
    `;
  },

  // =============================================
  // DASHBOARD
  // =============================================
  renderDashboard(container) {
    const catStats = DataManager.getCategoryStats();
    const progress = DataManager.calculateProgress();
    const xp = DataManager.getXPProgress();
    const daily = DataManager.getDailyProgress();
    const stats = DataManager.data.stats;

    // Group categories by textbook (prefix before " — ").
    const SEP = ' — ';
    const groups = new Map();
    for (const cat of catStats) {
      const idx = cat.name.indexOf(SEP);
      const textbook = idx > 0 ? cat.name.slice(0, idx) : 'Ostatní';
      const subname = idx > 0 ? cat.name.slice(idx + SEP.length) : cat.name;
      if (!groups.has(textbook)) groups.set(textbook, []);
      groups.get(textbook).push({ ...cat, subname });
    }
    // Stable order: textbooks alphabetical, "Ostatní" last.
    const groupNames = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'Ostatní') return 1;
      if (b === 'Ostatní') return -1;
      return a.localeCompare(b, 'cs');
    });

    // Collapse state stored in localStorage; default collapsed when there
    // are many groups (>2).
    const collapseKey = 'anitka_dashboard_groups_open';
    let openGroups = {};
    try { openGroups = JSON.parse(localStorage.getItem(collapseKey) || '{}'); } catch (e) {}
    const defaultOpen = groupNames.length <= 2;

    const groupsHtml = groupNames.map(name => {
      const cats = groups.get(name);
      const totals = cats.reduce((acc, c) => {
        acc.total += c.total; acc.known += c.known; acc.learning += c.learning; acc.untested += c.untested;
        return acc;
      }, { total: 0, known: 0, learning: 0, untested: 0 });
      const pct = totals.total > 0 ? Math.round((totals.known / totals.total) * 100) : 0;
      const isOpen = openGroups[name] !== undefined ? openGroups[name] : defaultOpen;
      const cardsHtml = cats.map(cat => `
        <div class="category-card category-card-compact" onclick="App.navigate('quiz', { categoryIds: ['${cat.id}'] })">
          <div class="category-card-row">
            <div class="category-name">${cat.subname}</div>
            <div class="category-count">${cat.known}/${cat.total}</div>
          </div>
          <div class="category-mini-bar">
            <div class="bar-known" style="width: ${cat.percentage}%"></div>
          </div>
          <button class="btn-tiny-detail" onclick="event.stopPropagation(); App.navigate('category-words', { categoryId: '${cat.id}' })">📋</button>
        </div>
      `).join('');
      return `
        <div class="textbook-group ${isOpen ? 'open' : 'closed'}" data-group="${name}">
          <button class="textbook-group-header" onclick="App.toggleGroup('${name.replace(/'/g, "\\'")}')">
            <span class="textbook-group-name">📖 ${name}</span>
            <span class="textbook-group-meta">${totals.known}/${totals.total} · ${pct}%</span>
            <span class="textbook-group-chevron">${isOpen ? '▾' : '▸'}</span>
          </button>
          <div class="textbook-group-body">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Reward banner
    let rewardBanner = '';
    if (progress.rewardEarned) {
      rewardBanner = `
        <div class="reward-banner" onclick="App.showReward()">
          🎉🪑 Anitko, umíš už ${progress.percentage}%! KOLEČKOVÁ ŽIDLE je tvoje! 🪑🎉
        </div>
      `;
    } else if (progress.total > 0) {
      const remaining = Math.ceil(progress.total * 0.95) - progress.known;
      if (remaining > 0) {
        rewardBanner = `
          <div class="motivation-banner">
            🪑 Do kolečkové židle zbývá naučit se ještě <strong>${remaining}</strong> slovíček!
          </div>
        `;
      }
    }

    // Level & XP card
    const levelCard = `
      <div class="level-card card">
        <div class="level-info">
          <div class="level-badge">⭐ ${xp.level}</div>
          <div class="level-details">
            <div class="level-title">${xp.title}</div>
            <div class="xp-bar-container">
              <div class="xp-bar-fill" style="width: ${xp.percentage}%"></div>
            </div>
            <div class="xp-text">${xp.xpInLevel}/${xp.xpNeeded} XP do dalšího levelu</div>
          </div>
        </div>
      </div>
    `;

    // Daily goal card
    const dailyCard = `
      <div class="daily-goal-card card ${daily.completed ? 'daily-completed' : ''}">
        <div class="daily-goal-header">
          <span>${daily.completed ? '🎉 Denní cíl splněn!' : '📝 Denní cíl'}</span>
          <span class="daily-goal-count">${daily.progress}/${daily.goal}</span>
        </div>
        <div class="daily-goal-bar">
          <div class="daily-goal-fill" style="width: ${daily.percentage}%"></div>
        </div>
        ${daily.completed ? '<div class="daily-goal-msg">Výborně! Můžeš pokračovat pro bonus XP!</div>' : ''}
      </div>
    `;

    // Streak & stats row
    const streakCard = `
      <div class="streak-row">
        <div class="mini-stat-card card">
          <div class="mini-stat-icon">${stats.currentStreak > 0 ? '🔥' : '❄️'}</div>
          <div class="mini-stat-value">${stats.currentStreak}</div>
          <div class="mini-stat-label">${stats.currentStreak === 1 ? 'den' : stats.currentStreak >= 2 && stats.currentStreak <= 4 ? 'dny' : 'dní'} v řadě</div>
        </div>
        <div class="mini-stat-card card">
          <div class="mini-stat-icon">💎</div>
          <div class="mini-stat-value">${xp.xp}</div>
          <div class="mini-stat-label">XP bodů</div>
        </div>
        <div class="mini-stat-card card">
          <div class="mini-stat-icon">🏆</div>
          <div class="mini-stat-value">${stats.achievements.length}/${DataManager.ACHIEVEMENT_DEFS.length}</div>
          <div class="mini-stat-label">Odznaky</div>
        </div>
      </div>
    `;

    // Recent achievements
    const recentAchievements = DataManager.getAchievements().filter(a => a.unlocked).slice(-3);
    const achievementsPreview = recentAchievements.length > 0 ? `
      <div class="achievements-preview" onclick="App.navigate('achievements')">
        <h3>🏅 Poslední odznaky</h3>
        <div class="achievements-row">
          ${recentAchievements.map(a => `
            <div class="achievement-mini">${a.icon}<span>${a.name}</span></div>
          `).join('')}
        </div>
        <div class="achievements-see-all">Zobrazit všechny →</div>
      </div>
    ` : '';

    const remaining = progress.total - progress.known;
    const practiceAllSize = Math.min(DataManager.data.settings.quizSize, remaining);
    const practiceAllButton = remaining >= 4
      ? `<button class="btn btn-primary btn-procvicovat-vse" onclick="App.navigate('quiz')">
           🎯 Procvičovat vše<br>
           <span class="btn-sub">${practiceAllSize} slov · zbývá naučit ${remaining}</span>
         </button>`
      : `<div class="all-done-banner">🏆 Všechno už umíš! Skvělá práce.</div>`;

    container.innerHTML = `
      <div class="dashboard">
        ${rewardBanner}
        ${practiceAllButton}
        ${dailyCard}
        ${levelCard}
        ${streakCard}

        ${achievementsPreview}

        <h2 class="section-title">📚 Učebnice a okruhy</h2>
        <div class="textbook-groups">
          ${groupsHtml}
        </div>

        <div class="action-buttons bottom-actions">
          <button class="btn btn-secondary" onclick="App.navigate('stats')">
            📊 Statistiky
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('achievements')">
            🏅 Odznaky
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('import')">
            📥 Import
          </button>
          <button class="btn btn-secondary" onclick="App.navigate('settings')">
            ⚙️ Nastavení
          </button>
        </div>
      </div>
    `;
  },

  toggleGroup(name) {
    const collapseKey = 'anitka_dashboard_groups_open';
    let openGroups = {};
    try { openGroups = JSON.parse(localStorage.getItem(collapseKey) || '{}'); } catch (e) {}
    const groupEl = document.querySelector(`.textbook-group[data-group="${CSS.escape(name)}"]`);
    if (!groupEl) return;
    const wasOpen = groupEl.classList.contains('open');
    if (wasOpen) {
      groupEl.classList.remove('open');
      groupEl.classList.add('closed');
      openGroups[name] = false;
    } else {
      groupEl.classList.add('open');
      groupEl.classList.remove('closed');
      openGroups[name] = true;
    }
    const chevron = groupEl.querySelector('.textbook-group-chevron');
    if (chevron) chevron.textContent = wasOpen ? '▸' : '▾';
    try { localStorage.setItem(collapseKey, JSON.stringify(openGroups)); } catch (e) {}
  },

  // =============================================
  // QUIZ SCREEN
  // =============================================
  renderQuiz(container, params) {
    const categoryIds = params && params.categoryIds ? params.categoryIds : [];
    const quiz = params && params.practiceWrong
      ? QuizEngine.startPracticeWrongWords(params.wrongWords)
      : QuizEngine.startQuiz(categoryIds);

    if (!quiz) {
      container.innerHTML = `
        <div class="screen-message">
          <div class="message-icon">😕</div>
          <h2>Málo slovíček</h2>
          <p>Pro kvíz potřebuješ alespoň 4 slovíčka. Naimportuj další!</p>
          <button class="btn btn-primary" onclick="App.navigate('import')">📥 Import</button>
          <button class="btn btn-secondary" onclick="App.navigate('dashboard')">🏠 Zpět</button>
        </div>
      `;
      return;
    }

    this.showQuestion(container);
  },

  showQuestion(container) {
    const q = QuizEngine.getCurrentQuestion();

    if (!q) {
      // Quiz finished
      const results = QuizEngine.getResults();
      App.navigate('results', { results });
      return;
    }

    const flagEmoji = q.direction === 'cz_to_en' ? '🇨🇿 ➜ 🇬🇧' : '🇬🇧 ➜ 🇨🇿';

    container.innerHTML = `
      <div class="quiz-screen">
        <div class="quiz-header">
          <div class="quiz-progress-info">
            <span>Otázka ${q.questionNumber}/${q.totalQuestions}</span>
            <span class="quiz-score">✅ ${q.correctSoFar} &nbsp; ❌ ${q.wrongSoFar}</span>
          </div>
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width: ${(q.questionNumber / q.totalQuestions) * 100}%"></div>
          </div>
          <div class="quiz-direction">${flagEmoji}</div>
        </div>

        <div class="quiz-question">
          <div class="quiz-prompt">${q.questionLang}</div>
          <div class="quiz-word">${q.questionText}</div>
          <button class="btn-sound" onclick="${q.direction === 'en_to_cz' ? `SpeechManager.speak('${q.questionText.replace(/'/g, "\\'")}')` : `SpeechManager.speakCzech('${q.questionText.replace(/'/g, "\\'")}')`}">🔊</button>
        </div>

        <div class="quiz-options" id="quiz-options">
          ${q.options.map((opt, i) => `
            <button class="btn-option" onclick="App.handleAnswer('${opt.replace(/'/g, "\\'")}', this)" data-answer="${opt}">
              ${opt}
            </button>
          `).join('')}
        </div>

        <div class="quiz-feedback" id="quiz-feedback" style="display: none;"></div>
      </div>
    `;

    // Auto-read the question aloud
    if (q.direction === 'en_to_cz') {
      setTimeout(() => SpeechManager.speak(q.questionText), 300);
    } else {
      setTimeout(() => SpeechManager.speakCzech(q.questionText), 300);
    }
  },

  handleAnswer(selected, btnElement) {
    // Prevent double-clicking
    const options = document.querySelectorAll('.btn-option');
    const alreadyAnswered = Array.from(options).some(o => o.classList.contains('option-correct') || o.classList.contains('option-wrong'));
    if (alreadyAnswered) return;

    const result = QuizEngine.submitAnswer(selected);
    if (!result) return;

    const feedback = document.getElementById('quiz-feedback');
    const container = document.getElementById('app-content');
    const quizScreen = document.querySelector('.quiz-screen');

    // Highlight buttons (briefly visible while options fade out via CSS)
    options.forEach(btn => {
      btn.disabled = true;
      const answer = btn.getAttribute('data-answer');
      if (answer === result.correctAnswer) {
        btn.classList.add('option-correct');
      }
      if (answer === selected && !result.isCorrect) {
        btn.classList.add('option-wrong');
        btn.classList.add('shake');
      }
    });

    // Hide options + question, take over screen with feedback panel.
    if (quizScreen) quizScreen.classList.add('feedback-shown');

    const ipaHtml = result.pronunciation
      ? `<div class="feedback-ipa-big">${result.pronunciation}</div>` : '';

    if (result.isCorrect) {
      const comboHtml = result.combo >= 3
        ? `<div class="feedback-combo">${result.combo}× COMBO 🔥</div>` : '';
      const levelUpHtml = result.levelUp
        ? `<div class="level-up-mini">🎉 LEVEL UP! Level ${result.levelUp.level}: ${result.levelUp.title}</div>` : '';

      feedback.innerHTML = `
        <div class="feedback-correct">
          <div class="feedback-emoji-big bounce">😊</div>
          <div class="feedback-status">Správně! <span class="xp-popup">+${result.xpGained} XP</span></div>
          ${comboHtml}
          <div class="feedback-word-pair">
            <div class="feedback-cz">${result.czechWord}</div>
            <div class="feedback-eq">=</div>
            <div class="feedback-en">${result.englishWord}</div>
            ${ipaHtml}
          </div>
          <button class="btn btn-secondary btn-replay" onclick="SpeechManager.speakBoth('${result.czechWord.replace(/'/g, "\\'")}', 'cz', '${result.englishWord.replace(/'/g, "\\'")}', 'en')">🔊 Znovu</button>
          ${levelUpHtml}
        </div>
      `;
      feedback.style.display = 'block';

      SpeechManager.speakBoth(result.czechWord, 'cz', result.englishWord, 'en');

      setTimeout(() => {
        if (QuizEngine.nextQuestion()) {
          this.showQuestion(container);
        } else {
          const results = QuizEngine.getResults();
          App.navigate('results', { results });
        }
      }, result.levelUp ? 3500 : 2500);
    } else {
      feedback.innerHTML = `
        <div class="feedback-wrong">
          <div class="feedback-emoji-big">😕</div>
          <div class="feedback-status">Správná odpověď:</div>
          <div class="feedback-word-pair">
            <div class="feedback-cz">${result.czechWord}</div>
            <div class="feedback-eq">=</div>
            <div class="feedback-en feedback-en-emphasized">${result.englishWord}</div>
            ${ipaHtml}
          </div>
          <div class="feedback-your-answer">Tvoje odpověď: <em>${selected}</em></div>
          <div class="combo-lost">${result.combo === 0 ? '💔 Combo ztraceno' : ''}</div>
          <button class="btn btn-secondary btn-replay" onclick="SpeechManager.speakBoth('${result.czechWord.replace(/'/g, "\\'")}', 'cz', '${result.englishWord.replace(/'/g, "\\'")}', 'en')">🔊 Znovu</button>
          <button class="btn btn-primary btn-next" onclick="App.advanceQuiz()">Další ➜</button>
        </div>
      `;
      feedback.style.display = 'block';

      SpeechManager.speakBoth(result.czechWord, 'cz', result.englishWord, 'en');
    }
  },

  advanceQuiz() {
    const container = document.getElementById('app-content');
    if (QuizEngine.nextQuestion()) {
      this.showQuestion(container);
    } else {
      const results = QuizEngine.getResults();
      App.navigate('results', { results });
    }
  },

  // =============================================
  // RESULTS SCREEN
  // =============================================
  renderResults(container, params) {
    const r = params.results;
    const starsHtml = '⭐'.repeat(r.stars) + '☆'.repeat(5 - r.stars);

    let wrongListHtml = '';
    if (r.wrongWords.length > 0) {
      wrongListHtml = `
        <div class="wrong-words-list">
          <h3>Chybná slovíčka:</h3>
          ${r.wrongWords.map(w => `
            <div class="wrong-word-item">
              <span class="wrong-word-pair">${w.czech} = <strong>${w.correctAnswer}</strong></span>
              <span class="wrong-word-user">(řekl/a jsi: ${w.userAnswer})</span>
              <button class="btn-sound-small" onclick="SpeechManager.speak('${w.correctAnswer.replace(/'/g, "\\'")}')">🔊</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    let encouragement;
    if (r.accuracy >= 90) encouragement = 'Skvělé, Anitko! Jsi hvězda! 🌟';
    else if (r.accuracy >= 70) encouragement = 'Výborně! Jen tak dál! 💪';
    else if (r.accuracy >= 50) encouragement = 'Dobrá práce! Příště to bude ještě lepší! 😊';
    else encouragement = 'Nevadí, cvičením se naučíš! 📚';

    // New achievements
    const achievementsHtml = r.newAchievements && r.newAchievements.length > 0 ? `
      <div class="new-achievements-banner">
        <h3>🏅 Nové odznaky!</h3>
        ${r.newAchievements.map(a => `
          <div class="achievement-unlocked">
            <span class="achievement-icon-big">${a.icon}</span>
            <div>
              <strong>${a.name}</strong>
              <div class="achievement-desc">${a.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Daily goal
    const dailyHtml = r.dailyGoalJustCompleted ? `
      <div class="daily-goal-completed-banner">🎯 Denní cíl splněn! Skvělá práce!</div>
    ` : '';

    container.innerHTML = `
      <div class="results-screen">
        <div class="results-header">
          <div class="results-emoji">${r.accuracy >= 70 ? '🎉' : '📚'}</div>
          <h2>${encouragement}</h2>
          <div class="results-stars">${starsHtml}</div>
        </div>

        <div class="results-stats">
          <div class="result-stat">
            <div class="result-stat-value">${r.correctCount}/${r.totalAnswered}</div>
            <div class="result-stat-label">Správně</div>
          </div>
          <div class="result-stat">
            <div class="result-stat-value">${r.accuracy}%</div>
            <div class="result-stat-label">Úspěšnost</div>
          </div>
          <div class="result-stat result-stat-xp">
            <div class="result-stat-value">+${r.totalXPEarned}</div>
            <div class="result-stat-label">💎 XP</div>
          </div>
        </div>

        <div class="results-xp-bar card">
          <div class="results-level-info">
            <span>⭐ Level ${r.xpProgress.level}: ${r.xpProgress.title}</span>
            <span>${r.xpProgress.xpInLevel}/${r.xpProgress.xpNeeded} XP</span>
          </div>
          <div class="xp-bar-container">
            <div class="xp-bar-fill" style="width: ${r.xpProgress.percentage}%"></div>
          </div>
        </div>

        ${dailyHtml}
        ${achievementsHtml}
        ${r.newWordsLearned > 0 ? `<div class="new-words-banner">🆕 Naučil/a ses ${r.newWordsLearned} nových slovíček!</div>` : ''}

        ${wrongListHtml}

        ${(() => {
          const catIds = r.categoryIds || [];
          let remaining = DataManager.data.words;
          if (catIds.length > 0) remaining = remaining.filter(w => catIds.includes(w.categoryId));
          const untestedLeft = remaining.filter(w => w.state === 'untested').length;
          const learningLeft = remaining.filter(w => w.state === 'learning').length;
          const toGo = untestedLeft + learningLeft;
          if (toGo === 0) {
            return '<div class="all-done-banner">🏆 V tomhle okruhu už umíš všechno! Vyber jiný okruh na dashboardu.</div>';
          }
          return `<div class="next-up-info">📌 V tomhle okruhu zbývá <strong>${toGo}</strong> slov (${untestedLeft} nezkoušeno, ${learningLeft} k procvičení).</div>`;
        })()}

        <div class="results-actions">
          ${r.wrongWords.length > 0 ? `
            <button class="btn btn-primary" onclick="App.navigate('quiz', { practiceWrong: true, wrongWords: ${JSON.stringify(r.wrongWords).replace(/"/g, '&quot;')} })">
              🔄 Procvičit chybná
            </button>
          ` : ''}
          ${(() => {
            const catIds = r.categoryIds || [];
            let remaining = DataManager.data.words;
            if (catIds.length > 0) remaining = remaining.filter(w => catIds.includes(w.categoryId));
            const toGo = remaining.filter(w => w.state !== 'known').length;
            if (toGo >= 4) {
              return `<button class="btn btn-primary btn-large" onclick="App.navigate('quiz', { categoryIds: ${JSON.stringify(catIds).replace(/"/g, '&quot;')} })">
                ▶ Pokračovat (${Math.min(DataManager.data.settings.quizSize, toGo)} dalších)
              </button>`;
            }
            return '';
          })()}
          <button class="btn btn-secondary" onclick="App.navigate('dashboard')">
            🏠 Zpět na úvod
          </button>
        </div>
      </div>
    `;

    // Check reward
    if (r.rewardEarned) {
      setTimeout(() => this.showReward(), 1000);
    }
    // Confetti for perfect score or new achievements
    if (r.accuracy === 100 || (r.newAchievements && r.newAchievements.length > 0)) {
      Confetti.start(3000);
    }
  },

  showReward() {
    const modal = document.getElementById('reward-modal');
    modal.innerHTML = `
      <div class="reward-content">
        <h1>🎉🎉🎉 GRATULACE! 🎉🎉🎉</h1>
        <div class="reward-chair">🪑</div>
        <h2>${DataManager.data.settings.rewardMessage}</h2>
        <p>Umíš už ${DataManager.calculateProgress().percentage}% všech slovíček!</p>
        <button class="btn btn-primary btn-large" onclick="document.getElementById('reward-modal').classList.add('hidden'); Confetti.stop();">
          Díky! 😊
        </button>
      </div>
    `;
    modal.classList.remove('hidden');
    Confetti.start(6000);
  },

  // =============================================
  // STATISTICS SCREEN
  // =============================================
  renderStats(container) {
    const catStats = DataManager.getCategoryStats();
    const hardest = DataManager.getHardestWords(10);
    const progress = DataManager.calculateProgress();
    const stats = DataManager.data.stats;

    const catBarsHtml = catStats.map(cat => `
      <div class="stat-category-bar">
        <div class="stat-cat-header">
          <span>${cat.icon} ${cat.name}</span>
          <span>${cat.known}/${cat.total} (${cat.percentage}%)</span>
        </div>
        <div class="stat-bar-container">
          <div class="stat-bar-fill bar-known" style="width: ${cat.total > 0 ? (cat.known / cat.total * 100) : 0}%"></div>
          <div class="stat-bar-fill bar-learning" style="width: ${cat.total > 0 ? (cat.learning / cat.total * 100) : 0}%"></div>
        </div>
      </div>
    `).join('');

    const hardestHtml = hardest.length > 0 ? `
      <div class="stats-section">
        <h3>💀 Nejtěžší slovíčka</h3>
        ${hardest.map((w, i) => `
          <div class="hardest-word">
            <span class="hardest-rank">${i + 1}.</span>
            <span class="hardest-pair">${w.czech} = ${w.english}</span>
            <span class="hardest-count">❌ ${w.wrongCount}x špatně</span>
            <button class="btn-sound-small" onclick="SpeechManager.speak('${w.english.replace(/'/g, "\\'")}')">🔊</button>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Session history - last 7 days
    const last7 = stats.sessionsLog.slice(-7);
    const sessionHistoryHtml = last7.length > 0 ? `
      <div class="stats-section">
        <h3>📅 Posledních 7 dnů</h3>
        <div class="session-history">
          ${last7.map(s => `
            <div class="session-day">
              <div class="session-date">${s.date.split('-').slice(1).join('.')}</div>
              <div class="session-bar-v" style="height: ${Math.min(s.questionsAnswered * 3, 100)}px"></div>
              <div class="session-count">${s.questionsAnswered}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="stats-screen">
        <div class="stats-header">
          <button class="btn btn-back" onclick="App.navigate('dashboard')">← Zpět</button>
          <h2>📊 Statistiky</h2>
        </div>

        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-card-value">${progress.known}</div>
            <div class="stat-card-label">Umím</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${progress.learning}</div>
            <div class="stat-card-label">Učím se</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${progress.untested}</div>
            <div class="stat-card-label">Nezkoušeno</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${stats.totalQuestionsAnswered}</div>
            <div class="stat-card-label">Odpovědí celkem</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${stats.currentStreak}🔥</div>
            <div class="stat-card-label">Denní série</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-value">${stats.totalQuestionsAnswered > 0 ? Math.round(stats.totalCorrectAnswers / stats.totalQuestionsAnswered * 100) : 0}%</div>
            <div class="stat-card-label">Celk. úspěšnost</div>
          </div>
        </div>

        <div class="stats-section">
          <h3>📚 Pokrok podle okruhů</h3>
          ${catBarsHtml}
        </div>

        ${hardestHtml}
        ${sessionHistoryHtml}

        <canvas id="stats-donut" width="200" height="200" style="display:none"></canvas>
      </div>
    `;

    // Draw donut chart
    this.drawDonutChart(progress);
  },

  drawDonutChart(progress) {
    const canvas = document.getElementById('stats-donut');
    if (!canvas || progress.total === 0) return;

    canvas.style.display = 'block';
    canvas.style.margin = '20px auto';
    const ctx = canvas.getContext('2d');
    const cx = 100, cy = 100, r = 70, lw = 25;

    const segments = [
      { value: progress.known, color: '#58CC02' },
      { value: progress.learning, color: '#FF9600' },
      { value: progress.untested, color: '#E5E5E5' }
    ];

    let startAngle = -Math.PI / 2;
    for (const seg of segments) {
      const sliceAngle = (seg.value / progress.total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'butt';
      ctx.stroke();
      startAngle += sliceAngle;
    }

    // Center text
    ctx.fillStyle = '#3C3C3C';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(progress.percentage + '%', cx, cy);
  },

  // =============================================
  // IMPORT SCREEN
  // =============================================
  renderImport(container) {
    container.innerHTML = `
      <div class="import-screen">
        <div class="import-header">
          <button class="btn btn-back" onclick="App.navigate('dashboard')">← Zpět</button>
          <h2>📥 Import slovíček (Excel / CSV)</h2>
        </div>

        <div class="import-instructions card">
          <h3>Formát souboru:</h3>
          <p>Pět sloupců: <strong>Česky | Anglicky | Výslovnost (IPA) | Učebnice | Téma</strong></p>
          <p>Okruh (kategorie) v aplikaci se sestaví jako <strong>„Učebnice — Téma"</strong> (např. <em>Project 4 — Family</em>).</p>
          <p>Výslovnost, Učebnice a Téma jsou volitelné. První řádek může být hlavička.</p>
          <div class="import-example">
            <table>
              <tr><th>A Česky</th><th>B Anglicky</th><th>C Výslovnost</th><th>D Učebnice</th><th>E Téma</th></tr>
              <tr><td>máma</td><td>mother</td><td>/ˈmʌðə/</td><td>Project 4</td><td>Family</td></tr>
              <tr><td>škola</td><td>school</td><td>/skuːl/</td><td>Project 4</td><td>School</td></tr>
              <tr><td>pes</td><td>dog</td><td>/dɒɡ/</td><td>Bridge 1</td><td>Animals</td></tr>
            </table>
          </div>
        </div>

        <div class="import-form card">
          <div class="form-group">
            <label>Vyber soubor (.xls, .xlsx, .csv):</label>
            <input type="file" id="import-file" accept=".xls,.xlsx,.csv" onchange="App.handleFileSelect(this)" class="input-file">
          </div>

          <div id="import-preview" style="display: none;"></div>
          <div id="import-error" style="display: none;"></div>

          <button class="btn btn-primary btn-large" id="import-btn" onclick="App.doImport()" disabled>
            ✅ Importovat vše
          </button>
        </div>
      </div>
    `;
  },

  handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const preview = document.getElementById('import-preview');
    const error = document.getElementById('import-error');
    const importBtn = document.getElementById('import-btn');

    preview.style.display = 'none';
    error.style.display = 'none';
    importBtn.disabled = true;

    ImportManager.parseFile(file).then(sheets => {
      const totalWords = sheets.reduce((sum, s) => sum + s.words.length, 0);
      preview.innerHTML = `
        <div class="import-preview-content">
          <h3>Nalezeno ${sheets.length} okruhů, celkem ${totalWords} slovíček:</h3>
          ${sheets.map(sheet => {
            const showCount = Math.min(3, sheet.words.length);
            return `
              <div class="import-sheet-preview">
                <h4>📚 ${sheet.name} (${sheet.words.length} slovíček)</h4>
                ${sheet.words.slice(0, showCount).map(w => `
                  <div class="preview-word">${w.czech} → ${w.english}${w.pronunciation ? ` <span class="preview-ipa">${w.pronunciation}</span>` : ''}</div>
                `).join('')}
                ${sheet.words.length > showCount ? `<div class="preview-more">...a dalších ${sheet.words.length - showCount}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
      preview.style.display = 'block';
      importBtn.disabled = false;
    }).catch(err => {
      error.innerHTML = `<div class="error-message">❌ ${err.message}</div>`;
      error.style.display = 'block';
    });
  },

  doImport() {
    const result = ImportManager.importAll();

    if (result.error) {
      alert(result.error);
      return;
    }

    // Show success
    const content = document.getElementById('app-content');
    content.innerHTML = `
      <div class="screen-message">
        <div class="message-icon bounce">✅</div>
        <h2>Import dokončen!</h2>
        <p>Přidáno: <strong>${result.added}</strong> slovíček v <strong>${result.categories}</strong> okruzích</p>
        ${result.skipped > 0 ? `<p>Přeskočeno (duplicitní): ${result.skipped}</p>` : ''}
        <button class="btn btn-primary" onclick="App.navigate('dashboard')">🏠 Na úvod</button>
        <button class="btn btn-secondary" onclick="App.navigate('import')">📥 Importovat další</button>
      </div>
    `;
    this.renderHeader();
  },

  // =============================================
  // SETTINGS SCREEN
  // =============================================
  renderSettings(container) {
    const settings = DataManager.data.settings;

    container.innerHTML = `
      <div class="settings-screen">
        <div class="settings-header">
          <button class="btn btn-back" onclick="App.navigate('dashboard')">← Zpět</button>
          <h2>⚙️ Nastavení</h2>
        </div>

        <div class="settings-form card">
          <div class="form-group">
            <label>Počet otázek v kvízu:</label>
            <select id="setting-quiz-size" class="input-field" onchange="App.saveSetting('quizSize', Number(this.value))">
              ${[5, 10, 15, 20, 25, 30].map(n => `
                <option value="${n}" ${settings.quizSize === n ? 'selected' : ''}>${n}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Cílový počet slovíček:</label>
            <input type="number" id="setting-target" class="input-field" value="${settings.targetTotal}"
                   onchange="App.saveSetting('targetTotal', Number(this.value))">
          </div>

          <div class="form-group">
            <label>Rychlost čtení (TTS):</label>
            <input type="range" id="setting-tts-rate" min="0.5" max="1.5" step="0.1" value="${SpeechManager.rate}"
                   onchange="SpeechManager.setRate(Number(this.value)); SpeechManager.speak('Hello Anitka!')">
            <span id="tts-rate-label">${SpeechManager.rate}x</span>
          </div>
        </div>

        <div class="settings-actions card">
          <h3>Data</h3>
          <button class="btn btn-secondary" onclick="DataManager.exportJSON()">
            💾 Exportovat zálohu (JSON)
          </button>

          <div class="form-group" style="margin-top: 12px;">
            <label>Importovat zálohu:</label>
            <input type="file" accept=".json" onchange="App.importBackup(this)" class="input-file">
          </div>

          <div class="danger-zone">
            <h3>⚠️ Nebezpečná zóna</h3>
            <button class="btn btn-danger" onclick="App.confirmReset()">
              🗑️ Smazat veškerý pokrok
            </button>
          </div>
        </div>
      </div>
    `;
  },

  saveSetting(key, value) {
    DataManager.data.settings[key] = value;
    DataManager.save();
  },

  confirmReset() {
    if (confirm('Opravdu chceš smazat veškerý pokrok? Slovíčka zůstanou, ale všechno se resetuje na začátek.')) {
      if (confirm('Jsi si jistá? Tuto akci nelze vrátit!')) {
        DataManager.resetProgress();
        App.navigate('dashboard');
      }
    }
  },

  importBackup(input) {
    const file = input.files[0];
    if (!file) return;

    DataManager.importJSON(file).then(() => {
      alert('Záloha úspěšně načtena!');
      App.navigate('dashboard');
    }).catch(err => {
      alert('Chyba: ' + err.message);
    });
  },

  // =============================================
  // CATEGORY WORDS - Detail view
  // =============================================
  renderCategoryWords(container, params) {
    const cat = DataManager.data.categories.find(c => c.id === params.categoryId);
    if (!cat) {
      App.navigate('dashboard');
      return;
    }

    const words = DataManager.getWordsForCategory(cat.id);

    const stateLabel = (state) => {
      if (state === 'known') return '<span class="badge badge-known">Umím ✅</span>';
      if (state === 'learning') return '<span class="badge badge-learning">Učím se 📖</span>';
      return '<span class="badge badge-untested">Nezkoušeno ❓</span>';
    };

    container.innerHTML = `
      <div class="category-detail-screen">
        <div class="category-detail-header">
          <button class="btn btn-back" onclick="App.navigate('dashboard')">← Zpět</button>
          <h2>${cat.icon} ${cat.name}</h2>
        </div>

        <div class="category-detail-actions">
          <button class="btn btn-primary" onclick="App.navigate('quiz', { categoryIds: ['${cat.id}'] })">
            🎯 Procvičovat tento okruh
          </button>
        </div>

        <div class="words-list card">
          <table class="words-table">
            <thead>
              <tr>
                <th>Česky</th>
                <th>Anglicky</th>
                <th>Stav</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${words.map(w => `
                <tr>
                  <td>${w.czech}</td>
                  <td>${w.english}${w.pronunciation ? ` <span class="word-ipa">${w.pronunciation}</span>` : ''}</td>
                  <td>${stateLabel(w.state)}</td>
                  <td><button class="btn-sound-small" onclick="SpeechManager.speak('${w.english.replace(/'/g, "\\'")}')">🔊</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // =============================================
  // ACHIEVEMENTS SCREEN
  // =============================================
  renderAchievements(container) {
    const achievements = DataManager.getAchievements();
    const unlocked = achievements.filter(a => a.unlocked).length;

    container.innerHTML = `
      <div class="achievements-screen">
        <div class="achievements-header">
          <button class="btn btn-back" onclick="App.navigate('dashboard')">← Zpět</button>
          <h2>🏅 Odznaky (${unlocked}/${achievements.length})</h2>
        </div>

        <div class="achievements-grid">
          ${achievements.map(a => `
            <div class="achievement-card ${a.unlocked ? 'achievement-unlocked-card' : 'achievement-locked'}">
              <div class="achievement-icon-display">${a.unlocked ? a.icon : '🔒'}</div>
              <div class="achievement-info">
                <div class="achievement-name">${a.name}</div>
                <div class="achievement-desc">${a.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
