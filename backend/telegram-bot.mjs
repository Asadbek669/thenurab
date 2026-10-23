import { setTimeout as delay } from 'node:timers/promises';

async function telegramRequest(token, method, payload, signal) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Telegram ${method} returned a non-JSON response (${response.status}).`);
  }
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram ${method} failed (${response.status}): ${result.description || 'unknown error'}`);
  }
  return result.result;
}

export function createTelegramClient(token, chatId) {
  if (!token) return null;

  return {
    async verifyConfiguration() {
      const bot = await telegramRequest(token, 'getMe', {});
      if (!bot.is_bot) throw new Error('TELEGRAM_BOT_TOKEN bot hisobiga tegishli emas.');
      if (chatId) {
        const member = await telegramRequest(token, 'getChatMember', { chat_id: chatId, user_id: bot.id });
        if (member.status === 'left' || member.status === 'kicked') {
          throw new Error('Bot buyurtmalar guruhiga qo‘shilmagan.');
        }
        if (member.status === 'restricted' && !member.can_send_messages) {
          throw new Error('Botga buyurtmalar guruhida xabar yuborish ruxsati berilmagan.');
        }
      }
      return bot;
    },

    async sendWebApp(chatId, firstName = '') {
      const name = firstName.trim();
      const storefrontUrl = (process.env.TELEGRAM_WEBAPP_URL || 'https://asadbek669.github.io/thenurab/').replace(/\/+$/, '/');
      const text = name
        ? `Assalomu alaykum, ${name}! THENURAB do‘konini ochish uchun tugmani bosing.`
        : 'THENURAB do‘konini ochish uchun tugmani bosing.';
      return telegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: 'THENURAB do‘konini ochish', web_app: { url: storefrontUrl } }]],
        },
      });
    },

    async sendOrder(order, user, items) {
      if (!chatId) throw new Error('Telegram buyurtmalar guruhi sozlanmagan.');
      const lines = [
        `<b>Yangi buyurtma #${escapeHtml(order.id.slice(-6))}</b>`,
        `<b>Ism:</b> ${escapeHtml(user.name)}`,
        `<b>Telegram ID:</b> <code>${escapeHtml(user.telegram_id)}</code>`,
        `<b>Telegram:</b> ${user.telegram_username ? `@${escapeHtml(user.telegram_username)}` : 'username yo‘q'}`,
        `<b>Telefon:</b> ${escapeHtml(order.phone)}`,
        `<b>Manzil:</b> ${escapeHtml(order.delivery_address)}`,
        '',
        '<b>Mahsulotlar:</b>',
        ...items.map((item, index) => `${index + 1}. ${escapeHtml(item.title)} × ${item.quantity}${item.size ? ` · o‘lcham: ${escapeHtml(item.size)}` : ''}${item.color ? ` · rang: ${escapeHtml(item.color)}` : ''} — ${Number(item.line_total).toLocaleString('uz-UZ')} so‘m`),
        '',
        `<b>Jami:</b> ${Number(order.total_price).toLocaleString('uz-UZ')} so‘m`,
        `<b>Sana:</b> ${escapeHtml(order.created)}`,
      ];
      return telegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    },

    async startPolling({ signal, onError = console.error } = {}) {
      const controller = new AbortController();
      signal?.addEventListener('abort', () => controller.abort(), { once: true });
      let offset = 0;
      let retryDelay = 1000;

      try {
        await telegramRequest(token, 'deleteWebhook', { drop_pending_updates: false }, controller.signal);
        await telegramRequest(token, 'setMyCommands', {
          commands: [{ command: 'start', description: 'Do‘konni ochish' }],
        }, controller.signal);
        onError('THENURAB Telegram bot polling boshlandi.');

        while (!controller.signal.aborted) {
          try {
            const updates = await telegramRequest(token, 'getUpdates', {
              offset,
              timeout: 30,
              allowed_updates: ['message'],
            }, controller.signal);
            retryDelay = 1000;
            for (const update of updates) {
              offset = Math.max(offset, update.update_id + 1);
              const message = update.message;
              if (message?.text?.trim().split(/\s+/, 1)[0].split('@', 1)[0] === '/start' && message.chat?.id) {
                await this.sendWebApp(message.chat.id, message.from?.first_name || '');
              }
            }
          } catch (error) {
            if (controller.signal.aborted || error.name === 'AbortError') break;
            onError(`Telegram bot so‘rovi bajarilmadi; ${retryDelay / 1000}s dan keyin qayta uriniladi: ${error.message}`);
            await delay(retryDelay, undefined, { signal: controller.signal }).catch(() => {});
            retryDelay = Math.min(retryDelay * 2, 30000);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) onError(`Telegram botni boshlashda xatolik: ${error.message}`);
      }
    },
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
