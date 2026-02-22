import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";
import type {
    Channel,
    ContinuityStore,
    CustomerProfile,
    MemorySummary,
    MessageRecord,
    OpenTicket,
    SemanticMemoryHit
  } from "../../shared/src/index.js";
  import { createHash } from "crypto";

  // Abstraction for Supabase queries
export class SupabaseContinuityStore implements ContinuityStore {
    private client: SupabaseClient;
  
    constructor() {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL and Key must be provided in environment variables.");
      }
  
      this.client = createClient(supabaseUrl, supabaseKey);
    }
  
    async resolveCustomerId(input: { channel: Channel; externalUserId: string }): Promise<string | null> {
        const hash = createHash("sha256").update(input.externalUserId).digest("hex");
        const { data, error } = await this.client
          .from("customer_identities")
          .select("customer_id")
          .eq("type", input.channel)
          .eq("value_hash", hash)
          .single();
    
        if (error) {
          console.error("Error resolving customer ID:", error);
          return null;
        }
    
        return data?.customer_id ?? null;
      }

      async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
        const { data, error } = await this.client
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .single();
    
        if (error) {
            throw new Error(`Failed to fetch customer profile: ${error.message}`);
        }
    
        return data as CustomerProfile;
    }

    async getRecentMessages(input: {
        customerId: string;
        conversationId?: string;
        limit: number;
    }): Promise<MessageRecord[]> {
        let query = this.client
            .from("messages")
            .select("*")
            .eq("customer_id", input.customerId)
            .order("timestamp", { ascending: false })
            .limit(input.limit);
    
        if (input.conversationId) {
            query = query.eq("conversation_id", input.conversationId);
        }
    
        const { data, error } = await query;
    
        if (error) {
            throw new Error(`Failed to fetch recent messages: ${error.message}`);
        }
    
        return (data as MessageRecord[]).reverse(); // Reverse to maintain chronological order
    }

    async getLatestSummaries(input: { customerId: string; limit: number }): Promise<MemorySummary[]> {
        const { data, error } = await this.client
            .from("memory_summaries")
            .select("*")
            .eq("customer_id", input.customerId)
            .order("updated_at", { ascending: false })
            .limit(input.limit);

        if (error) {
            throw new Error(`Failed to fetch latest summaries: ${error.message}`);
        }

        return data as MemorySummary[];
    }

    async semanticSearch(input: {
        customerId: string;
        query: string;
        limit: number;
      }): Promise<SemanticMemoryHit[]> {
        // This requires a separate call to an embedding model.
        // We'll mock the embedding generation for now.
        const embedding = await this.generateEmbedding(input.query);

        const { data, error } = await this.client.rpc('match_embeddings', {
          customer_id: input.customerId,
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: input.limit,
        });

        if (error) {
          console.error('Error in semantic search:', error);
          return [];
        }

        return data as SemanticMemoryHit[];
      }

      /**
       * @deprecated Mock implementation. Replace with a real embedding model.
       */
      private async generateEmbedding(query: string): Promise<number[]> {
        // Mock embedding generation. In a real implementation, this would
        // call an embedding model like OpenAI's text-embedding-ada-002.
        console.warn(`[MOCK] Generating embedding for query: "${query}"`);
        // Return a randomly generated 1536-dimensional vector (size for text-embedding-ada-002)
        return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
      }


      async getOpenTickets(customerId: string): Promise<OpenTicket[]> {
        const { data, error } = await this.client
            .from("tickets")
            .select("*")
            .eq("customer_id", customerId)
            .in("status", ["open", "pending"]);

        if (error) {
            throw new Error(`Failed to fetch open tickets: ${error.message}`);
        }

        return data as OpenTicket[];
    }

    async saveEmbedding(
        messageId: string,
        customerId: string,
        conversationId: string,
        textRedacted: string,
        embedding: number[]
      ): Promise<void> {
        const { error } = await this.client.from("embeddings").insert({
          id: messageId,
          customer_id: customerId,
          conversation_id: conversationId,
          message_id: messageId,
          text_redacted: textRedacted,
          embedding: embedding,
        });
    
        if (error) {
          throw new Error(`Failed to save embedding: ${error.message}`);
        }
      }
    
      async getMessagesWithoutEmbeddings(): Promise<MessageRecord[]> {
        const { data, error } = await this.client.rpc(
          "get_messages_without_embeddings"
        );
    
        if (error) {
          throw new Error(
            `Failed to fetch messages without embeddings: ${error.message}`
          );
        }
    
        return data as MessageRecord[];
      }


    async getSentimentEma(customerId: string): Promise<number | null> {
        const { data, error } = await this.client
            .from("sentiment_emas")
            .select("sentiment_ema")
            .eq("customer_id", customerId)
            .single();

        if (error) {
            return null;
        }

        return data?.sentiment_ema ?? null;
    }

    async setSentimentEma(customerId: string, value: number): Promise<void> {
        const { error } = await this.client
            .from("sentiment_emas")
            .upsert({ customer_id: customerId, sentiment_ema: value, updated_at: new Date().toISOString() });

        if (error) {
            throw new Error(`Failed to set sentiment EMA: ${error.message}`);
        }
    }
}

