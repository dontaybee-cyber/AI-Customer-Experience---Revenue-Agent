export interface Message {
  id: string;
  channel: string;
  identity: string;
  content: string;
  timestamp: number;
  conversationId: string;
}
