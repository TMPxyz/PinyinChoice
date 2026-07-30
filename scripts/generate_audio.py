"""
generate_audio.py - 使用 Edge TTS 预生成游戏中所有汉字和拼音的高质量 MP3 语音

输出:
  audio/chars/{char}.mp3  - 每个汉字的读音
  audio/py/{pinyin}.mp3   - 每个拼音的读音（使用对应汉字朗读）
"""
import sys
import os
import asyncio
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from edge_tts_wrapper import Communicate

# 项目根目录
ROOT = Path(__file__).resolve().parent.parent
CHAR_PY_FILE = ROOT / 'charPY.txt'
AUDIO_CHARS_DIR = ROOT / 'audio' / 'chars'
AUDIO_PY_DIR = ROOT / 'audio' / 'py'

# 语音：自然女声
VOICE = 'zh-CN-XiaoxiaoNeural'
# 并发数
CONCURRENT = 10

def load_data():
    """加载 charPY.txt，返回 (chars_map, unique_pinyins)"""
    chars = []  # [(char, [pinyins]), ...]
    pinyin_to_char = {}  # pinyin -> first char

    with open(CHAR_PY_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(',')
            char = parts[0]
            pinyins = [p.strip() for p in parts[1:] if p.strip()]
            if not char or not pinyins:
                continue
            chars.append((char, pinyins))
            for py in pinyins:
                if py not in pinyin_to_char:
                    pinyin_to_char[py] = char

    return chars, pinyin_to_char


async def generate_one(sem, text, output_path, label, retries=2):
    """生成单个语音文件（带重试）"""
    async with sem:
        if output_path.exists() and output_path.stat().st_size > 0:
            print(f"  [跳过] {label} → {output_path.name}")
            return
        for attempt in range(retries + 1):
            try:
                tts = Communicate(text, VOICE)
                await tts.save(str(output_path))
                size = output_path.stat().st_size
                print(f"  [OK]   {label} → {output_path.name} ({size} bytes)")
                return
            except Exception as e:
                if attempt < retries:
                    wait = (attempt + 1) * 2
                    print(f"  [重试{attempt+1}] {label}: {e}")
                    await asyncio.sleep(wait)
                else:
                    print(f"  [失败] {label}: {e}")


async def generate_all():
    chars_data, pinyin_to_char = load_data()
    print(f"加载数据: {len(chars_data)} 汉字, {len(pinyin_to_char)} 唯一拼音")

    # 确保目录存在
    AUDIO_CHARS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_PY_DIR.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENT)
    tasks = []

    # 1. 生成每个汉字的读音
    print(f"\n=== 生成汉字读音 ({len(chars_data)} 个) ===")
    for char, pinyins in chars_data:
        out_path = AUDIO_CHARS_DIR / f"{char}.mp3"
        if char == '？' or char == '，' or char == '。':
            continue
        tasks.append(generate_one(sem, char, out_path, f"汉字 {char} ({','.join(pinyins)})"))

    # 2. 生成每个拼音的读音（用对应汉字朗读）
    print(f"\n=== 生成拼音读音 ({len(pinyin_to_char)} 个) ===")
    for pinyin, char in pinyin_to_char.items():
        out_path = AUDIO_PY_DIR / f"{pinyin}.mp3"
        tasks.append(generate_one(sem, char, out_path, f"拼音 {pinyin} (用汉字 {char})"))

    # 分批执行以控制内存
    batch_size = 50
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i + batch_size]
        await asyncio.gather(*batch)
        print(f"  进度: {min(i+batch_size, len(tasks))}/{len(tasks)}")


if __name__ == '__main__':
    asyncio.run(generate_all())
    print("\n✅ 全部完成！")
