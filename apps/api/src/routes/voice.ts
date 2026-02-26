import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getContext, SupabaseContinuityStore } from "@acx/memory";
import { VapiConnector } from "@acx/connectors";
import type { VapiRequest, VapiEndReport } from "@acx/shared";

const voiceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const store = new SupabaseContinuityStore();
  const vapiConnector = new VapiConnector();

  // Handle Vapi's 'assistant-request' webhook
  fastify.post("/voice/vapi-request", async (req, reply) => {
    try {
      const payload = req.body as VapiRequest;
      const customerNumber = payload.message.customer.number;

      if (!customerNumber) {
        return reply.status(400).send("Customer number is required.");
      }

      const context = await getContext(store, {
        channel: "voice",
        externalUserId: customerNumber,
        userText: "",
        limits: { recentMessages: 20, semanticHits: 8, summaries: 3 },
      });

      const assistantResponse = vapiConnector.formatAssistantResponse(context);
      reply.send(assistantResponse);
    } catch (error) {
      fastify.log.error(error, "[VAPI] Error in vapi-request handler");
      reply.send({
        assistant: {
          model: {
            provider: "openai",
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: "You are a helpful assistant." }],
          },
          firstMessage: "Hello, how can I help you today?",
        },
      });
    }
  });

  // Handle Vapi's 'end-of-call-report' webhook
  fastify.post("/voice/vapi-end-report", async (req, reply) => {
    try {
      const payload = req.body as VapiEndReport;
      const { summary, transcript, recordingUrl } = payload.message;
      const customerNumber: string =
        typeof payload.message?.customer?.number === "string"
          ? payload.message.customer.number
          : "unknown";

      const activity = `
                Call Summary: ${summary}
                Transcript: ${transcript}
                Recording: ${recordingUrl}
            `.trim();

      fastify.log.info(`[VAPI] Call ended for ${customerNumber}. Activity: ${activity}`);

      reply.status(200).send();
    } catch (error) {
      fastify.log.error(error, "[VAPI] Error in vapi-end-report handler");
      reply.status(500).send();
    }
  });
};

export default voiceRoutes;
