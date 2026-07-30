/**
 * generateCharPY.js
 * 
 * 从 comchar2.txt 读取汉字，使用 pinyin-pro 生成拼音，
 * 输出 charPY.txt（UTF-8 编码）。
 * 
 * 格式：汉字,拼音1,拼音2,...
 * 示例：长,chang,zhang
 * 
 * 用法：node generateCharPY.js
 */

const fs = require('fs');
const path = require('path');
const pinyinPro = require('pinyin-pro');

// 声调符号 → 对应的字母
const TONE_MAP = {
  'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
  'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
  'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
  'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
  'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
  'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
  'ü': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v',
  'ń': 'n', 'ň': 'n', 'ǹ': 'n',
  'ḿ': 'm',
};

/**
 * 去除声调符号
 */
function stripTone(pinyin) {
  let result = '';
  for (const ch of pinyin) {
    result += TONE_MAP[ch] || ch;
  }
  return result;
}

/**
 * 获取一个汉字的全部拼音（去重、小写、无调）
 */
function getAllPinyins(char) {
  const raw = pinyinPro.polyphonic(char);
  if (!raw || raw.length === 0) {
    // fallback: 用 pinyin 获取默认读音
    const fallback = pinyinPro.pinyin(char, { toneType: 'none', type: 'array' });
    return fallback ? [...new Set(fallback.map(s => s.trim().toLowerCase()).filter(Boolean))] : [];
  }

  const pinyins = [];
  for (const entry of raw) {
    // entry 可能是 "cháng zhǎng" 或者 "nǐ"
    const parts = entry.split(/\s+/);
    for (const part of parts) {
      const cleaned = stripTone(part).trim().toLowerCase();
      if (cleaned) {
        pinyins.push(cleaned);
      }
    }
  }
  return [...new Set(pinyins)];
}

function main() {
  const inputFile = path.join(__dirname, 'comchar2.txt');
  const outputFile = path.join(__dirname, 'charPY.txt');

  // 读取所有汉字
  const content = fs.readFileSync(inputFile, 'utf-8');
  // 提取所有非空白、非标点的汉字字符
  const chars = [];
  for (const ch of content) {
    // 匹配常见汉字 Unicode 范围
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chars.push(ch);
    }
  }

  console.log(`共读取到 ${chars.length} 个汉字。`);

  // 去重（按首次出现顺序保留）
  const uniqueChars = [...new Set(chars)];
  console.log(`去重后剩余 ${uniqueChars.length} 个唯一汉字。`);

  const lines = [];
  const skipped = [];

  for (const char of uniqueChars) {
    const pinyins = getAllPinyins(char);
    if (pinyins.length === 0) {
      skipped.push(char);
      continue;
    }
    lines.push(`${char},${pinyins.join(',')}`);
  }

  // 排序
  lines.sort();

  fs.writeFileSync(outputFile, lines.join('\n') + '\n', 'utf-8');
  console.log(`已写入 ${outputFile}`);
  console.log(`成功处理 ${lines.length} 个汉字。`);

  if (skipped.length > 0) {
    console.log(`以下 ${skipped.length} 个汉字未找到拼音，已跳过：`);
    console.log(skipped.join(''));
  }
}

main();
