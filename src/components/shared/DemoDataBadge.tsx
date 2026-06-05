import { isUsingMockData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Database } from "lucide-react";


/**
 * Badge sutil indicando que a aplicação está usando dados de demonstração
 * (mock) por não haver um Supabase configurado. Some automaticamente quando
 * VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão presentes.
 */
export function DemoDataBadge() {
  if (!isUsingMockData) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1.5 border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
          >
            <Database className="h-3 w-3" />
            Demo data
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Dados de demonstração. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
          para conectar ao seu Supabase.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

  );
}
