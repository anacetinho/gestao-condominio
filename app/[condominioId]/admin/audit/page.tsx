import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { getMembership, isAdmin } from "@/lib/tenancy";
import { formatDataHora } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ condominioId: string }>;
}) {
  const session = await requireSession();
  const { condominioId } = await params;
  const ctx = await getMembership(session.userId, condominioId);
  if (!ctx) notFound();
  if (!isAdmin(ctx)) redirect(`/${condominioId}/dashboard`);

  const logs = await listAudit(condominioId, 200);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>

      <Card>
        <CardHeader>
          <CardTitle>Últimas {logs.length} acções</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registos ainda.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {logs.map((l) => (
                <div key={l.id} className="border-b last:border-0 py-2 flex flex-col gap-0.5">
                  <div className="flex justify-between gap-2">
                    <Badge variant="outline">{l.action}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDataHora(l.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {l.membership?.user.nome ?? "(sistema)"}
                    {l.entityType ? ` · ${l.entityType}` : ""}
                  </p>
                  {l.payload && (
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(JSON.parse(l.payload), null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
