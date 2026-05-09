// =====================================================
// DATA.JS - Data model, localStorage, spaced repetition
// =====================================================

const DataManager = {
  STORAGE_KEY: 'anitka_app',
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
        this.migrate();
      } else {
        this.data = this.getDefaultData();
        this.save();
      }
    } catch (e) {
      console.error('Failed to load data:', e);
      this.data = this.getDefaultData();
      this.save();
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  getDefaultData() {
    return {
      version: 2,
      categories: [],
      words: [],
      stats: {
        totalSessions: 0,
        totalQuestionsAnswered: 0,
        totalCorrectAnswers: 0,
        longestStreak: 0,
        currentStreak: 0,
        lastSessionDate: null,
        sessionsLog: [],
        // XP & Level system
        xp: 0,
        level: 1,
        // Combo tracking
        currentCombo: 0,
        bestCombo: 0,
        // Daily goal
        dailyGoal: 20,
        dailyProgress: 0,
        dailyGoalDate: null,
        dailyGoalsCompleted: 0,
        // Achievements
        achievements: []
      },
      settings: {
        quizSize: 10,
        targetTotal: 500,
        rewardThreshold: 0.95,
        rewardMessage: 'Skvělé, Anitko! Zasloužíš si KOLEČKOVOU ŽIDLI! 🎉🪑',
        selectedCategories: []
      }
    };
  },

  migrate() {
    if (!this.data.version || this.data.version < 2) {
      const s = this.data.stats;
      if (s.xp === undefined) s.xp = 0;
      if (s.level === undefined) s.level = 1;
      if (s.currentCombo === undefined) s.currentCombo = 0;
      if (s.bestCombo === undefined) s.bestCombo = 0;
      if (s.dailyGoal === undefined) s.dailyGoal = 20;
      if (s.dailyProgress === undefined) s.dailyProgress = 0;
      if (s.dailyGoalDate === undefined) s.dailyGoalDate = null;
      if (s.dailyGoalsCompleted === undefined) s.dailyGoalsCompleted = 0;
      if (s.achievements === undefined) s.achievements = [];
      this.data.version = 2;
      this.save();
    }
  },

  generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  },

  addCategory(name, icon, nameEn) {
    const cat = {
      id: this.generateId('cat'),
      name: name,
      nameEn: nameEn || '',
      icon: icon || '📚',
      createdAt: new Date().toISOString()
    };
    this.data.categories.push(cat);
    this.save();
    return cat;
  },

  addWords(category, wordPairs) {
    if (!this.data.categories.find(c => c.id === category.id)) {
      this.data.categories.push(category);
    }

    let added = 0, skipped = 0;
    for (const pair of wordPairs) {
      const exists = this.data.words.find(w =>
        w.czech.toLowerCase() === pair.czech.toLowerCase() &&
        w.english.toLowerCase() === pair.english.toLowerCase()
      );
      if (!exists) {
        this.data.words.push({
          id: this.generateId('w'),
          czech: pair.czech,
          english: pair.english,
          categoryId: category.id,
          state: 'untested',
          correctStreak: 0,
          totalCorrect: 0,
          totalAttempts: 0,
          lastAttemptAt: null,
          lastCorrectAt: null,
          wrongCount: 0,
          czToEnCorrect: 0,
          enToCzCorrect: 0,
          createdAt: new Date().toISOString()
        });
        added++;
      } else {
        skipped++;
      }
    }

    this.save();
    return { added, skipped };
  },

  updateWord(wordId, correct, direction) {
    const word = this.data.words.find(w => w.id === wordId);
    if (!word) return;

    word.totalAttempts++;
    word.lastAttemptAt = new Date().toISOString();

    if (correct) {
      word.totalCorrect++;
      word.correctStreak++;
      word.lastCorrectAt = new Date().toISOString();

      if (direction === 'cz_to_en') word.czToEnCorrect++;
      else word.enToCzCorrect++;

      // State transitions
      if (word.state === 'untested') {
        word.state = 'learning';
      }
      if (word.state === 'learning' && word.correctStreak >= 2) {
        word.state = 'known';
        word.correctStreak = 0; // reset for review tracking
      }
    } else {
      word.wrongCount++;
      word.correctStreak = 0;

      if (word.state === 'untested') {
        word.state = 'learning';
      }
      // If known word answered wrong, keep state but streak resets
    }

    this.save();
  },

  getWordsForCategory(categoryId) {
    return this.data.words.filter(w => w.categoryId === categoryId);
  },

  calculateProgress() {
    const words = this.data.words;
    const total = words.length;
    const known = words.filter(w => w.state === 'known').length;
    const learning = words.filter(w => w.state === 'learning').length;
    const untested = words.filter(w => w.state === 'untested').length;
    const target = this.data.settings.targetTotal;

    return {
      target,
      total,
      known,
      learning,
      untested,
      percentage: total > 0 ? Math.round((known / total) * 100) : 0,
      rewardEarned: total > 0 && (known / total) >= this.data.settings.rewardThreshold
    };
  },

  getWordPriority(word) {
    const now = Date.now();
    const timeSinceLastAttempt = word.lastAttemptAt
      ? (now - new Date(word.lastAttemptAt).getTime()) / (1000 * 60)
      : Infinity;

    // Tier 1: Words answered wrong recently (learning + has errors)
    if (word.state === 'learning' && word.wrongCount > 0) {
      return 1000 + word.wrongCount * 100 + Math.min(timeSinceLastAttempt, 500);
    }

    // Tier 2: Words in learning state
    if (word.state === 'learning') {
      return 500 + Math.min(timeSinceLastAttempt, 500);
    }

    // Tier 3: Untested words
    if (word.state === 'untested') {
      return 300 + Math.random() * 50;
    }

    // Tier 4: Known words needing review (streak < 2)
    if (word.state === 'known' && word.correctStreak < 2) {
      return 200 + Math.min(timeSinceLastAttempt / 10, 200);
    }

    // Tier 5: Mastered words
    if (word.state === 'known' && word.correctStreak >= 2) {
      return Math.min(timeSinceLastAttempt / 60, 100);
    }

    return 0;
  },

  selectQuizWords(quizSize, selectedCategories) {
    let pool = this.data.words;
    if (selectedCategories && selectedCategories.length > 0) {
      pool = pool.filter(w => selectedCategories.includes(w.categoryId));
    }

    if (pool.length === 0) return [];

    let scored = pool.map(w => ({ word: w, priority: this.getWordPriority(w) }));
    scored.sort((a, b) => b.priority - a.priority);

    const size = Math.min(quizSize, pool.length);
    return this.shuffleArray(scored.slice(0, size).map(s => s.word));
  },

  pickDirection(word) {
    // Bias toward the direction with fewer correct answers
    const czToEn = word.czToEnCorrect || 0;
    const enToCz = word.enToCzCorrect || 0;

    if (czToEn > enToCz + 1) return 'en_to_cz';
    if (enToCz > czToEn + 1) return 'cz_to_en';
    return Math.random() < 0.5 ? 'cz_to_en' : 'en_to_cz';
  },

  generateDistractors(correctWord, direction, count) {
    count = count || 3;
    const answerField = direction === 'cz_to_en' ? 'english' : 'czech';
    const correctAnswer = correctWord[answerField];

    // Prefer same category
    let sameCategory = this.data.words.filter(w =>
      w.categoryId === correctWord.categoryId && w.id !== correctWord.id
    );

    let pool = sameCategory.length >= count
      ? sameCategory
      : this.data.words.filter(w => w.id !== correctWord.id);

    let shuffled = this.shuffleArray([...pool]);
    let distractors = [];

    for (const w of shuffled) {
      if (distractors.length >= count) break;
      const val = w[answerField];
      if (val !== correctAnswer && !distractors.includes(val)) {
        distractors.push(val);
      }
    }

    return distractors;
  },

  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  updateSessionStats(questionsAnswered, correctAnswers, newWordsLearned) {
    const stats = this.data.stats;
    stats.totalSessions++;
    stats.totalQuestionsAnswered += questionsAnswered;
    stats.totalCorrectAnswers += correctAnswers;

    const today = new Date().toISOString().split('T')[0];
    if (stats.lastSessionDate === today) {
      // Update today's session log
      const todayLog = stats.sessionsLog.find(s => s.date === today);
      if (todayLog) {
        todayLog.questionsAnswered += questionsAnswered;
        todayLog.correctAnswers += correctAnswers;
        todayLog.newWordsLearned += newWordsLearned;
      }
    } else {
      // Check streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (stats.lastSessionDate === yesterdayStr) {
        stats.currentStreak++;
      } else {
        stats.currentStreak = 1;
      }

      if (stats.currentStreak > stats.longestStreak) {
        stats.longestStreak = stats.currentStreak;
      }

      stats.sessionsLog.push({
        date: today,
        questionsAnswered,
        correctAnswers,
        newWordsLearned
      });

      // Keep only last 30 sessions
      if (stats.sessionsLog.length > 30) {
        stats.sessionsLog = stats.sessionsLog.slice(-30);
      }

      stats.lastSessionDate = today;
    }

    this.save();
  },

  getCategoryStats() {
    return this.data.categories.map(cat => {
      const catWords = this.data.words.filter(w => w.categoryId === cat.id);
      const known = catWords.filter(w => w.state === 'known').length;
      const learning = catWords.filter(w => w.state === 'learning').length;
      const untested = catWords.filter(w => w.state === 'untested').length;
      return {
        ...cat,
        total: catWords.length,
        known,
        learning,
        untested,
        percentage: catWords.length > 0 ? Math.round((known / catWords.length) * 100) : 0
      };
    });
  },

  getHardestWords(limit) {
    return [...this.data.words]
      .filter(w => w.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, limit || 10);
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anitka-anglictina-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.version && imported.words && imported.categories) {
            this.data = imported;
            this.save();
            resolve({ success: true });
          } else {
            reject(new Error('Neplatný formát souboru'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  },

  resetProgress() {
    for (const word of this.data.words) {
      word.state = 'untested';
      word.correctStreak = 0;
      word.totalCorrect = 0;
      word.totalAttempts = 0;
      word.lastAttemptAt = null;
      word.lastCorrectAt = null;
      word.wrongCount = 0;
      word.czToEnCorrect = 0;
      word.enToCzCorrect = 0;
    }
    this.data.stats = this.getDefaultData().stats;
    this.save();
  },

  deleteCategory(categoryId) {
    this.data.categories = this.data.categories.filter(c => c.id !== categoryId);
    this.data.words = this.data.words.filter(w => w.categoryId !== categoryId);
    this.save();
  },

  // =============================================
  // XP & LEVEL SYSTEM
  // =============================================
  LEVEL_THRESHOLDS: [
    0, 50, 120, 220, 350, 520, 730, 1000, 1350, 1800,
    2350, 3000, 3800, 4750, 5900, 7250, 8850, 10750, 13000, 15650,
    18750, 22350, 26500, 31300, 36800, 43100, 50300, 58500, 67800, 78300
  ],

  LEVEL_TITLES: [
    'Začátečník', 'Nováček', 'Studentka', 'Žákyně', 'Pilná žákyně',
    'Pokročilá', 'Šikovná', 'Chytrá hlavička', 'Znalkyně', 'Expertka',
    'Mistryně', 'Hvězda', 'Superstar', 'Šampionka', 'Legenda',
    'Génius', 'Královna slov', 'Profesorka', 'Guru angličtiny', 'Bohyně slov',
    'Anitka Velká', 'Slovíčková čarodějka', 'Angličtinová ninja', 'Princezna slov', 'Královna angličtiny',
    'Slovíčková vládkyně', 'Mistr světa', 'Vesmírná hvězda', 'Legendární polyglot', 'ULTIMÁTNÍ ŠAMPION'
  ],

  addXP(amount) {
    const stats = this.data.stats;
    const oldLevel = stats.level;
    stats.xp += amount;

    // Calculate new level
    let newLevel = 1;
    for (let i = this.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (stats.xp >= this.LEVEL_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    stats.level = newLevel;
    this.save();

    return {
      xpGained: amount,
      totalXP: stats.xp,
      level: newLevel,
      leveledUp: newLevel > oldLevel,
      oldLevel,
      title: this.getLevelTitle(newLevel)
    };
  },

  getXPForAnswer(correct, combo) {
    if (!correct) return 0;
    let xp = 10; // base XP
    // Combo bonus: +2 per combo level, max +20
    xp += Math.min(combo * 2, 20);
    return xp;
  },

  getLevelTitle(level) {
    const idx = Math.min(level - 1, this.LEVEL_TITLES.length - 1);
    return this.LEVEL_TITLES[idx];
  },

  getXPProgress() {
    const stats = this.data.stats;
    const level = stats.level;
    const currentThreshold = this.LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = this.LEVEL_THRESHOLDS[level] || currentThreshold + 500;
    const xpInLevel = stats.xp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    return {
      level,
      xp: stats.xp,
      xpInLevel,
      xpNeeded,
      percentage: Math.round((xpInLevel / xpNeeded) * 100),
      title: this.getLevelTitle(level)
    };
  },

  // =============================================
  // COMBO SYSTEM
  // =============================================
  incrementCombo() {
    this.data.stats.currentCombo++;
    if (this.data.stats.currentCombo > this.data.stats.bestCombo) {
      this.data.stats.bestCombo = this.data.stats.currentCombo;
    }
    this.save();
    return this.data.stats.currentCombo;
  },

  resetCombo() {
    this.data.stats.currentCombo = 0;
    this.save();
  },

  // =============================================
  // DAILY GOAL
  // =============================================
  updateDailyProgress(questionsAnswered) {
    const stats = this.data.stats;
    const today = new Date().toISOString().split('T')[0];

    if (stats.dailyGoalDate !== today) {
      stats.dailyProgress = 0;
      stats.dailyGoalDate = today;
    }

    const wasBelowGoal = stats.dailyProgress < stats.dailyGoal;
    stats.dailyProgress += questionsAnswered;
    const nowAboveGoal = stats.dailyProgress >= stats.dailyGoal;

    if (wasBelowGoal && nowAboveGoal) {
      stats.dailyGoalsCompleted++;
      this.save();
      return true; // daily goal just completed!
    }

    this.save();
    return false;
  },

  getDailyProgress() {
    const stats = this.data.stats;
    const today = new Date().toISOString().split('T')[0];
    if (stats.dailyGoalDate !== today) {
      return { progress: 0, goal: stats.dailyGoal, completed: false, percentage: 0 };
    }
    return {
      progress: stats.dailyProgress,
      goal: stats.dailyGoal,
      completed: stats.dailyProgress >= stats.dailyGoal,
      percentage: Math.min(100, Math.round((stats.dailyProgress / stats.dailyGoal) * 100))
    };
  },

  // =============================================
  // ACHIEVEMENTS
  // =============================================
  ACHIEVEMENT_DEFS: [
    { id: 'first_quiz', icon: '🎯', name: 'První kvíz!', desc: 'Dokončil/a jsi svůj první kvíz', check: (s) => s.totalSessions >= 1 },
    { id: 'ten_correct', icon: '✅', name: '10 správně', desc: '10 správných odpovědí celkem', check: (s) => s.totalCorrectAnswers >= 10 },
    { id: 'fifty_correct', icon: '🌟', name: '50 správně', desc: '50 správných odpovědí celkem', check: (s) => s.totalCorrectAnswers >= 50 },
    { id: 'hundred_correct', icon: '💯', name: '100 správně!', desc: '100 správných odpovědí celkem', check: (s) => s.totalCorrectAnswers >= 100 },
    { id: 'five_hundred_correct', icon: '🏆', name: '500 správně!', desc: '500 správných odpovědí', check: (s) => s.totalCorrectAnswers >= 500 },
    { id: 'combo_5', icon: '🔥', name: 'Rozjetá!', desc: '5 správných v řadě', check: (s) => s.bestCombo >= 5 },
    { id: 'combo_10', icon: '💥', name: 'Nezastavitelná!', desc: '10 správných v řadě', check: (s) => s.bestCombo >= 10 },
    { id: 'combo_20', icon: '⚡', name: 'Blesk!', desc: '20 správných v řadě', check: (s) => s.bestCombo >= 20 },
    { id: 'streak_3', icon: '📅', name: '3 dny v řadě', desc: 'Cvičila jsi 3 dny po sobě', check: (s) => s.currentStreak >= 3 },
    { id: 'streak_7', icon: '🗓️', name: 'Týdenní série!', desc: 'Cvičila jsi 7 dní po sobě', check: (s) => s.currentStreak >= 7 },
    { id: 'streak_30', icon: '👑', name: 'Měsíční série!', desc: 'Cvičila jsi 30 dní po sobě', check: (s) => s.currentStreak >= 30 },
    { id: 'level_5', icon: '⬆️', name: 'Level 5', desc: 'Dosáhla jsi levelu 5', check: (s) => s.level >= 5 },
    { id: 'level_10', icon: '🚀', name: 'Level 10', desc: 'Dosáhla jsi levelu 10', check: (s) => s.level >= 10 },
    { id: 'level_20', icon: '🌈', name: 'Level 20', desc: 'Dosáhla jsi levelu 20', check: (s) => s.level >= 20 },
    { id: 'daily_goal_5', icon: '🎯', name: '5 denních cílů', desc: 'Splnila jsi denní cíl 5x', check: (s) => s.dailyGoalsCompleted >= 5 },
    { id: 'daily_goal_20', icon: '🏅', name: '20 denních cílů', desc: 'Splnila jsi denní cíl 20x', check: (s) => s.dailyGoalsCompleted >= 20 },
  ],

  checkAchievements() {
    const stats = this.data.stats;
    const newAchievements = [];

    for (const def of this.ACHIEVEMENT_DEFS) {
      if (!stats.achievements.includes(def.id) && def.check(stats)) {
        stats.achievements.push(def.id);
        newAchievements.push(def);
      }
    }

    if (newAchievements.length > 0) {
      this.save();
    }

    return newAchievements;
  },

  getAchievements() {
    const stats = this.data.stats;
    return this.ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: stats.achievements.includes(def.id)
    }));
  }
};
