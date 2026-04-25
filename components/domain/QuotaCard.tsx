"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoQuota } from "@/lib/constants";
import type { QuotaDoMes } from "@/lib/quotas/minhas-contas";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { DerramaBreakdownModal } from "./DerramaBreakdownModal";

interface Props {
  condominioId: string;
  quota: QuotaDoMes | null;
  mesRef: number;
  anoRef: number;
}

/**
 * UI adaptativa em função de extras.length:
 * - 0 extras: só base
 * - 1 extra: linha nomeada laranja, clicável -> detalhe da grande despesa
 * - ≥ 2 extras: 1 linha consolidada, tappable -> abre DerramaBreakdownModal
 *
 * SPEC §4 Feature 3 + §7 mockups variantes 1/2/3.
 */
export function QuotaCard({ condominioId, quota, mesRef, anoRef }: Props) {
  if (!quota) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quota deste mês — {formatMesAno(mesRef, anoRef)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quota de {formatMesAno(mesRef, anoRef)} ainda não está disponível. Volte amanhã ou
            contacte o administrador.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { extras, valorBaseCents, valorTotalCents, estado, mes, ano } = quota;
  const extrasTotal = valorTotalCents - valorBaseCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quota deste mês — {formatMesAno(mes, ano)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 space-y-2 font-mono text-sm">
          <Linha label="Base" valor={valorBaseCents} />

          {extras.length === 1 && (
            <Link
              href={`/${condominioId}/admin/grandes-despesas/${extras[0].grandeDespesaId}`}
              className="flex justify-between text-orange-600 dark:text-orange-400 hover:underline"
            >
              <span>+ {extras[0].titulo}</span>
              <span>{formatEuros(extras[0].valorCents)}</span>
            </Link>
          )}

          {extras.length >= 2 && (
            <DerramaBreakdownModal
              condominioId={condominioId}
              mes={mes}
              ano={ano}
              base={valorBaseCents}
              extras={extras}
              trigger={
                <button
                  type="button"
                  className="w-full flex justify-between items-center text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                >
                  <span>+ Extras ({extras.length} derramas)</span>
                  <span className="flex items-center gap-1">
                    {formatEuros(extrasTotal)}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              }
            />
          )}

          <div className="border-t pt-2">
            <Linha label="Total a pagar" valor={valorTotalCents} bold />
          </div>
        </div>

        {extras.length === 1 && (
          <p className="text-xs text-muted-foreground">
            Prestação {extras[0].prestacaoActual} de {extras[0].prestacoesTotal}
            {extras[0].reuniaoData ? ` — Reunião de ${formatData(extras[0].reuniaoData)}` : ""}
          </p>
        )}

        {quota.corrigidaEm && (
          <p className="text-xs text-orange-600 dark:text-orange-400">
            Esta quota foi corrigida em {formatData(quota.corrigidaEm)}
            {quota.correcaoMotivo ? ` — ${quota.correcaoMotivo}` : ""}.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <EstadoBadge estado={estado} pagaEm={quota.pagaEm} />
          {estado !== EstadoQuota.PAGA && (
            <form action={`/api/quotas/${quota.quotaId}/pagar`} method="post">
              <Button type="submit">Marcar como pago</Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({
  label,
  valor,
  bold,
}: {
  label: string;
  valor: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{formatEuros(valor)}</span>
    </div>
  );
}

function EstadoBadge({ estado, pagaEm }: { estado: string; pagaEm: Date | null }) {
  if (estado === EstadoQuota.PAGA) {
    return <Badge variant="success">✓ Paga{pagaEm ? ` em ${formatData(pagaEm)}` : ""}</Badge>;
  }
  if (estado === EstadoQuota.EM_ATRASO) {
    return <Badge variant="destructive">Em atraso</Badge>;
  }
  return <Badge variant="secondary">⏳ Pendente</Badge>;
}
