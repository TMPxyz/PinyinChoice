"""
build_sprite.py - 将所有 MP3 合并为 Audio Sprite + 生成索引 JSON

输出:
  audio/sprite.mp3           - 所有汉字和拼音的合并音频文件
  audio/sprite_index.json    - 精灵图索引 { chars: {char: {start, end}}, pinyins: {py: {start, end}} }
"""
import os
import sys
import json
import subprocess
import asyncio
from pathlib import Path

# ffmpeg/ffprobe 路径
FFMPEG_DIR = r"C:\Users\zaex\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
FFPROBE = os.path.join(FFMPEG_DIR, "ffprobe.exe")
FFMPEG = os.path.join(FFMPEG_DIR, "ffmpeg.exe")

ROOT = Path(__file__).resolve().parent.parent
CHAR_PY_FILE = ROOT / 'charPY.txt'
AUDIO_CHARS_DIR = ROOT / 'audio' / 'chars'
AUDIO_PY_DIR = ROOT / 'audio' / 'py'
OUTPUT_SPRITE = ROOT / 'audio' / 'sprite.mp3'
OUTPUT_INDEX = ROOT / 'audio' / 'sprite_index.json'

def get_duration(mp3_path):
    """用 ffprobe 获取 MP3 时长（秒）"""
    cmd = [
        FFPROBE, '-v', 'error', '-show_entries',
        'format=duration', '-of', 'csv=p=0',
        str(mp3_path)
    ]
    result = subprocess.run(cmd, capture_output=True)
    # ffprobe 输出是二进制，部分内容含非 UTF-8/GBK 字符
    try:
        out = result.stdout.decode('utf-8').strip()
    except UnicodeDecodeError:
        try:
            out = result.stdout.decode('gbk').strip()
        except UnicodeDecodeError:
            out = result.stdout.decode('utf-8', errors='replace').strip()
    try:
        return float(out)
    except (ValueError, TypeError):
        print(f"  [警告] 无法获取时长: {mp3_path.name}")
        return 0.5  # 默认 0.5 秒

def generate_concat_file(entries, concat_path):
    """生成 ffmpeg concat 文件列表"""
    with open(concat_path, 'w', encoding='utf-8') as f:
        for entry in entries:
            f.write(f"file '{entry['path'].as_posix()}'\n")

def build():
    print("=" * 50)
    print("构建 Audio Sprite")
    print("=" * 50)

    # 1. 读取数据
    chars_data = []
    pinyin_to_char = {}
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
            chars_data.append((char, pinyins))
            for py in pinyins:
                if py not in pinyin_to_char:
                    pinyin_to_char[py] = char

    print(f"数据加载: {len(chars_data)} 汉字, {len(pinyin_to_char)} 拼音")

    # 2. 收集所有音频文件并获取时长
    entries = []
    index = {"chars": {}, "pinyins": {}}

    # 先收集所有汉字音频
    print("\n>>> 收集汉字音频...")
    for char, pinyins in chars_data:
        mp3_path = AUDIO_CHARS_DIR / f"{char}.mp3"
        if not mp3_path.exists():
            print(f"  [缺失] {char} → {mp3_path.name}")
            continue
        dur = get_duration(mp3_path)
        entries.append({"path": mp3_path, "type": "char", "key": char})
        index["chars"][char] = {"dur": dur}

    # 再收集所有拼音音频
    print("\n>>> 收集拼音音频...")
    for pinyin, char in pinyin_to_char.items():
        mp3_path = AUDIO_PY_DIR / f"{pinyin}.mp3"
        if not mp3_path.exists():
            print(f"  [缺失] {pinyin} → {mp3_path.name}")
            continue
        dur = get_duration(mp3_path)
        entries.append({"path": mp3_path, "type": "py", "key": pinyin})
        index["pinyins"][pinyin] = {"dur": dur}

    total = len(entries)
    print(f"\n总计 {total} 个音频片段")

    # 3. 计算累积时间戳
    current = 0.0
    for entry in entries:
        key = entry["key"]
        if entry["type"] == "char":
            index["chars"][key]["start"] = round(current, 3)
            index["chars"][key]["end"] = round(current + index["chars"][key]["dur"], 3)
            current += index["chars"][key]["dur"]
        else:
            index["pinyins"][key]["start"] = round(current, 3)
            index["pinyins"][key]["end"] = round(current + index["pinyins"][key]["dur"], 3)
            current += index["pinyins"][key]["dur"]

    total_duration = round(current, 2)
    print(f"精灵总时长: {total_duration}s")

    # 4. 生成 ffmpeg concat 文件列表
    concat_file = ROOT / 'audio' / '_concat.txt'
    generate_concat_file(entries, concat_file)
    print(f"\n>>> 生成 concat 列表: {concat_file.name}")

    # 5. 运行 ffmpeg 合并
    print(">>> 使用 ffmpeg 合并音频...")
    cmd = [
        FFMPEG, '-y',
        '-f', 'concat', '-safe', '0',
        '-i', str(concat_file),
        '-c', 'copy',
        str(OUTPUT_SPRITE)
    ]
    print(f"  命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [错误] ffmpeg 失败: {result.stderr}")
        return False

    sprite_size = OUTPUT_SPRITE.stat().st_size
    print(f"  [OK] 精灵文件: {OUTPUT_SPRITE.name} ({sprite_size/1024:.0f} KB)")

    # 6. 清理临时文件
    concat_file.unlink(missing_ok=True)

    # 7. 保存索引 JSON（只保留 start/end，去掉 dur 节省空间）
    clean_index = {
        "version": 1,
        "total": total,
        "duration": total_duration,
        "chars": {k: {"s": v["start"], "e": v["end"]} for k, v in index["chars"].items()},
        "pinyins": {k: {"s": v["start"], "e": v["end"]} for k, v in index["pinyins"].items()},
    }

    with open(OUTPUT_INDEX, 'w', encoding='utf-8') as f:
        json.dump(clean_index, f, ensure_ascii=False, separators=(',', ':'))

    index_size = OUTPUT_INDEX.stat().st_size
    print(f"  [OK] 索引文件: {OUTPUT_INDEX.name} ({index_size/1024:.1f} KB)")

    print(f"\n✅ Audio Sprite 构建完成！")
    print(f"   精灵文件: {OUTPUT_SPRITE.name} ({sprite_size/1024:.0f} KB)")
    print(f"   索引文件: {OUTPUT_INDEX.name} ({index_size/1024:.1f} KB)")
    print(f"   总片数: {total}, 总时长: {total_duration}s")
    return True

if __name__ == '__main__':
    success = build()
    sys.exit(0 if success else 1)
