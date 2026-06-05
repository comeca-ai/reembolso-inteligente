import { cn } from "@/lib/utils";
import { type ExpenseCategory, categoryLabels } from "@/lib/api";
import { Fuel, UtensilsCrossed, BedDouble, Car, Receipt, Package, MoreHorizontal } from "lucide-react";

const icons: Record<ExpenseCategory, typeof Fuel> = {
  combustivel: Fuel,
  refeicao: UtensilsCrossed,
  hospedagem: BedDouble,
  transporte: Car,
  pedagio: Receipt,
  material: Package,
  outros: MoreHorizontal,
};

export function CategoryBadge({ category, className }: { category: ExpenseCategory; className?: string }) {
  const Icon = icons[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-foreground", className)}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {categoryLabels[category]}
    </span>
  );
}
