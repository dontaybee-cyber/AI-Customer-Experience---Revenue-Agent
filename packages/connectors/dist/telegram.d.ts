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
export declare function escapeMarkdownV2(text: string): string;
export declare class TelegramConnector {
    private readonly config;
    constructor(config: {
        botToken: string;
        adminChatId?: string;
    });
    static fromEnv(): TelegramConnector;
    sendMessage(input: {
        chatId: string | number;
        text: string;
        parseMode?: "MarkdownV2" | "HTML";
        replyMarkup?: TelegramInlineKeyboardMarkup;
        disableWebPagePreview?: boolean;
    }): Promise<TelegramSendMessageResponse>;
    /**
     * Sends an admin alert to TELEGRAM_ADMIN_CHAT_ID.
     * Includes inline action buttons:
     * - View Context
     * - Escalate to Human
     * - Approve Sales Pivot
     */
    sendAdminAlert(input: {
        customerId: string;
        customerName?: string;
        churnRisk: number;
        sentimentEma?: number;
        channel?: string;
        textPreviewRedacted?: string;
        viewContextUrl?: string;
    }): Promise<TelegramSendMessageResponse>;
}
//# sourceMappingURL=telegram.d.ts.map