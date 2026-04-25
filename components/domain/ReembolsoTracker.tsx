"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReembolsosResumo } from "@/lib/grandes-despesas/reembolsos";
import { formatData, formatEuros, formatMesAno } from "@/lib/utils";
import { useState } from "react";

type Filtro = "A_TRATAR" | "TRATADOS" | "TODOS";

interface Props {
  condominioId: string;
  grandeDespesaId: string;
  resumo: ReembolsosResumo;
}

/**
 * UI: lista de imputações ANULADAS, com filtro [A tratar | Tratados | Todos]
 * + barra de progresso + botão "Marcar reembolso como tratado".
 *
 * SPEC §7 mockup "Reembolsos a tratar" + Feature 16e.
 */
export function ReembolsoTracker({ condominioId, grandeDespesaId, resumo }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("A_TRATAR");

  const itens = resumo.itens.filter((i) => {
    if (filtro === "A_TRATAR") return i.reembolsadaEm === null;
    if (filtro === "TRATADOS") return i.reembolsadaEm !== null;
    return true;
  });

  const action = `/api/condominios/${condominioId}/grandes-despesas/${grandeDespesaId}/reembolsos`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reembolsos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Total a reembolsar" value={resumo.totalCents} />
            <Stat
              label="Já tratados"
              value={resumo.tratadosCents}
              suffix={`(${resumo.pctConcluido}%)`}
              color="text-green-600"
            />
            <Stat label="Pendentes" value={resumo.pendentesCents} color="text-orange-600" />
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${resumo.pctConcluido}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 text-sm">
        <FiltroBtn ativo={filtro === "A_TRATAR"} onClick={() => setFiltro("A_TRATAR")}>
          A tratar ({resumo.itens.filter((i) => !i.reembolsadaEm).length})
        </FiltroBtn>
        <FiltroBtn ativo={filtro === "TRATADOS"} onClick={() => setFiltro("TRATADOS")}>
          Tratados ({resumo.itens.filter((i) => i.reembolsadaEm).length})
        </FiltroBtn>
        <FiltroBtn ativo={filtro === "TODOS"} onClick={() => setFiltro("TODOS")}>
          Todos ({resumo.itens.length})
        </FiltroBtn>
      </div>

      <div className="space-y-2">
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Sem entradas neste filtro.
          </p>
        )}
        {itens.map((it) => (
          <Card key={it.imputacaoId}>
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium">
                  {it.moradorNome} — {it.fracaoIdentificador}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatMesAno(it.mes, it.ano)} · {formatEuros(it.valorCents)}
                </p>
                {it.reembolsadaEm && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ Tratado em {formatData(it.reembolsadaEm)}
                    {it.reembolsadaNotas ? ` — ${it.reembolsadaNotas}` : ""}
                  </p>
                )}
              </div>
              {!it.reembolsadaEm && (
                <MarcarTratadoDialog imputacaoId={it.imputacaoId} action={action} />
              )}
              {it.reembolsadaEm && <Badge variant="success">Tratado</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${color ?? ""}`}>
        {formatEuros(value)}
        {suffix ? ` ${suffix}` : ""}
      </p>
    </div>
  );
}

function FiltroBtn({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md border ${
        ativo ? "bg-primary text-primary-foreground" : "hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function MarcarTratadoDialog({
  imputacaoId,
  action,
}: {
  imputacaoId: string;
  action: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Marcar reembolso como tratado</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar reembolso como tratado</DialogTitle>
        </DialogHeader>
        <form action={action} method="post" className="space-y-3">
          <input type="hidden" name="imputacaoId" value={imputacaoId} />
          <div className="space-y-2">
            <Label htmlFor="notas">Nota / referência (opcional)</Label>
            <Input id="notas" name="notas" placeholder="Ex: transferência ref. MBWY-12345" />
          </div>
          <Button type="submit" className="w-full">
            Confirmar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
