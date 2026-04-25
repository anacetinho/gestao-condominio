import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { listMembershipsForUser } from "@/lib/tenancy";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const memberships = await listMembershipsForUser(session.userId);

  if (memberships.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-6">
        <h1 className="text-2xl font-bold">Bem-vindo, {session.nome}</h1>
        <p className="text-muted-foreground">Ainda não pertence a nenhum condomínio.</p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/criar-condominio">Criar condomínio novo</Link>
          </Button>
          <form action="/api/sign-out" method="post">
            <Button variant="outline" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (memberships.length === 1) {
    redirect(`/${memberships[0].condominioId}/dashboard`);
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Olá, {session.nome}</h1>
      <p className="text-muted-foreground">Escolha um condomínio:</p>
      <div className="space-y-3">
        {memberships.map((m) => (
          <Link key={m.id} href={`/${m.condominioId}/dashboard`}>
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{m.condominio.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {m.condominio.morada} · {m.role === "ADMINISTRADOR" ? "Administrador" : "Morador"}
                  {m.fracao ? ` · Fração ${m.fracao.identificador}` : ""}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Button asChild variant="outline">
        <Link href="/criar-condominio">Criar outro condomínio</Link>
      </Button>
    </main>
  );
}
