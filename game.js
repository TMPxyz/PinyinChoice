/**
 * game.js - 拼音学习游戏主逻辑
 *
 * 包含四个模块：
 *   1. DataManager  - 数据加载与索引
 *   2. QuestionGenerator - 出题与错误选项生成
 *   3. GameManager  - 游戏状态管理
 *   4. UIManager    - 界面渲染
 */

/* ============================
   常量
   ============================ */
const CONFIG = {
  INITIAL_HP: 5,
  OPTIONS_COUNT: 4,
  BEST_SCORE_KEY: 'PinyinGameBestScore',
  DATA_FILE: 'charPY.txt',
  ANSWER_DELAY_CORRECT: 1000,  // 答对后等待 1 秒
  ANSWER_DELAY_WRONG: 5000,    // 答错后等待 5 秒
};

/* ============================
   DataManager - 数据加载与索引
   ============================ */
const DataManager = {
  /** @type {{ char: string, pinyins: string[] }[]} */
  data: [],
  /** @type {Map<string, string[]>} char → pinyins */
  charToPinyins: new Map(),
  /** @type {Map<string, string[]>} pinyin → chars */
  pinyinToChars: new Map(),
  /** @type {string[]} 所有不重复拼音 */
  allPinyins: [],
  /** @type {boolean} */
  ready: false,

  /**
   * 从 charPY.txt 加载数据并建立索引
   * @returns {Promise<void>}
   */
  async load() {
    const response = await fetch(CONFIG.DATA_FILE);
    if (!response.ok) {
      throw new Error(`无法加载 ${CONFIG.DATA_FILE}`);
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');

    this.data = [];
    const charToPinyins = new Map();
    const pinyinToChars = new Map();
    const allPinyinsSet = new Set();

    for (const line of lines) {
      const parts = line.split(',');
      const char = parts[0];
      const pinyins = parts.slice(1).filter(p => p.trim() !== '');

      if (!char || pinyins.length === 0) continue;

      this.data.push({ char, pinyins });
      charToPinyins.set(char, pinyins);

      for (const py of pinyins) {
        allPinyinsSet.add(py);
        if (!pinyinToChars.has(py)) {
          pinyinToChars.set(py, []);
        }
        pinyinToChars.get(py).push(char);
      }
    }

    this.charToPinyins = charToPinyins;
    this.pinyinToChars = pinyinToChars;
    this.allPinyins = [...allPinyinsSet];
    this.ready = true;
  },

  /**
   * 获取汉字对应的所有拼音
   * @param {string} char
   * @returns {string[]}
   */
  getPinyins(char) {
    return this.charToPinyins.get(char) || [];
  },

  /**
   * 获取拼音对应的所有汉字
   * @param {string} pinyin
   * @returns {string[]}
   */
  getChars(pinyin) {
    return this.pinyinToChars.get(pinyin) || [];
  },

  /**
   * 随机获取一个汉字
   * @returns {string}
   */
  getRandomChar() {
    const entry = this.data[Math.floor(Math.random() * this.data.length)];
    return entry.char;
  },

  /**
   * 随机获取一个拼音
   * @returns {string}
   */
  getRandomPinyin() {
    return this.allPinyins[Math.floor(Math.random() * this.allPinyins.length)];
  },
};

/* ============================
   QuestionGenerator - 出题与错误选项生成
   ============================ */
const QuestionGenerator = {
  /**
   * 在池中随机选取指定数量的不重复元素
   * @param {string[]} pool - 候选池
   * @param {number} count - 需要选取的数量
   * @param {Set<string>} exclude - 排除集合
   * @returns {string[]} 选取的元素数组（可能少于 count，如果池中元素不足）
   */
  _pickFromPool(pool, count, exclude) {
    const available = pool.filter(item => !exclude.has(item));
    const result = [];
    const used = new Set();
    while (result.length < count && result.length < available.length) {
      const idx = Math.floor(Math.random() * available.length);
      const item = available[idx];
      if (!used.has(item)) {
        used.add(item);
        result.push(item);
      }
    }
    return result;
  },

  /**
   * 生成题目：汉字 → 拼音
   * @returns {{ type: string, question: string, correct: string, options: string[] }}
   */
  generateMode1() {
    const char = DataManager.getRandomChar();
    const pinyins = DataManager.getPinyins(char);
    // 随机选取一个正确拼音
    const correct = pinyins[Math.floor(Math.random() * pinyins.length)];

    // 错误拼音池：所有拼音中排除当前汉字的全部合法拼音
    const exclude = new Set(pinyins);
    const wrongCount = CONFIG.OPTIONS_COUNT - 1;
    const wrongOptions = this._pickFromPool(DataManager.allPinyins, wrongCount, exclude);

    // 合并后随机排列
    const options = this._shuffle([correct, ...wrongOptions]);

    return {
      type: 'char-to-pinyin',
      question: char,
      correct,
      options,
    };
  },

  /**
   * 生成题目：拼音 → 汉字
   * @returns {{ type: string, question: string, correct: string, options: string[] }}
   */
  generateMode2() {
    // 随机选一个拼音
    const pinyin = DataManager.getRandomPinyin();
    const chars = DataManager.getChars(pinyin);
    // 随机选一个该拼音对应的汉字作为正确答案
    const correct = chars[Math.floor(Math.random() * chars.length)];

    // 错误汉字池：所有汉字中排除所有包含题目拼音的汉字
    const excludeSet = new Set(chars);
    const wrongCount = CONFIG.OPTIONS_COUNT - 1;
    const wrongOptions = this._pickFromPool(
      DataManager.data.map(d => d.char),
      wrongCount,
      excludeSet
    );

    const options = this._shuffle([correct, ...wrongOptions]);

    return {
      type: 'pinyin-to-char',
      question: pinyin,
      correct,
      options,
    };
  },

  /**
   * Fisher-Yates 洗牌
   * @param {string[]} arr
   * @returns {string[]}
   */
  _shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },

  /**
   * 随机选取一种模式生成题目
   * @returns {{ type: string, question: string, correct: string, options: string[] }}
   */
  generate() {
    const mode = Math.random() < 0.5 ? 1 : 2;
    return mode === 1 ? this.generateMode1() : this.generateMode2();
  },
};

