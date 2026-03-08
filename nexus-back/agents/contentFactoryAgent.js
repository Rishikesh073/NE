/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         NEXUS — CONTENT FACTORY AGENT (v1.0)            ║
 * ║  Multi-step ReAct loop powered by Gemini Flash 1.5      ║
 * ║                                                          ║
 * ║  FLOW:  Research → Draft → Critique → Revise → Save     ║
 * ║                                                          ║
 * ║  Skills used:                                            ║
 * ║    • ai-agents-architect  (ReAct loop, tool registry)   ║
 * ║    • langgraph            (stateful step graph)         ║
 * ║    • prompt-engineering   (chain-of-thought prompts)    ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────
// 1. AGENT STATE  (replaces LangGraph's TypedDict in JS)
// ─────────────────────────────────────────────────────────────
function createInitialState(input) {
    return {
        // ── Inputs ───────────────────────────────────────────────
        productName: input.productName,
        description: input.description,
        targetAudience: input.targetAudience || 'General Audience',
        contentTypes: input.contentType || ['marketingCopy'],
        clientId: input.clientId || null,

        // ── Agent Memory (accumulated across steps) ───────────────
        researchInsights: null,   // Step 1 output
        draftOutput: null,   // Step 2 output
        critiqueScore: null,   // Step 3 output  (0–10)
        critiqueNotes: null,   // Step 3 output  (string[])
        revisionCount: 0,      // Loop counter (max 2)
        finalOutput: null,   // Step 4 output

        // ── Tracing ───────────────────────────────────────────────
        stepLog: [],     // [{step, summary, ms}]
        savedAssetId: null,
        error: null,
    };
}

// ─────────────────────────────────────────────────────────────
// 2. GEMINI CLIENT  (shared across all steps)
// ─────────────────────────────────────────────────────────────
function getModel() {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
    });
}

