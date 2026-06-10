import { createFileRoute } from "@tanstack/react-router";
import {
  handleWhapiWebhook,
  whapiCorsHeaders,
} from "@/lib/whapi-webhook.server";

/**
 * Webhook do Whapi.Cloud (WhatsApp) — rota SPLAT.
 *
 * O Whapi anexa o nome do evento ao final da URL configurada, então as
 * chamadas chegam como:
 *   POST .../api/public/whapi/messages
 *   POST .../api/public/whapi/chats
 *   POST .../api/public/whapi/statuses   etc.
 * Esta rota captura qualquer subcaminho (`$`). A lógica só processa o evento
 * de mensagens; os demais são aceitos com 200 e ignorados.
 */
export const Route = createFileRoute("/api/public/whapi/$")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: whapiCorsHeaders }),
      POST: async ({ request }) => handleWhapiWebhook(request),
      PATCH: async ({ request }) => handleWhapiWebhook(request),
      PUT: async ({ request }) => handleWhapiWebhook(request),
    },
  },
});