/* ============================
   GameManager - 游戏状态管理
   ============================ */
const GameManager = {
  /** @type {number} */
  hp: CONFIG.INITIAL_HP,
  /** @type {number} */
  score: 0,
  /** @type {number} */
  bestScore: 0,
  /** @type {boolean} */
  isGameOver: false,
  /** @type {boolean} */
  isAnswering: false,

  /** 当前题目 */
  currentQuestion: null,

  /**
   * 初始化游戏
   */
  init() {
    this.hp = CONFIG.INITIAL_HP;
    this.score = 0;
    this.isGameOver = false;
    this.isAnswering = false;
    this.currentQuestion = null;
    this.bestScore = this._loadBestScore();
    UIManager.renderHeader(this.hp, this.score, this.bestScore);
    UIManager.showGameArea();
    UIManager.hideGameOver();
    this.nextQuestion();
  },

  /**
   * 进入下一题
   */
  nextQuestion() {
    this.isAnswering = false;
    this.currentQuestion = QuestionGenerator.generate();
    UIManager.renderQuestion(this.currentQuestion);
  },

  /**
   * 处理答案选择
   * @param {string} selected
   */
  answer(selected) {
    if (this.isGameOver || this.isAnswering) return;
    this.isAnswering = true;

    const isCorrect = selected === this.currentQuestion.correct;

    // 显示正误反馈
    UIManager.highlightAnswer(this.currentQuestion, selected, isCorrect);

    // 播放音效
    if (isCorrect) {
      AudioManager.playCorrect();
      this.score += 1;
    } else {
      AudioManager.playWrong();
      this.hp -= 1;
    }

    // 更新分数显示
    UIManager.renderHeader(this.hp, this.score, this.bestScore);

    if (this.hp <= 0) {
      this._gameOver();
    } else {
      // 延迟后进入下一题（正确1s，错误5s）
      const delay = isCorrect ? CONFIG.ANSWER_DELAY_CORRECT : CONFIG.ANSWER_DELAY_WRONG;
      setTimeout(() => this.nextQuestion(), delay);
    }
  },

  /**
   * 游戏结束
   */
  _gameOver() {
    this.isGameOver = true;
    this._saveBestScore();
    UIManager.showGameOver(this.score, this.bestScore);
  },

  /**
   * 从 localStorage 读取最高分
   * @returns {number}
   */
  _loadBestScore() {
    try {
      const val = localStorage.getItem(CONFIG.BEST_SCORE_KEY);
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  },

  /**
   * 保存最高分到 localStorage
   */
  _saveBestScore() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(CONFIG.BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // localStorage 不可用时静默失败
      }
    }
  },
};

