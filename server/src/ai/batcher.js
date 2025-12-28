import PQueue from 'p-queue';
import OpenAI from 'openai';
import Groq from 'groq-sdk';

const queue = new PQueue({ concurrency: 4, interval: 1000, intervalCap: 20 });

function getProvider() {
  if (process.env.GROQ_API_KEY) {
    return {
      name: 'groq',
      client: new Groq({ apiKey: process.env.GROQ_API_KEY }),
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      name: 'openai',
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  return null;
}

export async function requestSuggestions({ language, code, cursor }) {
  const provider = getProvider();
  return queue.add(async () => {
    if (!provider) {
      return {
        choices: [{
          type: 'mock',
          text: `// Suggestion: Consider extracting a function near position ${cursor}\n`,
        }],
      };
    }

    const prompt = `You are a code assistant. Given the ${language} code, provide up to 3 suggestions: small completion snippet, potential errors, and a brief improvement tip.\n\nCode:\n${code}\n\nCursor:${cursor}`;

    try {
      if (provider.name === 'groq') {
        const resp = await provider.client.chat.completions.create({
          model: provider.model,
          messages: [
            { role: 'system', content: 'You are a helpful coding assistant.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 160,
          temperature: 0.2,
        });
        const text = resp.choices?.[0]?.message?.content || '';
        return { choices: [{ type: 'ai', text }] };
      }

      if (provider.name === 'openai') {
        const resp = await provider.client.chat.completions.create({
          model: provider.model,
          messages: [
            { role: 'system', content: 'You are a helpful coding assistant.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 160,
          temperature: 0.2,
        });
        const text = resp.choices?.[0]?.message?.content || '';
        return { choices: [{ type: 'ai', text }] };
      }

      return { choices: [{ type: 'mock', text: '// No provider configured' }] };
    } catch (e) {
      return { error: e.message };
    }
  });
}
