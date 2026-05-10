import { CreateMLCEngine } from 'https://esm.sh/@mlc-ai/web-llm@0.2.83';
import { LLM_MODEL_ID } from './config.js';
import { queueJob } from './engine.js';

let engine = null;

const FORMAT_PROMPT = `You are a transcription formatter. Restructure the following raw speech-to-text output into well-formatted text. Rules:
- Add proper punctuation (periods, commas, question marks, exclamation marks)
- Break text into logical paragraphs
- Remove filler words and sounds (um, uh, you know, like when used as filler, hmm, ah)
- Do NOT add any content that was not in the original
- Do NOT remove any meaningful content
- Do NOT summarize, abbreviate, or paraphrase
- Preserve the original meaning exactly
- Output ONLY the formatted text with no explanations or preamble

Raw transcription:`;

export function isLlmReady() {
  return engine !== null;
}

export async function loadLlm(onProgress) {
  engine = await CreateMLCEngine(LLM_MODEL_ID, {
    initProgressCallback: onProgress,
  });
  localStorage.setItem('llm_model_ready', 'true');
}

export async function runLlmFormat(text, priority = false) {
  return queueJob(async () => {
    if (!engine) throw new Error('LLM model not loaded');
    const reply = await engine.chat.completions.create({
      messages: [
        { role: 'user', content: `${FORMAT_PROMPT}\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: Math.max(text.length * 2, 512),
    });
    const formatted = reply.choices[0]?.message?.content?.trim();
    if (!formatted) throw new Error('LLM returned empty result');
    return formatted;
  }, priority);
}

export function unloadLlm() {
  if (engine) {
    try { engine.unload(); } catch {}
    engine = null;
  }
  localStorage.removeItem('llm_model_ready');
}
