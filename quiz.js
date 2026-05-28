// =====================================================
// QUIZ.JS - Quiz logic, question generation, evaluation
// =====================================================

const QuizEngine = {
  currentQuiz: null,

  startQuiz(categoryIds) {
    const quizSize = DataManager.data.settings.quizSize;
    const words = DataManager.selectQuizWords(quizSize, categoryIds);

    if (words.length < 4) {
      return null; // Need at least 4 words for multiple choice
    }

    this.currentQuiz = {
      queue: words.map(w => ({
        word: w,
        direction: DataManager.pickDirection(w),
        answered: false,
        correct: null,
        userAnswer: null
      })),
      currentIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      wrongWords: [],
      newWordsLearned: 0,
      startTime: Date.now(),
      categoryIds: categoryIds || []
    };

    return this.currentQuiz;
  },

  getCurrentQuestion() {
    if (!this.currentQuiz) return null;
    const q = this.currentQuiz;

    if (q.currentIndex >= q.queue.length) return null;

    const item = q.queue[q.currentIndex];
    const direction = item.direction;
    const word = item.word;

    // The question text and correct answer
    let questionText, questionLang, correctAnswer, answerLang;

    if (direction === 'cz_to_en') {
      questionText = word.czech;
      questionLang = 'Jak se řekne anglicky:';
      correctAnswer = word.english;
      answerLang = 'en';
    } else {
      questionText = word.english;
      questionLang = 'Jak se řekne česky:';
      correctAnswer = word.czech;
      answerLang = 'cz';
    }

    // Generate options
    const distractors = DataManager.generateDistractors(word, direction, 3);
    const options = DataManager.shuffleArray([correctAnswer, ...distractors]);

    return {
      questionText,
      questionLang,
      correctAnswer,
      answerLang,
      options,
      direction,
      word,
      questionNumber: q.currentIndex + 1,
      totalQuestions: q.queue.length,
      correctSoFar: q.correctCount,
      wrongSoFar: q.wrongCount
    };
  },

  submitAnswer(selectedAnswer) {
    if (!this.currentQuiz) return null;

    const q = this.currentQuiz;
    const item = q.queue[q.currentIndex];
    const direction = item.direction;
    const word = item.word;

    const correctAnswer = direction === 'cz_to_en' ? word.english : word.czech;
    const isCorrect = selectedAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    item.answered = true;
    item.correct = isCorrect;
    item.userAnswer = selectedAnswer;

    // Track if word was just learned (transitioned from learning/untested to known)
    const wasBefore = word.state;

    // Update word in data
    DataManager.updateWord(word.id, isCorrect, direction);

    if (isCorrect) {
      q.correctCount++;

      // Combo & XP
      const combo = DataManager.incrementCombo();
      const xpAmount = DataManager.getXPForAnswer(true, combo);
      const xpResult = DataManager.addXP(xpAmount);
      q.lastXP = xpAmount;
      q.lastCombo = combo;
      q.lastLevelUp = xpResult.leveledUp ? xpResult : null;
      q.totalXPEarned = (q.totalXPEarned || 0) + xpAmount;

      // Refresh word reference to see updated state
      const updatedWord = DataManager.data.words.find(w => w.id === word.id);
      if (updatedWord && updatedWord.state === 'known' && wasBefore !== 'known') {
        q.newWordsLearned++;
      }
    } else {
      q.wrongCount++;
      q.lastXP = 0;
      q.lastCombo = 0;
      q.lastLevelUp = null;
      DataManager.resetCombo();
      q.wrongWords.push({
        czech: word.czech,
        english: word.english,
        userAnswer: selectedAnswer,
        correctAnswer
      });

      // Re-add word to end of queue for another try
      q.queue.push({
        word: word,
        direction: direction,
        answered: false,
        correct: null,
        userAnswer: null
      });
    }

    return {
      isCorrect,
      correctAnswer,
      englishWord: word.english,
      czechWord: word.czech,
      pronunciation: word.pronunciation || '',
      xpGained: q.lastXP || 0,
      combo: q.lastCombo || 0,
      levelUp: q.lastLevelUp
    };
  },

  nextQuestion() {
    if (!this.currentQuiz) return false;
    this.currentQuiz.currentIndex++;
    return this.currentQuiz.currentIndex < this.currentQuiz.queue.length;
  },

  getResults() {
    if (!this.currentQuiz) return null;

    const q = this.currentQuiz;
    const totalAnswered = q.correctCount + q.wrongCount;
    const accuracy = totalAnswered > 0 ? Math.round((q.correctCount / totalAnswered) * 100) : 0;
    const duration = Math.round((Date.now() - q.startTime) / 1000);

    // Star rating (1-5)
    let stars;
    if (accuracy >= 95) stars = 5;
    else if (accuracy >= 85) stars = 4;
    else if (accuracy >= 70) stars = 3;
    else if (accuracy >= 50) stars = 2;
    else stars = 1;

    // Update session stats
    DataManager.updateSessionStats(totalAnswered, q.correctCount, q.newWordsLearned);

    // Update daily progress & check achievements
    const dailyGoalJustCompleted = DataManager.updateDailyProgress(totalAnswered);
    const newAchievements = DataManager.checkAchievements();

    // Check for reward
    const progress = DataManager.calculateProgress();
    const xpProgress = DataManager.getXPProgress();

    return {
      correctCount: q.correctCount,
      wrongCount: q.wrongCount,
      totalAnswered,
      accuracy,
      stars,
      duration,
      wrongWords: q.wrongWords,
      newWordsLearned: q.newWordsLearned,
      rewardEarned: progress.rewardEarned,
      progress,
      totalXPEarned: q.totalXPEarned || 0,
      xpProgress,
      dailyGoalJustCompleted,
      newAchievements,
      categoryIds: q.categoryIds || []
    };
  },

  startPracticeWrongWords(wrongWords) {
    if (!wrongWords || wrongWords.length === 0) return null;

    // Find the actual word objects
    const wordObjects = wrongWords.map(ww => {
      return DataManager.data.words.find(w =>
        w.czech === ww.czech && w.english === ww.english
      );
    }).filter(Boolean);

    if (wordObjects.length < 4) {
      // Not enough for multiple choice, pad with random words
      const allWords = DataManager.data.words;
      while (wordObjects.length < 4 && allWords.length > wordObjects.length) {
        const random = allWords[Math.floor(Math.random() * allWords.length)];
        if (!wordObjects.find(w => w.id === random.id)) {
          wordObjects.push(random);
        }
      }
    }

    if (wordObjects.length < 4) return null;

    this.currentQuiz = {
      queue: wordObjects.map(w => ({
        word: w,
        direction: DataManager.pickDirection(w),
        answered: false,
        correct: null,
        userAnswer: null
      })),
      currentIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      wrongWords: [],
      newWordsLearned: 0,
      startTime: Date.now()
    };

    return this.currentQuiz;
  }
};
