import { createFileRoute } from "@tanstack/react-router";
import {
  handleWhapiWebhook,
  whapiCorsHeaders,
} from "@/lib/whapi-webhook.server";

/**
 * Webhook do Whapi.Cloud (WhatsApp) — caminho exato.
 *
 * O Whapi normalmente ANEXA o nome do evento como subcaminho (ex.:
 * `/api/public/whapi/messages`), capturado pela rota splat
 * `src/routes/api/public/whapi.$.ts`. Esta rota cobre o caso do caminho
 * exato. Toda a lógica vive em `@/lib/whapi-webhook.server`.
 *
 * Configuração no painel do Whapi (Channel → Settings → Webhooks):
 *   URL:    POST https://reembolso-inteligente.lovable.app/api/public/whapi?token=<SEU_TOKEN>
 *   Events: marque "messages"; Mode: "body".
 */
export const Route = createFileRoute("/api/public/whapi")({
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
