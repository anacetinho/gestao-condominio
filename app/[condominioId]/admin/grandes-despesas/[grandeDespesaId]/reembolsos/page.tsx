import { ReembolsoTracker } from "@/components/domain/ReembolsoTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { listarReembolsos } from "@/lib/grandes-despesas/reembolsos";
import { getMembership, isAdmin } from "@/lib/tenancy";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ReembolsosPage({
  params,
}: {
  params: Promise<{ condominioId: string; grandeDespesaId: string }>;
}) {
  const session = await requireSession();
  const { condominioId, grandeDespesaId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const gd = await prisma.grandeDespesa.findFirst({
    where: { id: grandeDespesaId, condominioId },
  });
  if (!gd) notFound();

  const resumo = await listarReembolsos(grandeDespesaId);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${condominioId}/admin/grandes-despesas/${grandeDespesaId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {gd.titulo}
        </Link>
        <h1 className="text-2xl font-bold mt-1">Reembolsos a tratar</h1>
      </div>

      {resumo.itens.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sem reembolsos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Não há prestações já aplicadas que precisem de reembolso.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReembolsoTracker
          condominioId={condominioId}
          grandeDespesaId={grandeDespesaId}
          resumo={resumo}
        />
      )}
    </div>
  );
}