/* ============================
   UIManager - 界面渲染
   ============================ */
const UIManager = {
  /** @type {HTMLElement} */
  loadingEl: document.getElementById('loading'),
  /** @type {HTMLElement} */
  gameAreaEl: document.getElementById('game-area'),
  /** @type {HTMLElement} */
  gameOverEl: document.getElementById('game-over'),
  /** @type {HTMLElement} */
  questionTextEl: document.getElementById('question-text'),
  /** @type {NodeListOf<HTMLButtonElement>} */
  optionBtns: document.querySelectorAll('.option-btn'),
  /** @type {HTMLElement} */
  hpHeartsEl: document.getElementById('hp-hearts'),
  /** @type {HTMLElement} */
  scoreValueEl: document.getElementById('score-value'),
  /** @type {HTMLElement} */
  bestValueEl: document.getElementById('best-value'),
  /** @type {HTMLElement} */
  finalScoreEl: document.getElementById('final-score'),
  /** @type {HTMLElement} */
  finalBestEl: document.getElementById('final-best'),
  /** @type {HTMLElement} */
  restartBtn: document.getElementById('restart-btn'),
  /** @type {HTMLElement} */
  bgmToggleEl: document.getElementById('bgm-toggle'),

  /** @type {boolean} */
  _initialized: false,
  /** @type {boolean} */
  _bgmStarted: false,

  /**
   * 初始化事件监听
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    // 选项按钮点击
    this.optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 浏览器自动播放策略：首次用户交互时启动 BGM
        if (!this._bgmStarted) {
          this._bgmStarted = true;
          AudioManager.startBGM();
        }
        const index = parseInt(btn.dataset.index, 10);
        const selected = GameManager.currentQuestion.options[index];
        GameManager.answer(selected);
      });
    });

    // Restart 按钮
    this.restartBtn.addEventListener('click', () => {
      GameManager.init();
    });

    // BGM 开关按钮
    if (this.bgmToggleEl) {
      this.bgmToggleEl.addEventListener('click', () => {
        const enabled = AudioManager.toggleBGM();
        this.bgmToggleEl.textContent = enabled ? '🔊' : '🔇';
        this.bgmToggleEl.classList.toggle('muted', !enabled);
      });
    }
  },

  /**
   * 显示加载完成，显示游戏区域
   */
  showGameArea() {
    this.loadingEl.style.display = 'none';
    this.gameAreaEl.style.display = 'flex';
    this.gameOverEl.style.display = 'none';
  },

  /**
   * 隐藏游戏结束界面
   */
  hideGameOver() {
    this.gameOverEl.style.display = 'none';
  },

  /**
   * 显示错误信息
   * @param {string} message
   */
  showError(message) {
    this.loadingEl.innerHTML = `<div id="error-message"><p>${message}</p></div>`;
  },

  /**
   * 渲染顶部状态栏
   * @param {number} hp
   * @param {number} score
   * @param {number} best
   */
  renderHeader(hp, score, best) {
    // HP 显示为爱心
    let hearts = '';
    for (let i = 0; i < hp; i++) {
      hearts += '♥';
    }
    this.hpHeartsEl.textContent = hearts;
    this.scoreValueEl.textContent = score;
    this.bestValueEl.textContent = best;
  },

  /**
   * 渲染题目
   * @param {{ type: string, question: string, correct: string, options: string[] }} question
   */
  renderQuestion(question) {
    // 题目标题 + 喇叭按钮
    this.questionTextEl.innerHTML = `
      <span class="question-content">${question.question}</span>
      <button class="speaker-btn" id="question-speaker" title="点击发音">🔊</button>
    `;

    // 绑定题目喇叭点击事件
    const speakerBtn = document.getElementById('question-speaker');
    speakerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      VoicePlayer.playQuestion(question);
    });

    // 重置选项按钮（清除上一题的选中/正误状态）
    this.optionBtns.forEach((btn, i) => {
      const optText = question.options[i] || '';
      btn.innerHTML = `
        <span class="option-text">${optText}</span>
        <span class="option-speaker">🔊</span>
      `;
      btn.disabled = false;
      btn.classList.remove('selected', 'correct', 'wrong');
      btn.blur();

      // 绑定选项喇叭点击（阻止触发答题）
      const optSpeaker = btn.querySelector('.option-speaker');
      optSpeaker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (question.type === 'char-to-pinyin') {
          VoicePlayer.playPinyin(optText);
        } else {
          VoicePlayer.playChar(optText);
        }
      });
    });

    // 自动播放题目语音（浏览器自动播放策略在首次交互后生效）
    try { VoicePlayer.playQuestion(question); } catch (_) {}
  },

  /**
   * 高亮正误答案
   * @param {{ type: string, question: string, correct: string, options: string[] }} question
   * @param {string} selected
   * @param {boolean} isCorrect
   */
  highlightAnswer(question, selected, isCorrect) {
    this.optionBtns.forEach((btn, i) => {
      btn.disabled = true;
      const text = question.options[i];
      if (text === question.correct) {
        btn.classList.add('correct');
      } else if (text === selected && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    // 答对时触发彩带拉炮效果
    if (isCorrect) {
      ConfettiEffect.fire();
    }
  },

  /**
   * 显示 Game Over 界面
   * @param {number} score
   * @param {number} best
   */
  showGameOver(score, best) {
    this.gameAreaEl.style.display = 'none';
    this.gameOverEl.style.display = 'flex';
    this.finalScoreEl.textContent = `Score: ${score}`;
    this.finalBestEl.textContent = `Best: ${best}`;
  },
};

/* ============================
   ConfettiEffect - 彩带拉炮效果
   ============================ */
const ConfettiEffect = {
  /** @type {HTMLCanvasElement|null} */
  _canvas: null,
  /** @type {CanvasRenderingContext2D|null} */
  _ctx: null,
  /** @type {Array} */
  _particles: [],
  /** @type {number|null} */
  _animationId: null,

  /**
   * 触发彩带拉炮效果（两侧发射）
   */
  fire() {
    this._createCanvas();
    this._spawnParticles();
    this._animate();
  },

  /**
   * 创建全屏 Canvas 覆盖层
   */
  _createCanvas() {
    this._cleanup();

    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
  },

  /**
   * 从左右两侧生成粒子
   */
  _spawnParticles() {
    const colors = [
      '#ff6b6b', '#ee5a24', '#f0932b', '#ffd93d',
      '#6bcb77', '#00b894', '#4d96ff', '#686de0',
      '#a29bfe', '#ff6bff', '#fd79a8', '#00cec9',
    ];
    const w = this._canvas.width;
    const h = this._canvas.height;
    const centerY = h * 0.35 + Math.random() * h * 0.2;

    // 左侧发射（向右）
    for (let i = 0; i < 50; i++) {
      this._particles.push(this._createParticle(
        -20, centerY + (Math.random() - 0.5) * h * 0.4,
        1, colors
      ));
    }
    // 右侧发射（向左）
    for (let i = 0; i < 50; i++) {
      this._particles.push(this._createParticle(
        w + 20, centerY + (Math.random() - 0.5) * h * 0.4,
        -1, colors
      ));
    }
  },

  /**
   * 创建单个粒子
   */
  _createParticle(x, y, direction, colors) {
    const angleSpread = 0.6;
    const baseAngle = direction > 0 ? 0 : Math.PI;
    const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
    const speed = 6 + Math.random() * 12;

    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(Math.abs(angle)) * speed * 0.6 - 6,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      w: 8 + Math.random() * 20,
      h: 4 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.25 + Math.random() * 0.15,
      opacity: 1,
      decay: 0.006 + Math.random() * 0.006,
      drag: 0.97 + Math.random() * 0.02,
    };
  },

  /**
   * 动画循环
   */
  _animate() {
    if (!this._canvas || !this._ctx) return;
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.clearRect(0, 0, w, h);

    let alive = false;
    for (const p of this._particles) {
      if (p.opacity <= 0) continue;

      p.vx *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.life = (p.life ?? 1) - p.decay;
      p.opacity = Math.max(0, p.life);

      if (p.opacity <= 0) continue;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive) {
      this._animationId = requestAnimationFrame(() => this._animate());
    } else {
      this._cleanup();
    }
  },

  /**
   * 清理画布与动画
   */
  _cleanup() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
    if (this._canvas) {
      this._canvas.remove();
      this._canvas = null;
      this._ctx = null;
    }
    this._particles = [];
  },
};

