import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSession } from "@/lib/auth/session";
import { EstadoOcorrencia } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function OcorrenciasPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();

  const ocorrencias = await prisma.ocorrencia.findMany({
    where: { condominioId },
    orderBy: { ultimoUpdate: "desc" },
  });

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c) throw new Error("Não autorizado");
    const titulo = String(formData.get("titulo") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim();
    if (!titulo || !descricao) throw new Error("Dados inválidos");
    await prisma.ocorrencia.create({
      data: {
        condominioId,
        autorMembershipId: c.membershipId,
        titulo,
        descricao,
      },
    });
    redirect(`/${condominioId}/ocorrencias`);
  }

  async function mudarEstado(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || !isAdmin(c)) throw new Error("Não autorizado");
    const id = String(formData.get("id"));
    const estado = String(formData.get("estado"));
    if (!Object.values(EstadoOcorrencia).includes(estado as never)) {
      throw new Error("Estado inválido");
    }
    await prisma.ocorrencia.update({
      where: { id },
      data: { estado, ultimoUpdate: new Date() },
    });
    redirect(`/${condominioId}/ocorrencias`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ocorrências</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nova ocorrência</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={criar} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" name="titulo" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição</Label>
              <textarea
                id="descricao"
                name="descricao"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit">Submeter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {ocorrencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ocorrências.</p>
        ) : (
          ocorrencias.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium">{o.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDataHora(o.ultimoUpdate)}
                    </p>
                  </div>
                  <Badge variant="outline">{o.estado}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap">{o.descricao}</p>
                {isAdmin(ctx) && (
                  <form action={mudarEstado} className="flex gap-2">
                    <input type="hidden" name="id" value={o.id} />
                    <select
                      name="estado"
                      defaultValue={o.estado}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {Object.values(EstadoOcorrencia).map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      Mudar estado
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
