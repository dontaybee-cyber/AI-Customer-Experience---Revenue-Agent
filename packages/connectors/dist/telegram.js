/**
 * Telegram Bot API connector (MVP)
 * - TelegramConnector class
 * - sendMessage with MarkdownV2 + Inline Keyboard Buttons
 * - sendAdminAlert to TELEGRAM_ADMIN_CHAT_ID
 *
 * SOC2 note:
 * - Do not include raw phone numbers/emails in alert text. Prefer redacted text + internal customerId.
 */
export function escapeMarkdownV2(text) {
    // Escape Telegram MarkdownV2 reserved characters:
    // _ * [ ] ( ) ~ ` > # + - = | { } . !
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
export class TelegramConnector {
    config;
    constructor(config) {
        this.config = config;
    }
    static fromEnv() {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken)
            throw new Error("Missing TELEGRAM_BOT_TOKEN");
        return new TelegramConnector({
            botToken,
            adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID
        });
    }
    async sendMessage(input) {
        const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
        const body = {
            chat_id: input.chatId,
            text: input.text,
            parse_mode: input.parseMode ?? "MarkdownV2",
            disable_web_page_preview: input.disableWebPagePreview ?? true
        };
        if (input.replyMarkup)
            body.reply_markup = input.replyMarkup;
        const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body)
        });
        const json = (await res.json());
        if (!res.ok) {
            return {
                ok: false,
                description: json.description ?? `HTTP ${res.status}`
            };
        }
        return json;
    }
    /**
     * Sends an admin alert to TELEGRAM_ADMIN_CHAT_ID.
     * Includes inline action buttons:
     * - View Context
     * - Escalate to Human
     * - Approve Sales Pivot
     */
    async sendAdminAlert(input) {
        if (!this.config.adminChatId) {
            return { ok: false, description: "Missing TELEGRAM_ADMIN_CHAT_ID" };
        }
        const name = input.customerName ? escapeMarkdownV2(input.customerName) : "Unknown";
        const customerId = escapeMarkdownV2(input.customerId);
        const lines = [
            "*Admin Alert*",
            `Customer: ${name} \\(${customerId}\\)`,
            `churn\\_risk: ${input.churnRisk.toFixed(2)}`,
            input.sentimentEma !== undefined ? `sentiment\\_ema: ${input.sentimentEma.toFixed(2)}` : undefined,
            input.channel ? `channel: ${escapeMarkdownV2(input.channel)}` : undefined,
            input.textPreviewRedacted ? `text: ${escapeMarkdownV2(input.textPreviewRedacted)}` : undefined
        ].filter(Boolean);
        const replyMarkup = {
            inline_keyboard: [
                [
                    input.viewContextUrl
                        ? { text: "View Context", url: input.viewContextUrl }
                        : { text: "View Context", callback_data: `context:${input.customerId}` }
                ],
                [
                    { text: "Escalate to Human", callback_data: `escalate:${input.customerId}` },
                    { text: "Approve Sales Pivot", callback_data: `pivot:${input.customerId}` }
                ]
            ]
        };
        return this.sendMessage({
            chatId: this.config.adminChatId,
            parseMode: "MarkdownV2",
            text: lines.join("\n"),
            replyMarkup
        });
    }
}
//# sourceMappingURL=telegram.js.map