/* ============================
   VoicePlayer - Audio Sprite 语音播放
   ============================

   使用 Web Audio API 从 sprite.mp3 精灵图中
   按时间偏移量精准播放每个片段。

   采用懒加载策略：索引 JSON 随启动加载，
   精灵音频文件在首次点击 🔊 时才拉取和解码。
   ============================ */
const VoicePlayer = {
  /** @type {AudioContext|null} */
  _ctx: null,
  /** @type {AudioBuffer|null} */
  _buffer: null,
  /** @type {object|null} */
  _index: null,
  /** @type {boolean} */
  _loading: false,
  /** @type {Array<{start:number, end:number}>} */
  _pending: [],

  /**
   * 初始化：仅加载轻量索引 JSON
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const indexResp = await fetch('audio/sprite_index.json');
      if (!indexResp.ok) throw new Error('索引加载失败');
      this._index = await indexResp.json();
    } catch (err) {
      console.warn('[VoicePlayer] 索引加载失败:', err);
    }
  },

  /**
   * 首次使用时懒加载精灵音频
   * @returns {Promise<boolean>}
   */
  async _ensureBuffer() {
    if (this._buffer) return true;
    if (this._loading) return false;
    this._loading = true;

    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      const resp = await fetch('audio/sprite.mp3');
      if (!resp.ok) throw new Error('精灵文件加载失败');

      const arrayBuffer = await resp.arrayBuffer();
      this._buffer = await this._ctx.decodeAudioData(arrayBuffer);
      console.log(`[VoicePlayer] 精灵就绪: ${this._index.total} 片段, ${this._index.duration.toFixed(1)}s`);

      // 播放积压的待播放片段
      for (const seg of this._pending) {
        this._playSegmentNow(seg.start, seg.end);
      }
      this._pending = [];
      return true;
    } catch (err) {
      console.warn('[VoicePlayer] 精灵加载失败:', err);
      return false;
    } finally {
      this._loading = false;
    }
  },

  /**
   * 确保 AudioContext 处于运行状态
   */
  _resumeContext() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
  },

  /**
   * 实际播放
   */
  _playSegmentNow(start, end) {
    if (!this._buffer || !this._ctx) return;
    this._resumeContext();
    const duration = end - start;
    if (duration <= 0) return;
    try {
      const source = this._ctx.createBufferSource();
      source.buffer = this._buffer;
      source.connect(this._ctx.destination);
      source.start(0, start, duration);
    } catch (_) {}
  },

  /**
   * 播放精灵中的一个片段（自动触发懒加载）
   */
  _playSegment(start, end) {
    if (this._buffer) {
      this._playSegmentNow(start, end);
    } else {
      // 缓存待播放片段
      this._pending.push({ start, end });
      this._ensureBuffer();
    }
  },

  /**
   * 播放汉字的语音
   */
  playChar(char) {
    if (!this._index) return;
    const seg = this._index.chars[char];
    if (seg) this._playSegment(seg.s, seg.e);
  },

  /**
   * 播放拼音的语音
   */
  playPinyin(pinyin) {
    if (!this._index) return;
    const seg = this._index.pinyins[pinyin];
    if (seg) this._playSegment(seg.s, seg.e);
  },

  /**
   * 根据题目类型播放对应的语音
   */
  playQuestion(question) {
    if (question.type === 'char-to-pinyin') {
      this.playChar(question.question);
    } else {
      this.playPinyin(question.question);
    }
  },
};

/* ============================
   启动
   ============================ */
(async function main() {
  try {
    UIManager.init();
    // 并行加载数据、音效、语音精灵
    await Promise.all([
      DataManager.load(),
      AudioManager.load(),
      VoicePlayer.load(),
    ]);
    UIManager.showGameArea();
    GameManager.init();
  } catch (err) {
    console.error('启动失败:', err);
    UIManager.showError('数据加载失败，请检查网络或刷新重试。');
  }
})();