async function callGemini(model, prompt) {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

// ─────────────────────────────────────────────────────────────
// 3. STEP NODES  (ReAct loop — each step = Observe + Act)
// ─────────────────────────────────────────────────────────────

/** 
 * STEP 1: RESEARCH
 * Observe: raw product + audience data
 * Act:     identify pain points, emotional triggers, best angles
 */
async function stepResearch(state, model) {
    const t = Date.now();
    const prompt = `
You are a world-class consumer psychologist and direct-response marketing strategist.

PRODUCT: ${state.productName}
DESCRIPTION: ${state.description}
TARGET AUDIENCE: ${state.targetAudience}

Your job is to RESEARCH before writing copy. Analyse deeply and return a JSON object with:
{
  "primaryPainPoints": ["pain1", "pain2", "pain3"],
  "emotionalTriggers": ["trigger1", "trigger2"],
  "objections": ["objection1", "objection2"],
  "bestAngles": ["angle1", "angle2", "angle3"],
  "competitiveEdge": "What makes this product truly different in 1 sentence",
  "toneOfVoice": "One of: Professional / Casual / Bold / Empathetic / Urgent",
  "primaryHook": "The most powerful single hook statement for this audience"
}
Think step-by-step. Be specific, not generic.`;

    const json = await callGemini(model, prompt);
    state.researchInsights = json;
    state.stepLog.push({ step: 'research', summary: `Hook: "${json.primaryHook}"`, ms: Date.now() - t });
    return state;
}

/**
 * STEP 2: DRAFT
 * Observe: research insights + requested content types
 * Act:     produce first-draft content for all requested types
 */
async function stepDraft(state, model) {
    const t = Date.now();
    const insights = state.researchInsights;

    const typeInstructions = {
        marketingCopy: `Generate 3 direct-response ad copy variants (Facebook/Google/Instagram).
      Each variant must have: hook (grabbing first line), body (2-3 sentences), cta (action phrase).
      Return key "marketingCopy" as array of { variant: number, hook: string, body: string, cta: string }.`,

        seoKeywords: `Generate 15 high-intent SEO keywords showing purchase/solution intent.
      Mix: 5 short-tail, 5 long-tail, 5 question-based.
      Return key "seoKeywords" as array of { keyword: string, intent: "transactional|informational|navigational" }.`,

        blogOutline: `Generate a 6-section blog outline that educates and sells softly.
      Include: intro hook, 4 value sections, CTA section. Each section has title + 2 bullet points.
      Return key "blogOutline" as array of { section: string, bullets: [string, string] }.`,

        emailSequence: `Generate a 3-email welcome/nurture sequence.
      Email 1: Value intro, Email 2: Pain point + solution, Email 3: Social proof + offer.
      Each email: { subject: string, preview: string, body: string, cta: string }.
      Return key "emailSequence" as array of 3 email objects.`,

        instagramCaptions: `Generate 3 Instagram captions for different post types: Carousel, Reel, Story.
      Each: hook line, body (3 short paragraphs), 5 relevant hashtags, a CTA.
      Return key "instagramCaptions" as array of { type: string, hook: string, body: string, hashtags: string[], cta: string }.`,

        imagePrompt: `Write a hyper-detailed Midjourney/DALL-E image prompt for a compelling marketing visual.
      Style: ultra-professional, no UI overlays, cinematic lighting. Pure visual description.
      Return key "imagePrompt" as a single string.`,
    };

    const requestedInstructions = state.contentTypes
        .filter(t => typeInstructions[t])
        .map(t => typeInstructions[t])
        .join('\n\n');

    const prompt = `
You are an elite content creator writing first-draft marketing materials.

RESEARCH CONTEXT (use this to inform every word):
- Primary Hook: "${insights.primaryHook}"
- Tone of Voice: ${insights.toneOfVoice}
- Pain Points: ${insights.primaryPainPoints.join(', ')}
- Emotional Triggers: ${insights.emotionalTriggers.join(', ')}
- Competitive Edge: "${insights.competitiveEdge}"
- Key Objections to overcome: ${insights.objections.join(', ')}
- Best angles: ${insights.bestAngles.join(', ')}

PRODUCT: ${state.productName}
TARGET AUDIENCE: ${state.targetAudience}

GENERATE THE FOLLOWING (return all in a single JSON object):
${requestedInstructions}

Be persuasive, specific, and audience-relevant. No generic placeholder text.`;

    const json = await callGemini(model, prompt);
    state.draftOutput = json;

    // Generate image URL if imagePrompt was requested
    if (json.imagePrompt) {
        const encoded = encodeURIComponent(json.imagePrompt + ', ultra detailed, 8k, photorealistic, marketing style');
        const seed = Math.floor(Math.random() * 1000000);
        json.imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&nologo=true&seed=${seed}`;
    }

    state.stepLog.push({ step: 'draft', summary: `Generated ${Object.keys(json).join(', ')}`, ms: Date.now() - t });
    return state;
}

/**
 * STEP 3: CRITIQUE  (Self-review — the agent grades its own work)
 * Observe: the draft it just produced
 * Act:     score it 0–10, identify weak spots, decide if revision needed
 */
async function stepCritique(state, model) {
    const t = Date.now();

    const prompt = `
You are a brutal, world-class creative director reviewing marketing copy.

You just received this draft content:
${JSON.stringify(state.draftOutput, null, 2)}

It was created for:
- Product: ${state.productName}
- Audience: ${state.targetAudience}
- Intended tone: ${state.researchInsights.toneOfVoice}

CRITIQUE RUTHLESSLY. Return a JSON:
{
  "overallScore": <number 1-10, where 10 = agency-ready>,
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "whatToImprove": "Concise instruction set for the next revision pass",
  "approved": <true if score >= 8, false otherwise>
}

Be specific. Generic feedback is useless. Score < 8 means revise.`;

    const json = await callGemini(model, prompt);
    state.critiqueScore = json.overallScore;
    state.critiqueNotes = json.weaknesses;
    state.critiqueApproved = json.approved;
    state.critiqueInstructions = json.whatToImprove;
    state.stepLog.push({ step: 'critique', summary: `Score: ${json.overallScore}/10 | Approved: ${json.approved}`, ms: Date.now() - t });
    return state;
}

/**
 * STEP 4: REVISE  (only runs if critique score < 8 AND revisionCount < 2)
 * Observe: draft + critique notes
 * Act:     targeted revision pass
 */
async function stepRevise(state, model) {
    const t = Date.now();
    state.revisionCount += 1;

    const prompt = `
You are rewriting marketing content based on a creative director's critique.

ORIGINAL DRAFT:
${JSON.stringify(state.draftOutput, null, 2)}

CRITIQUE NOTES:
${state.critiqueNotes.join('\n- ')}

IMPROVEMENT INSTRUCTIONS:
${state.critiqueInstructions}

CONTEXT:
- Product: ${state.productName}
- Audience: ${state.targetAudience}
- Tone: ${state.researchInsights.toneOfVoice}
- Core Hook: "${state.researchInsights.primaryHook}"

Return the IMPROVED version in the exact same JSON structure as the original draft.
Fix every weakness. Make this agency-ready.`;

    const json = await callGemini(model, prompt);

    // Preserve imageUrl if it existed
    if (state.draftOutput.imageUrl && !json.imageUrl) {
        json.imageUrl = state.draftOutput.imageUrl;
    }

    state.draftOutput = json;
    state.stepLog.push({ step: `revise_${state.revisionCount}`, summary: `Revision ${state.revisionCount} complete`, ms: Date.now() - t });
    return state;
}

/**
 * STEP 5: SAVE TO FIRESTORE  (optional — only if clientId provided)
 * Saves the final generated output as an "ai_content" asset record
 */
async function stepSaveAsset(state) {
    if (!state.clientId) return state;

    try {
        const assetDoc = {
            clientId: state.clientId,
            name: `AI Content — ${state.productName}`,
            type: 'ai_content',
            contentTypes: state.contentTypes,
            content: state.finalOutput,
            agentMeta: {
                critiqueScore: state.critiqueScore,
                revisionCount: state.revisionCount,
                stepLog: state.stepLog,
                researchHook: state.researchInsights.primaryHook,
                toneOfVoice: state.researchInsights.toneOfVoice,
            },
            generatedAt: new Date().toISOString(),
        };

        const docRef = await db.collection('assets').add(assetDoc);
        state.savedAssetId = docRef.id;
        state.stepLog.push({ step: 'save', summary: `Saved as asset ${docRef.id}` });
    } catch (err) {
        // Non-fatal: log but don't crash the response
        console.error('[ContentFactory] Asset save failed:', err.message);
        state.stepLog.push({ step: 'save', summary: `Save failed: ${err.message}` });
    }

    return state;
}

// ─────────────────────────────────────────────────────────────
// 4. ROUTING FUNCTION  (LangGraph-style conditional edge)
//    Decides: should we revise again or finalize?
// ─────────────────────────────────────────────────────────────
function shouldRevise(state) {
    if (state.critiqueApproved) return 'finalize'; // Score >= 8 ✅
    if (state.revisionCount >= 2) return 'finalize'; // Max revisions hit 🛑
    return 'revise';                                        // Needs improvement 🔄
}

// ─────────────────────────────────────────────────────────────
// 5. MAIN AGENT RUNNER  (the graph executor)
// ─────────────────────────────────────────────────────────────
async function runContentFactoryAgent(input) {
    const startTime = Date.now();
    let state = createInitialState(input);

    console.log(`\n[ContentFactory] 🚀 Starting agent for: "${state.productName}"`);

    try {
        const model = getModel();

        // ── Node 1: Research ─────────────────────────────────────
        console.log('[ContentFactory] 🔍 Step 1: Researching audience & angles...');
        state = await stepResearch(state, model);

        // ── Node 2: Draft ────────────────────────────────────────
        console.log('[ContentFactory] ✍️  Step 2: Drafting content...');
        state = await stepDraft(state, model);

        // ── ReAct Loop: Critique → Route → (Revise → Critique)* ─
        let looping = true;
        while (looping) {
            console.log(`[ContentFactory] 🧐 Critique pass (revision #${state.revisionCount})...`);
            state = await stepCritique(state, model);

            const route = shouldRevise(state);
            console.log(`[ContentFactory] 🗺️  Router → "${route}" (score: ${state.critiqueScore}/10)`);

            if (route === 'revise') {
                console.log(`[ContentFactory] 🔄 Step: Revising (pass ${state.revisionCount + 1})...`);
                state = await stepRevise(state, model);
            } else {
                looping = false; // finalize
            }
        }

        // ── Finalize ─────────────────────────────────────────────
        state.finalOutput = {
            ...state.draftOutput,
            _agentMeta: {
                productName: state.productName,
                targetAudience: state.targetAudience,
                critiqueScore: state.critiqueScore,
                revisionCount: state.revisionCount,
                researchHook: state.researchInsights.primaryHook,
                toneOfVoice: state.researchInsights.toneOfVoice,
                painPoints: state.researchInsights.primaryPainPoints,
                stepLog: state.stepLog,
                totalMs: Date.now() - startTime,
            }
        };

        // ── Save Asset (if clientId given) ────────────────────────
        state = await stepSaveAsset(state);

        console.log(`[ContentFactory] ✅ Done in ${Date.now() - startTime}ms | Score: ${state.critiqueScore}/10 | Revisions: ${state.revisionCount}`);
        return { success: true, data: state.finalOutput, assetId: state.savedAssetId };

    } catch (err) {
        console.error('[ContentFactory] ❌ Agent error:', err);
        return { success: false, error: err.message };
    }
}

module.exports = { runContentFactoryAgent };
