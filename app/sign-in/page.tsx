import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, setSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect("/");

  async function signInDev(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const nome = String(formData.get("nome") ?? "").trim();
    if (!email) throw new Error("Email é obrigatório");

    const user = await prisma.user.upsert({
      where: { email },
      update: nome ? { nome } : {},
      create: { email, nome: nome || email.split("@")[0] },
    });
    await setSession(user.id);
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-md p-6 mt-16">
      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Em desenvolvimento, basta indicar email e nome — não é enviado magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInDev} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="exemplo@email.pt" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome (se for primeira vez)</Label>
              <Input id="nome" name="nome" placeholder="O seu nome completo" />
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
