const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.generateContent = async (req, res) => {
    try {
        const { productName, description, targetAudience, contentType } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY is missing in server environment variables." });
        }

        if (!productName || !description) {
            return res.status(400).json({ error: "Product Name and Description are required." });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const typesMap = {
            marketingCopy: "Generate 3 variants of direct-response marketing copy tailored for Facebook/Google Ads. Use psychological triggers (scarcity, urgency, authority). Provide a hook, body, and CTA for each. Return as an array of objects: { variant: string, hook: string, body: string, cta: string }.",
            seoKeywords: "Generate a list of 15 high-intent, low-funnel SEO keywords that show strong purchase intent. Return as an array of strings.",
            blogOutline: "Generate a 5-point blog post outline that educates the audience and naturally positions the product as the ultimate solution. Return a string.",
            image: "Write a highly detailed, descriptive midjourney-style image prompt for a compelling marketing graphic of this product. Do not use UI/UX text, just visual descriptions. Return a string."
        };

        let promptContext = `You are an elite, top-tier Direct Response Copywriter and SEO Strategist. Your goal is to analyze the product and audience, then generate extremely high-converting marketing materials.

PRODUCT NAME: ${productName}
DESCRIPTION: ${description}
TARGET AUDIENCE: ${targetAudience || 'General Audience'}

INSTRUCTIONS:
1. Think step-by-step about the audience's deep desires, pain points, and objections.
2. Output your reasoning in a "_thinking" key.
3. Generate the requested content perfectly mapped to your psychological analysis.
`;

        let requiredOutput = { "_thinking": "string (Your step-by-step psychological analysis of the audience and product)" };
        if (contentType.includes('marketingCopy')) requiredOutput.marketingCopy = "array of objects (hook, body, cta)";
        if (contentType.includes('seoKeywords')) requiredOutput.seoKeywords = "array of strings";
        if (contentType.includes('blogOutline')) requiredOutput.blogOutline = "string";
        if (contentType.includes('image')) requiredOutput.imagePrompt = "string";

        promptContext += `\nYou must return the output STRICTLY in valid JSON format with the following keys: ${Object.keys(requiredOutput).join(', ')}.\n`;
        promptContext += `Follow these instructions based on the requested types:\n`;

        contentType.forEach(type => {
            if (typesMap[type]) promptContext += `- ${type}: ${typesMap[type]}\n`;
        });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(promptContext);
        const text = result.response.text();
        const jsonOutput = JSON.parse(text);

        let finalOutput = { ...jsonOutput };

        // If image generation was requested, use the image prompt to create a pollinations URL
        if (contentType.includes('image') && jsonOutput.imagePrompt) {
            // Create a deterministic URL using the prompt and seed
            const promptEncoded = encodeURIComponent(jsonOutput.imagePrompt + ', ultra detailed, 8k, digital art, marketing style, highly professional');
            const seed = Math.floor(Math.random() * 1000000);
            finalOutput.imageUrl = `https://image.pollinations.ai/prompt/${promptEncoded}?width=1024&height=768&nologo=true&seed=${seed}`;
        }

        res.status(200).json(finalOutput);
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate AI content" });
    }
};
