/**
 * Telegram Bot API connector (MVP)
 * - TelegramConnector class
 * - sendMessage with MarkdownV2 + Inline Keyboard Buttons
 * - sendAdminAlert to TELEGRAM_ADMIN_CHAT_ID
 *
 * SOC2 note:
 * - Do not include raw phone numbers/emails in alert text. Prefer redacted text + internal customerId.
 */

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
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

interface SendMessageBody {
  chat_id: string | number;
  text: string;
  parse_mode: "MarkdownV2" | "HTML";
  disable_web_page_preview: boolean;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export class TelegramConnector {
  constructor(
    private readonly config: {
      botToken: string;
      adminChatId?: string;
    }
  ) {}

  static fromEnv(): TelegramConnector {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");
    return new TelegramConnector({
      botToken,
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID
    });
  }

  async sendMessage(input: {
    chatId: string | number;
    text: string;
    parseMode?: "MarkdownV2" | "HTML";
    replyMarkup?: TelegramInlineKeyboardMarkup;
    disableWebPagePreview?: boolean;
  }): Promise<TelegramSendMessageResponse> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    const body: SendMessageBody = {
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

  /**
   * Executive Standard: Strict Typing for Admin Alerts
   */
  async sendAdminAlert(data: {
    customerId: string;
    customerName: string;
    churnRisk: number;
    sentimentEma: number;
    channel: string;
    textPreviewRedacted: string;
  }): Promise<void> {
    const message = `
⚠️ *Escalation Alert*
*Customer:* ${escapeMarkdownV2(data.customerName)} (${escapeMarkdownV2(data.customerId)})
*Channel:* ${escapeMarkdownV2(data.channel)}
*Churn Risk:* ${(data.churnRisk * 100).toFixed(1)}%
*Sentiment:* ${data.sentimentEma.toFixed(2)}
*Preview:* _${escapeMarkdownV2(data.textPreviewRedacted)}_
    `.trim();

    await this.sendMessage({
      chatId: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
      text: message,
      parseMode: "MarkdownV2"
    });
  }
}
