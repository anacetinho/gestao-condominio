"use client";

import { DerramaPreview, type FracaoView } from "@/components/domain/DerramaPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModoRateio } from "@/lib/constants";
import { useState } from "react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  fracoes: FracaoView[];
}

export function NovaGrandeDespesaForm({ action, fracoes }: Props) {
  const proxMes = new Date();
  proxMes.setUTCMonth(proxMes.getUTCMonth() + 1);
  const [valor, setValor] = useState(0);
  const [numeroMeses, setNumeroMeses] = useState(4);
  const [mesInicial, setMesInicial] = useState(proxMes.getUTCMonth() + 1);
  const [anoInicial, setAnoInicial] = useState(proxMes.getUTCFullYear());
  const [modoRateio, setModoRateio] = useState<ModoRateio>(ModoRateio.IGUAL);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes da proposta</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" placeholder="Ex: Reparação do telhado" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <textarea
              id="descricao"
              name="descricao"
              rows={3}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="valor">Valor total (€)</Label>
              <Input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0"
                required
                value={valor || ""}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="numeroMeses">Diluir em (meses)</Label>
              <Input
                id="numeroMeses"
                name="numeroMeses"
                type="number"
                min={1}
                max={24}
                required
                value={numeroMeses}
                onChange={(e) => setNumeroMeses(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="modoRateio">Rateio</Label>
              <select
                id="modoRateio"
                name="modoRateio"
                value={modoRateio}
                onChange={(e) => setModoRateio(e.target.value as ModoRateio)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={ModoRateio.IGUAL}>Igual por fração</option>
                <option value={ModoRateio.PERMILAGEM}>Permilagem</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mesInicial">Mês inicial</Label>
              <Input
                id="mesInicial"
                name="mesInicial"
                type="number"
                min={1}
                max={12}
                required
                value={mesInicial}
                onChange={(e) => setMesInicial(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="anoInicial">Ano inicial</Label>
              <Input
                id="anoInicial"
                name="anoInicial"
                type="number"
                required
                value={anoInicial}
                onChange={(e) => setAnoInicial(Number(e.target.value))}
              />
            </div>
          </div>

          <DerramaPreview
            valorTotalCents={Math.round(valor * 100)}
            numeroMeses={numeroMeses}
            mesInicial={mesInicial}
            anoInicial={anoInicial}
            modoRateio={modoRateio}
            fracoes={fracoes}
          />

          <Button type="submit">Gravar como rascunho</Button>
        </form>
      </CardContent>
    </Card>
  );
}
