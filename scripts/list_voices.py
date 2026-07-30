"""列出可用的中文语音"""
import sys
import asyncio
sys.path.insert(0, 'scripts')
from edge_tts_wrapper import list_voices

async def main():
    voices = await list_voices()
    for v in voices:
        if v['Locale'].startswith('zh'):
            name = v.get('LocalName', v.get('DisplayName', '?'))
            print(f"{v['ShortName']:35s} {v['Locale']:10s} {v['Gender']:6s} {name}")

asyncio.run(main())
