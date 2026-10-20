import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Support JSON payloads up to 15MB for dataset batches
app.use(express.json({ limit: '15mb' }));

// Static files
app.use(express.static(__dirname));

// Initialize GoogleGenAI SDK instance
const ai = new GoogleGenAI();

/**
 * POST /api/ai/format
 * Formats inventory dataset items using Gemini 2.5 Flash with structured output schema.
 */
app.post('/api/ai/format', async (req, res) => {
  try {
    const { prompt, items } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: 'A prompt instruction is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'An array of inventory items is required.' });
    }

    // Limit to 150 items to keep latency fast and remain well within token constraints
    const sampleItems = items.slice(0, 150).map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || item.current_name || ''),
      barcode: String(item.barcode || ''),
      category: String(item.category || ''),
      price: String(item.price || '')
    }));

    const systemInstruction = `You are an expert retail & liquor store inventory formatting and POS standardization assistant (specializing in Clover and Toast POS catalog transformations).
Your task is to analyze inventory items and produce structured modifications based on the user's formatting request.

Common user requests include:
- Brand title casing (e.g. 'CORONA EXTRA 12PK' -> 'Corona Extra 12 Pack')
- Standardizing bottle volumes and package units (e.g. '750ML' -> '750ml', '1.75 L' -> '1.75L', '6PK' -> '6-Pack')
- Moving bottle sizes or pack specifications to the end of the item name
- Standardizing categories (e.g., 'Beer', 'Wine', 'Spirits', 'Non-Alcoholic')
- Removing messy POS suffixes or fixing pricing formatting
- Barcode leading zero or check adjustments

Guidelines:
1. ONLY propose changes for items that actually require adjustments per the user's instruction.
2. For each change, specify the exact item 'id', 'field' ('name', 'category', 'price', or 'barcode'), 'originalValue', 'proposedValue', and a clear, concise 'reason'.
3. In 'message', provide a conversational, helpful overview of the changes made.
4. In 'summary', provide a 1-sentence summary (e.g., 'Standardized 18 liquor bottle sizes and title casing.').
5. If no items require changes, return an empty 'changes' array with an explanatory message.`;

    const userContent = `User Request: "${prompt.trim()}"

Items to evaluate (${sampleItems.length} items):
${JSON.stringify(sampleItems, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            summary: { type: Type.STRING },
            changes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  field: { type: Type.STRING },
                  originalValue: { type: Type.STRING },
                  proposedValue: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ['id', 'field', 'originalValue', 'proposedValue', 'reason']
              }
            }
          },
          required: ['message', 'summary', 'changes']
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    return res.json({
      ok: true,
      message: parsed.message || 'Formatting proposals generated.',
      summary: parsed.summary || `Proposed adjustments for ${parsed.changes?.length || 0} items.`,
      changes: Array.isArray(parsed.changes) ? parsed.changes : []
    });
  } catch (err) {
    console.warn('Gemini cloud API call failed or key unconfigured, using smart retail formatter:', err.message);
    const fallback = generateRuleBasedFormatting(req.body.prompt, req.body.items || []);
    return res.json({
      ok: true,
      message: `${fallback.message} (Applied via intelligent retail formatter)`,
      summary: fallback.summary,
      changes: fallback.changes
    });
  }
});

export function generateRuleBasedFormatting(prompt, items) {
  const p = String(prompt || '').toLowerCase();
  const changes = [];

  for (const item of items) {
    const origName = String(item.name || '').trim();
    let newName = origName;
    const reasons = [];

    // Title case check
    if (p.includes('title') || p.includes('case') || p.includes('brand') || origName === origName.toUpperCase()) {
      const tc = origName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\b(Ml|Ltr|Oz|Fl|Pt|Qt)\b/g, (u) => u.toLowerCase())
        .replace(/\bUpc\b/i, 'UPC')
        .replace(/\bPk\b/i, 'Pack');
      if (tc !== origName && tc.length > 2) {
        newName = tc;
        reasons.push('Title-cased name and brand');
      }
    }

    // Volume / Size standardization
    if (p.includes('bottle') || p.includes('volume') || p.includes('size') || p.includes('ml') || p.includes('liter')) {
      const volNormalized = newName
        .replace(/(\d+)\s*([mM][lL])\b/g, '$1ml')
        .replace(/(\d+(?:\.\d+)?)\s*([lL]|[lL][tT][rR])\b/g, '$1L')
        .replace(/(\d+)\s*([oO][zZ])\b/g, '$1oz');
      if (volNormalized !== newName) {
        newName = volNormalized;
        reasons.push('Standardized bottle volume notation');
      }
    }

    // Pack standardization
    if (p.includes('pack') || p.includes('pk') || p.includes('can') || p.includes('beer')) {
      const packNormalized = newName
        .replace(/(\d+)\s*(?:[pP][kK]|[pP][aA][cC][kK])\b/g, '$1-Pack')
        .replace(/(\d+)\s*(?:[bB][tT][lL]|[bB][oO][tT][tT][lL][eE][sS]?)\b/gi, '$1-Bottle');
      if (packNormalized !== newName) {
        newName = packNormalized;
        reasons.push('Standardized multi-pack specification');
      }
    }

    // Suffix ordering: move volume or pack to end if requested
    if (p.includes('end') && (p.includes('volume') || p.includes('size'))) {
      const volMatch = newName.match(/\b(\d+(?:\.\d+)?(?:ml|L|oz))\b/i);
      if (volMatch && !newName.trim().endsWith(volMatch[1])) {
        const cleaned = newName.replace(volMatch[0], '').replace(/\s+/g, ' ').trim();
        newName = `${cleaned} ${volMatch[1]}`;
        reasons.push('Moved volume suffix to end of product title');
      }
    }

    if (newName !== origName && reasons.length > 0) {
      changes.push({
        id: item.id,
        field: 'name',
        originalValue: origName,
        proposedValue: newName,
        reason: reasons.join('; ')
      });
    }

    // Category suggestions if requested
    if (p.includes('categor') || p.includes('organize') || p.includes('department')) {
      const lower = origName.toLowerCase();
      let proposedCat = '';
      if (lower.includes('vodka') || lower.includes('whiskey') || lower.includes('bourbon') || lower.includes('rum') || lower.includes('gin') || lower.includes('tequila')) {
        proposedCat = 'Spirits';
      } else if (lower.includes('beer') || lower.includes('ipa') || lower.includes('lager') || lower.includes('ale') || lower.includes('stout') || lower.includes('cider')) {
        proposedCat = 'Beer';
      } else if (lower.includes('wine') || lower.includes('chardonnay') || lower.includes('cabernet') || lower.includes('pinot') || lower.includes('merlot')) {
        proposedCat = 'Wine';
      }
      if (proposedCat && proposedCat !== item.category) {
        changes.push({
          id: item.id,
          field: 'category',
          originalValue: item.category || 'Uncategorized',
          proposedValue: proposedCat,
          reason: `Auto-categorized by retail keyword to ${proposedCat}`
        });
      }
    }
  }

  return {
    message: `Analyzed items for "${prompt}". Generated ${changes.length} proposed formatting adjustment(s).`,
    summary: `Identified ${changes.length} adjustment(s) across catalog items.`,
    changes
  };
}

/**
 * POST /api/ai/chat
 * Conversational assistant for retail & Toast POS questions.
 */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'A message string is required.' });
    }

    const systemInstruction = `You are an expert retail & liquor store inventory specialist and POS advisor for Clover-to-Toast transitions.
Help the store operator understand Toast CSV import formatting, barcode standards (EAN-13, UPC-A, GTIN-14), pricing rules, and catalog cleanliness.
Keep answers friendly, clear, and actionable. Use bullet points where appropriate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message.trim(),
      config: {
        systemInstruction
      }
    });

    return res.json({
      ok: true,
      reply: response.text || 'No response generated.'
    });
  } catch (err) {
    console.warn('AI chat error (fallback provided):', err.message);
    return res.json({
      ok: true,
      reply: `I can help format your catalog for Toast POS. You can ask me to standardize bottle sizes (e.g. 750ml, 1.75L), title-case brand names, normalize multi-packs (e.g. 6-Pack), or auto-pad barcodes to 13 digits.`
    });
  }
});

// Fallback to index.html for unmatched routes
app.use((req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
