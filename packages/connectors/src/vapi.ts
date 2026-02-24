import { ContinuityContext, VapiResponse, MemorySummary, MessageRecord } from '../../shared/src/index.js';

function hasSalesState(context: ContinuityContext): boolean {
    // If a summary contains "sales", "enterprise plan", "pricing", etc., we can infer a sales state.
    const salesKeywords = ['sales', 'enterprise plan', 'pricing', 'quote', 'demo'];
    return context.summaries.some((s: MemorySummary) =>
        salesKeywords.some(keyword => s.summaryText.toLowerCase().includes(keyword))
    );
}

export class VapiConnector {

    constructor() {
        // In a real scenario, we might have Vapi credentials or configs.
    }

    /**
     * Formats the Continuity Context into a Vapi-compliant assistant configuration.
     * This is used for the 'assistant-request' webhook.
     * @param context The customer's continuity context.
     * @returns A VapiResponse object for the webhook response.
     */
    public formatAssistantResponse(context: ContinuityContext): VapiResponse {

        const isSalesState = hasSalesState(context);

        const recentHistory = context.recentMessages.map((m: MessageRecord) => `${m.direction === 'in' ? 'Customer' : 'Agent'}: ${m.contentRedacted}`).join('\n');
        const summaries = context.summaries.map((s: MemorySummary) => `- ${s.summaryText}`).join('\n');

        const systemPrompt = `
You are a helpful AI assistant. Your goal is to provide a seamless voice experience.

**Customer Profile:**
- Customer ID: ${context.profile.id}
- Primary Phone: ${context.profile.primaryPhone || 'N/A'}
- Primary Email: ${context.profile.primaryEmail || 'N/A'}

**Interaction History:**
Here are the most recent interactions with this customer:
${recentHistory}

**Key Summaries:**
We know the following about the customer:
${summaries}

**Your Task:**
Based on this context, provide a helpful and friendly response.
`.trim();

        const firstMessage = isSalesState
            ? "Thanks for calling back. I see we were discussing a potential sale. How can I help you with that today?"
            : "Thanks for calling. How can I help you today?";


        const response: VapiResponse = {
            assistant: {
                model: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                    ],
                },
                firstMessage: firstMessage
            }
        };

        return response;
    }
}
