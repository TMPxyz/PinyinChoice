"""
edge_tts_wrapper.py - 修复 Windows SSL 证书问题的 edge-tts 包装器

用法:
    from edge_tts_wrapper import Communicate, VoicesManager, list_voices
"""
import ssl

# 在导入 aiohttp 之前禁用 Windows 商店证书加载（已知 bug）
if hasattr(ssl, '_load_windows_store_certs'):
    ssl._load_windows_store_certs = lambda self, purpose: None

# 替换 create_default_context，使用 certifi 的证书文件
_original_create_default = ssl.create_default_context

def _patched_create_default_context(purpose=ssl.Purpose.SERVER_AUTH, *,
                                    cafile=None, capath=None, cadata=None):
    import certifi
    return _original_create_default(purpose, cafile=certifi.where())

ssl.create_default_context = _patched_create_default_context

# 现在可以正常导入 edge_tts
from edge_tts import Communicate, VoicesManager, list_voices

__all__ = ['Communicate', 'VoicesManager', 'list_voices']
