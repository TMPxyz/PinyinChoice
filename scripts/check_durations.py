"""检查4个文件的 ffprobe 输出"""
import subprocess

FFPROBE = r'C:\Users\zaex\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe'

for f in ['展', '巴', '模', '饼']:
    path = f'audio/chars/{f}.mp3'
    cmd = [FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]
    r = subprocess.run(cmd, capture_output=True)
    stdout_str = r.stdout.decode('utf-8', errors='replace').strip()
    stderr_str = r.stderr.decode('utf-8', errors='replace').strip()
    print(f"--- {f} ---")
    print(f"  stdout: [{stdout_str}]")
    if stderr_str:
        print(f"  stderr: {stderr_str[:200]}")
    print(f"  exists: {__import__('os').path.exists(path)}")
    print(f"  size: {__import__('os').path.getsize(path)}")
    print()
