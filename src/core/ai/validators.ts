// AI validators — semantic operations only
// Strict sanitization pipeline: strip reasoning, chain-of-thought, markdown, XML

function stripThinkingTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<chain_of_thought>[\s\S]*?<\/chain_of_thought>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
}

function stripThinkingPrefixes(text: string): string {
  const patterns = [
    /^(?:thinking|thought|reasoning|analysis|chain[-\s]of[-\s]thought|step[-\s]by[-\s]step|logical reasoning|mental process|cognitive process|thought process|analysis process|reasoning process)[:\s]*.*$/gim,
    /^(?:шаг\s+\d+|step\s+\d+)[:\s].*$/gim,
    /^(?:considering|analyzing|examining|evaluating|determining|identifying|looking at|based on|approach|strategy|consideration|observation|note|overview|summary)[:\s].*$/gim,
    /^(?:вот|here(?:'s| is)|this is|the (?:name|title|description) is|result:|output:)/gim,
    /^(?:название|описание|группа|group|cluster|category|topic|theme)[:\s]*/gim,
    /^(?:результат|итог|final|ответ|answer)[:\s]*/gim,
    /^(?:не объясняй|не рассуждай|no reasoning|no chain|отвечай|ответить)[:\s]*.*$/gim,
    /^thinking\.\.\.*\s*$/gim,
    /^analyzing\.\.\.*\s*$/gim,
    /^reasoning\.\.\.*\s*$/gim,
    /^\[?(?:assistant|model|ai|system)[:\]\s]*/gim,
  ];
  let cleaned = text;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '');
  }
  return cleaned;
}

function extractLastMeaningfulLine(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];

  const skipPrefixes = /^(?:thinking|thought|reasoning|analysis|step|chain[-\s]of[-\s]thought|considering|analyzing|examining|evaluating|determining|identifying|looking at|based on|approach|strategy|observation|note|overview|conclusion|шаг|step\s+\d+)/i;
  const fullLineSkip = /^(?:вот|here(?:'s| is)|this is|result:|output:|final:|ответ:|answer:|результат:|итог:)/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (fullLineSkip.test(line)) continue;
    if (!skipPrefixes.test(line) && line.length >= 2) {
      return line;
    }
  }
  return lines[lines.length - 1];
}

function stripFormatting(text: string): string {
  return text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/["""'']/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/[*_~]{2}([\s\S]*?)[*_~]{2}/g, '$1')
    .replace(/[*_~]([^*_~]*)[*_~]/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAIResponse(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Stage 1: Strip XML/HTML thinking tags
  cleaned = stripThinkingTags(cleaned);

  // Stage 2: Strip thinking/reasoning prefixes line-by-line
  cleaned = stripThinkingPrefixes(cleaned);

  // Stage 3: Strip all markdown formatting
  cleaned = stripFormatting(cleaned);

  // Stage 4: Extract last meaningful line (the actual answer)
  cleaned = extractLastMeaningfulLine(cleaned);

  // Stage 5: Collapse whitespace
  cleaned = collapseWhitespace(cleaned);

  return cleaned;
}

export function sanitizeGroupName(text: string): string {
  let cleaned = sanitizeAIResponse(text);
  cleaned = cleaned
    .replace(/['']/g, '')
    .replace(/[\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to 2-4 words
  const words = cleaned.split(/\s+/);
  if (words.length > 4) {
    cleaned = words.slice(0, 4).join(' ');
  }
  if (words.length < 2) {
    return cleaned; // Allow 1-word names if that's all that remains
  }

  return cleaned;
}

export function sanitizeGroupDescription(text: string): string {
  let cleaned = sanitizeAIResponse(text);
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim();

  // Keep only first sentence
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 1) {
    cleaned = sentences[0].trim() + '.';
  }

  // Limit to 15 words
  const words = cleaned.split(/\s+/);
  if (words.length > 15) {
    cleaned = words.slice(0, 15).join(' ') + '.';
  }

  return cleaned;
}

export function sanitizePlainText(text: string, maxLength: number = 200): string {
  let cleaned = text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength).trim();
  return cleaned;
}

export function validatePlainText(data: unknown, maxLength: number = 200): string | null {
  if (typeof data === 'string') {
    const trimmed = sanitizePlainText(data, maxLength);
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.name === 'string') {
      const cleaned = sanitizePlainText(obj.name, maxLength);
      return cleaned.length > 0 ? cleaned : null;
    }
    if (typeof obj.text === 'string') {
      const cleaned = sanitizePlainText(obj.text, maxLength);
      return cleaned.length > 0 ? cleaned : null;
    }
    if (typeof obj.title === 'string') {
      const cleaned = sanitizePlainText(obj.title, maxLength);
      return cleaned.length > 0 ? cleaned : null;
    }
  }
  return null;
}

export function tryExtractJson(text: string): unknown {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
    ? firstBracket
    : firstBrace;

  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') depth--;
    if (depth === 0) { end = i; break; }
  }

  if (end === -1) return null;

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}
