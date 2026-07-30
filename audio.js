/**
 * audio.js - 音效与背景音乐管理
 *
 * 使用 Web Audio API 程序化生成所有音效和 BGM，
 * 无需外部音频文件。
 *
 * 负责：
 *   1. 用 OfflineAudioContext 渲染 BGM（~31s 和弦循环）
 *   2. 用 OscillatorNode 生成正确/错误音效
 *   3. 播放/暂停 BGM（无缝循环）
 *   4. 处理浏览器自动播放策略
 */

/* ============================
   AudioManager - 音频管理
   ============================ */
const AudioManager = {
  /** @type {AudioContext|null} */
  _ctx: null,
  /** @type {AudioBuffer|null} */
  _bgmBuffer: null,
  /** @type {AudioBuffer|null} */
  _correctBuffer: null,
  /** @type {AudioBuffer|null} */
  _wrongBuffer: null,
  /** @type {AudioBufferSourceNode|null} */
  _bgmSource: null,
  /** @type {boolean} */
  _bgmEnabled: true,
  /** @type {boolean} */
  _ready: false,

  /**
   * 创建/获取 AudioContext（懒初始化）
   * @returns {AudioContext}
   */
  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  },

  /**
   * 初始化：用 OfflineAudioContext 生成所有音频数据
   * @returns {Promise<void>}
   */
  async load() {
    try {
      const ctx = this._getContext();
      const sr = ctx.sampleRate;
      [this._bgmBuffer, this._correctBuffer, this._wrongBuffer] = await Promise.all([
        this._generateBGM(sr),
        this._generateCorrectSFX(sr),
        this._generateWrongSFX(sr),
      ]);
      this._ready = true;
    } catch (err) {
      console.warn('Web Audio API 初始化失败，游戏继续运行但无音效:', err);
      this._ready = false;
    }
  },

  /* ========================================
     BGM 生成 — 超级玛丽风格欢快背景音乐
     ======================================== */

  /**
   * 生成 BGM 循环：快板 C 大调，方波主旋律 + 贝斯 + 和弦
   * 和弦进行: C → G → Am → F（~29.5s，重复 4 遍）
   * @param {number} sr 采样率
   * @returns {Promise<AudioBuffer>}
   */
  async _generateBGM(sr) {
    const bpm = 130;
    const beatSec = 60 / bpm;            // ~0.462s/拍
    const totalBeats = 64;                // 16 拍 × 4 遍 = 64 拍
    const totalSec = totalBeats * beatSec; // ~29.5s
    const frameCount = Math.ceil(sr * totalSec);

    const off = new OfflineAudioContext(2, frameCount, sr);
    const master = off.createGain();
    master.gain.setValueAtTime(0.3, 0);
    master.connect(off.destination);

    // ----- 定义音符工具函数 -----
    // 根据半音数从 A4(440Hz) 计算频率
    const note = (semisFromA4) => 440 * Math.pow(2, semisFromA4 / 12);
    // 将拍数转换为秒
    const b = (beats) => beats * beatSec;

    // ----- 主旋律（方波，MC 风格）-----
    // 每行: [半音距A4, 起始拍, 持续拍数]
    // C 大调音阶半音: C= -9, D= -7, E= -5, F= -4, G= -2, A= 0, B= +2, C5= +3
    const melodySeq = [
      // === 第 1 遍：C → G → Am → F ===
      // C 和弦 (0-3拍): C4-E4-G4-C5 上行琶音
      [ -9, 0.00, 0.5 ], [ -5, 0.50, 0.5 ], [ -2, 1.00, 0.5 ], [ +3, 1.50, 0.5 ],
      [ +3, 2.00, 0.5 ], [ -2, 2.50, 0.5 ], [ -5, 3.00, 0.5 ], [ -9, 3.50, 0.5 ],
      // G 和弦 (4-7拍): G3-B3-D4-G4
      [ -14, 4.00, 0.5 ], [ -10, 4.50, 0.5 ], [ -7, 5.00, 0.5 ], [ -2, 5.50, 0.5 ],
      [ -2, 6.00, 0.5 ], [ -7, 6.50, 0.5 ], [ -10, 7.00, 0.5 ], [ -14, 7.50, 0.5 ],
      // Am 和弦 (8-11拍): A3-C4-E4-A4
      [ -12, 8.00, 0.5 ], [ -9, 8.50, 0.5 ], [ -5, 9.00, 0.5 ], [ 0, 9.50, 0.5 ],
      [ 0, 10.00, 0.5 ], [ -5, 10.50, 0.5 ], [ -9, 11.00, 0.5 ], [ -12, 11.50, 0.5 ],
      // F 和弦 (12-15拍): F3-A3-C4-F4
      [ -16, 12.00, 0.5 ], [ -12, 12.50, 0.5 ], [ -9, 13.00, 0.5 ], [ -4, 13.50, 0.5 ],
      [ -2, 14.00, 0.5 ], [ -4, 14.50, 0.5 ], [ -5, 15.00, 0.5 ], [ -7, 15.50, 0.5 ],

      // === 第 2 遍：变体 ===
      [ -5, 16.0, 0.5 ], [ -2, 16.5, 0.5 ], [ 0, 17.0, 0.5 ], [ +3, 17.5, 0.5 ],
      [ +5, 18.0, 0.5 ], [ +3, 18.5, 0.5 ], [ 0, 19.0, 0.5 ], [ -2, 19.5, 0.5 ],
      [ -10, 20.0, 0.5 ], [ -7, 20.5, 0.5 ], [ -5, 21.0, 0.5 ], [ -2, 21.5, 0.5 ],
      [ -2, 22.0, 0.5 ], [ -5, 22.5, 0.5 ], [ -7, 23.0, 0.5 ], [ -10, 23.5, 0.5 ],
      // Am → 跳跃
      [ 0, 24.0, 1.0 ], [ -5, 25.0, 0.5 ], [ -9, 25.5, 0.5 ],
      [ 0, 26.0, 0.5 ], [ -5, 26.5, 0.5 ], [ -9, 27.0, 0.5 ], [ -12, 27.5, 0.5 ],
      // F → 下行
      [ -4, 28.0, 0.5 ], [ -9, 28.5, 0.5 ], [ -12, 29.0, 0.5 ], [ -16, 29.5, 0.5 ],
      [ -14, 30.0, 0.5 ], [ -12, 30.5, 0.5 ], [ -9, 31.0, 0.5 ], [ -7, 31.5, 0.5 ],

      // === 第 3 遍：更快的八分音符律动 ===
      [ -9, 32.0, 0.25 ], [ -5, 32.25, 0.25 ], [ -2, 32.5, 0.25 ], [ -5, 32.75, 0.25 ],
      [ -9, 33.0, 0.25 ], [ -5, 33.25, 0.25 ], [ -2, 33.5, 0.25 ], [ +3, 33.75, 0.25 ],
      [ +3, 34.0, 0.25 ], [ -2, 34.25, 0.25 ], [ -5, 34.5, 0.25 ], [ -9, 34.75, 0.25 ],
      [ -5, 35.0, 0.25 ], [ -2, 35.25, 0.25 ], [ +3, 35.5, 0.25 ], [ +5, 35.75, 0.25 ],
      // G
      [ -14, 36.0, 0.25 ], [ -10, 36.25, 0.25 ], [ -7, 36.5, 0.25 ], [ -10, 36.75, 0.25 ],
      [ -14, 37.0, 0.25 ], [ -10, 37.25, 0.25 ], [ -7, 37.5, 0.25 ], [ -2, 37.75, 0.25 ],
      [ -2, 38.0, 0.25 ], [ -7, 38.25, 0.25 ], [ -10, 38.5, 0.25 ], [ -14, 38.75, 0.25 ],
      [ -10, 39.0, 0.25 ], [ -7, 39.25, 0.25 ], [ -2, 39.5, 0.25 ], [ -5, 39.75, 0.25 ],
      // Am
      [ -12, 40.0, 0.25 ], [ -9, 40.25, 0.25 ], [ -5, 40.5, 0.25 ], [ -9, 40.75, 0.25 ],
      [ -12, 41.0, 0.25 ], [ -9, 41.25, 0.25 ], [ -5, 41.5, 0.25 ], [ 0, 41.75, 0.25 ],
      [ 0, 42.0, 0.25 ], [ -5, 42.25, 0.25 ], [ -9, 42.5, 0.25 ], [ -12, 42.75, 0.25 ],
      [ -9, 43.0, 0.25 ], [ -5, 43.25, 0.25 ], [ 0, 43.5, 0.25 ], [ +3, 43.75, 0.25 ],
      // F
      [ -16, 44.0, 0.25 ], [ -12, 44.25, 0.25 ], [ -9, 44.5, 0.25 ], [ -12, 44.75, 0.25 ],
      [ -16, 45.0, 0.25 ], [ -12, 45.25, 0.25 ], [ -9, 45.5, 0.25 ], [ -4, 45.75, 0.25 ],
      [ -4, 46.0, 0.25 ], [ -9, 46.25, 0.25 ], [ -12, 46.5, 0.25 ], [ -16, 46.75, 0.25 ],
      [ -14, 47.0, 0.25 ], [ -12, 47.25, 0.25 ], [ -9, 47.5, 0.25 ], [ -7, 47.75, 0.25 ],

      // === 第 4 遍：结尾变奏 ===
      [ -9, 48.0, 0.5 ], [ -2, 48.5, 0.5 ], [ +3, 49.0, 0.5 ], [ +7, 49.5, 0.5 ],
      [ +5, 50.0, 0.5 ], [ +3, 50.5, 0.5 ], [ -2, 51.0, 0.5 ], [ -9, 51.5, 0.5 ],
      [ -14, 52.0, 0.5 ], [ -7, 52.5, 0.5 ], [ -2, 53.0, 0.5 ], [ +3, 53.5, 0.5 ],
      [ +2, 54.0, 0.5 ], [ 0, 54.5, 0.5 ], [ -2, 55.0, 0.5 ], [ -5, 55.5, 0.5 ],
      [ 0, 56.0, 0.5 ], [ -5, 56.5, 0.5 ], [ -9, 57.0, 0.5 ], [ -12, 57.5, 0.5 ],
      [ 0, 58.0, 0.5 ], [ -5, 58.5, 0.5 ], [ -9, 59.0, 0.5 ], [ 0, 59.5, 0.5 ],
      [ -4, 60.0, 0.5 ], [ -9, 60.5, 0.5 ], [ -12, 61.0, 0.5 ], [ -4, 61.5, 0.5 ],
      [ -2, 62.0, 0.5 ], [ -5, 62.5, 0.5 ], [ -9, 63.0, 0.5 ], [ -7, 63.5, 0.5 ],
    ];

    // 播放主旋律（方波）
    const leadBus = off.createGain();
    leadBus.gain.setValueAtTime(0.30, 0);
    leadBus.connect(master);

    melodySeq.forEach(([semis, startBeat, durBeat]) => {
      const t = b(startBeat);
      const d = b(durBeat);
      const freq = note(semis);
      const osc = off.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);

      const g = off.createGain();
      const a = 0.004, r = Math.min(0.03, d * 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + a);
      g.gain.setValueAtTime(1, t + d - r);
      g.gain.linearRampToValueAtTime(0, t + d);

      osc.connect(g);
      g.connect(leadBus);
      osc.start(t);
      osc.stop(t + d);
    });

    // ----- 贝斯（方波，低八度，每拍根音）-----
    // 和弦根音: C3, G2, A2, F2
    const bassRoots = [ -21, -26, -24, -28 ]; // C3, G2, A2, F2
    const bassBus = off.createGain();
    bassBus.gain.setValueAtTime(0.35, 0);
    bassBus.connect(master);

    for (let rep = 0; rep < 4; rep++) {
      const offset = rep * 16;
      bassRoots.forEach((root, ci) => {
        for (let beat = 0; beat < 4; beat++) {
          const t = b(offset + ci * 4 + beat);
          const freq = note(root);
          const osc = off.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, t);

          // 贝斯短促 staccato
          const g = off.createGain();
          const short = 0.25 * beatSec;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(1, t + 0.005);
          g.gain.setValueAtTime(1, t + short - 0.02);
          g.gain.linearRampToValueAtTime(0, t + short);

          osc.connect(g);
          g.connect(bassBus);
          osc.start(t);
          osc.stop(t + short);
        }
      });
    }

    // ----- 和弦伴奏（三角波，staccato，每小节第一拍）-----
    // 和弦: C4+E4+G4, G3+B3+D4, A3+C4+E4, F3+A3+C4
    const chordVoicings = [
      [ -9, -5, -2 ],   // C major
      [ -14, -10, -7 ], // G major
      [ -12, -9, -5 ],  // A minor
      [ -16, -12, -9 ], // F major
    ];
    const chordBus = off.createGain();
    chordBus.gain.setValueAtTime(0.18, 0);
    chordBus.connect(master);

    for (let rep = 0; rep < 4; rep++) {
      const offset = rep * 16;
      chordVoicings.forEach((voices, ci) => {
        const t = b(offset + ci * 4);
        voices.forEach((semis) => {
          const freq = note(semis);
          const osc = off.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          const g = off.createGain();
          const chordDur = 0.55 * beatSec;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(1, t + 0.008);
          g.gain.setValueAtTime(1, t + chordDur - 0.04);
          g.gain.linearRampToValueAtTime(0, t + chordDur);

          osc.connect(g);
          g.connect(chordBus);
          osc.start(t);
          osc.stop(t + chordDur);
        });
      });
    }

    return off.startRendering();
  },

  /* ========================================
     音效生成
     ======================================== */

  /**
   * 答对音效 — 上行双音 "叮咚"
   * G5(0.12s) → C6(0.30s) + 高八度泛音
   * @param {number} sr
   * @returns {Promise<AudioBuffer>}
   */
  async _generateCorrectSFX(sr) {
    const dur = 0.45;
    const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const m = off.createGain();
    m.gain.setValueAtTime(0.55, 0);
    m.connect(off.destination);

    this._tone(off, 783.99, 0,    0.12, 'sine', 0.9, m);
    this._tone(off, 1046.5, 0.10, 0.30, 'sine', 0.8, m);
    this._tone(off, 2093.0, 0.10, 0.18, 'sine', 0.2, m);
    return off.startRendering();
  },

  /**
   * 答错音效 — 低沉短促嗡嗡声
   * 150Hz sawtooth + 轻微不和谐二度
   * @param {number} sr
   * @returns {Promise<AudioBuffer>}
   */
  async _generateWrongSFX(sr) {
    const dur = 0.50;
    const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const m = off.createGain();
    m.gain.setValueAtTime(0.35, 0);
    m.connect(off.destination);

    this._tone(off, 150, 0,    0.45, 'sawtooth', 0.6, m);
    this._tone(off, 168, 0.02, 0.35, 'sawtooth', 0.3, m);
    return off.startRendering();
  },

  /**
   * 在 OfflineAudioContext 中添加一个音
   * @param {OfflineAudioContext} ctx
   * @param {number} freq
   * @param {number} t 开始时间(秒)
   * @param {number} d 持续时长(秒)
   * @param {OscillatorType} type
   * @param {number} vol 峰值音量
   * @param {GainNode} dest
   */
  _tone(ctx, freq, t, d, type, vol, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    const a = 0.005, r = Math.min(0.06, d * 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + d - r);
    g.gain.linearRampToValueAtTime(0, t + d);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + d);
  },

  /* ========================================
     播放控制
     ======================================== */

  /**
   * 启动 BGM（首次调用时尝试恢复 AudioContext）
   */
  startBGM() {
    if (!this._ready || !this._bgmEnabled) return;
    if (this._bgmSource) return; // 已在播放

    const ctx = this._getContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const src = ctx.createBufferSource();
    src.buffer = this._bgmBuffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, 0);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);

    this._bgmSource = src;
  },

  /**
   * 暂停 BGM
   */
  stopBGM() {
    if (this._bgmSource) {
      try { this._bgmSource.stop(); } catch { /* ignore */ }
      this._bgmSource = null;
    }
  },

  /**
   * 切换 BGM 开关
   * @returns {boolean} 切换后是否开启
   */
  toggleBGM() {
    this._bgmEnabled = !this._bgmEnabled;
    if (this._bgmEnabled) this.startBGM();
    else this.stopBGM();
    return this._bgmEnabled;
  },

  /** @returns {boolean} */
  isBGMEnabled() { return this._bgmEnabled; },

  /**
   * 播放答对音效
   */
  playCorrect() { this._ready && this._playBuffer(this._correctBuffer, 0.7); },

  /**
   * 播放答错音效
   */
  playWrong() { this._ready && this._playBuffer(this._wrongBuffer, 0.5); },

  /**
   * 播放缓冲区音效（每次新建 source，支持重叠）
   * @param {AudioBuffer} buf
   * @param {number} vol
   */
  _playBuffer(buf, vol) {
    try {
      const ctx = this._getContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, 0);
      src.connect(g);
      g.connect(ctx.destination);
      src.start(0);
    } catch { /* ignore */ }
  },
};
