import { requireSession } from "@/lib/auth/session";
import { ModoRateio, Role } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { criarGrandeDespesa } from "@/lib/grandes-despesas/workflow";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { notFound, redirect } from "next/navigation";
import { NovaGrandeDespesaForm } from "./form";

export default async function NovaGrandeDespesa({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const fracoes = await prisma.fracao.findMany({
    where: { condominioId },
    orderBy: { identificador: "asc" },
  });

  async function criar(formData: FormData) {
    "use server";
    const s = await requireSession();
    const c = await getMembership(s.userId, condominioId);
    if (!c || c.role !== Role.ADMINISTRADOR) throw new Error("Não autorizado");
    const titulo = String(formData.get("titulo") ?? "").trim();
    const descricao = String(formData.get("descricao") ?? "").trim();
    const valor = Number(formData.get("valor"));
    const numeroMeses = Number(formData.get("numeroMeses"));
    const mesInicial = Number(formData.get("mesInicial"));
    const anoInicial = Number(formData.get("anoInicial"));
    const modoRateio = String(formData.get("modoRateio") ?? ModoRateio.IGUAL) as
      | typeof ModoRateio.IGUAL
      | typeof ModoRateio.PERMILAGEM;
    if (!titulo || !descricao || !valor || !numeroMeses || !mesInicial || !anoInicial) {
      throw new Error("Dados inválidos");
    }
    if (numeroMeses < 1 || numeroMeses > 24) {
      throw new Error("numeroMeses tem de estar entre 1 e 24");
    }
    const gd = await criarGrandeDespesa({
      condominioId,
      membershipId: c.membershipId,
      titulo,
      descricao,
      valorTotalCents: Math.round(valor * 100),
      numeroMeses,
      mesInicial,
      anoInicial,
      modoRateio,
    });
    redirect(`/${condominioId}/admin/grandes-despesas/${gd.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova grande despesa</h1>
      <NovaGrandeDespesaForm
        action={criar}
        fracoes={fracoes.map((f) => ({
          id: f.id,
          identificador: f.identificador,
          permilagem: f.permilagem,
        }))}
      />
    </div>
  );
}
