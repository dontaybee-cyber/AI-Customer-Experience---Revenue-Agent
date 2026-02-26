
import { SupabaseContinuityStore } from "../src/supabaseStore.js";

async function main() {
  console.log('Starting re-indexing process...');
  const store = new SupabaseContinuityStore();

  const messagesToReindex = await store.getMessagesWithoutEmbeddings();
  console.log(`Found ${messagesToReindex.length} messages to re-index.`);

  for (const message of messagesToReindex) {
    try {
      console.log(`Generating embedding for message: ${message.id}`);
      const embedding = await store.generateEmbeddingForText(
        message.contentRedacted
      );
      
      await store.saveEmbedding(
        message.id,
        message.customerId,
        message.conversationId,
        message.contentRedacted,
        embedding
      );
      console.log(`Successfully re-indexed message: ${message.id}`);
    } catch (error) {
      console.error(`Failed to re-index message ${message.id}:`, error);
    }
  }

  console.log('Re-indexing process finished.');
}

main().catch(console.error);
