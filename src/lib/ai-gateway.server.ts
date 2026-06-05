/**
 * Helper server-only para falar com o Lovable AI Gateway via AI SDK.
 * NUNCA importar em código de cliente — usa LOVABLE_API_KEY.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/** Lê a chave do ambiente do servidor ou lança erro claro. */
export function getLovableApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error(
      "LOVABLE_API_KEY ausente no servidor. A IA não está disponível no momento.",
    );
  }
  return key;
}
