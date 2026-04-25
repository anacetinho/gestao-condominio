"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ExtraDoMes } from "@/lib/quotas/minhas-contas";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import Link from "next/link";

interface Props {
  condominioId: string;
  mes: number;
  ano: number;
  base: number;
  extras: ExtraDoMes[];
  trigger: React.ReactNode;
}

export function DerramaBreakdownModal({ condominioId, mes, ano, base, extras, trigger }: Props) {
  const totalExtras = extras.reduce((s, e) => s + e.valorCents, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extras de {formatMesAno(mes, ano)}</DialogTitle>
          <DialogDescription>
            Tem {extras.length} derrama{extras.length === 1 ? "" : "s"} activa
            {extras.length === 1 ? "" : "s"} este mês:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {extras.map((e) => (
            <div key={e.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.titulo}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatEuros(e.valorCents)} · prestação {e.prestacaoActual} de{" "}
                    {e.prestacoesTotal}
                  </p>
                  {e.reuniaoData && (
                    <p className="text-xs text-muted-foreground">
                      Aprovada em reunião de {formatData(e.reuniaoData)}
                    </p>
                  )}
                </div>
              </div>
              <Button asChild variant="link" size="sm" className="px-0 h-auto">
                <Link href={`/${condominioId}/admin/grandes-despesas/${e.grandeDespesaId}`}>
                  Ver detalhe →
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Total dos extras:</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {formatEuros(totalExtras)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>+ Base</span>
            <span>{formatEuros(base)}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1">
            <span>Quota total {formatMesAno(mes, ano)}:</span>
            <span>{formatEuros(base + totalExtras)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
