/**
 * Telegram Bot API connector (MVP)
 * - sendMessage with MarkdownV2 + Inline Keyboard Buttons
 *
 * Docs:
 * - https://core.telegram.org/bots/api#sendmessage
 * - https://core.telegram.org/bots/api#inlinekeyboardmarkup
 * - https://core.telegram.org/bots/api#markdownv2-style
 */

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramSendMessageInput {
  botToken: string;
  chatId: string | number;
  text: string;
  parseMode?: "MarkdownV2" | "HTML";
  replyMarkup?: TelegramInlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}

export interface TelegramSendMessageResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

export function escapeMarkdownV2(text: string): string {
  // Escape Telegram MarkdownV2 reserved characters:
  // _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export async function sendMessage(input: TelegramSendMessageInput): Promise<TelegramSendMessageResponse> {
  const url = `https://api.telegram.org/bot${input.botToken}/sendMessage`;

  const body: any = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: input.parseMode ?? "MarkdownV2",
    disable_web_page_preview: input.disableWebPagePreview ?? true
  };

  if (input.replyMarkup) body.reply_markup = input.replyMarkup;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = (await res.json()) as TelegramSendMessageResponse;
  if (!res.ok) {
    return {
      ok: false,
      description: json.description ?? `HTTP ${res.status}`
    };
  }
  return json;
}
