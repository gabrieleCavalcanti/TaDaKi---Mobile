export type DashboardData = {
  mes: string;
  id_organizacao: number;
  pessoas_curtiram: number;
  curtidas_mes: number;
  pessoas_favoritaram_total: number;
  novos_favoritos_mes: number;
  favoritos_sem_data: number;
  post_mais_curtido: {
    id_post: number;
    titulo: string;
    vincularImagem?: string;
    status?: string;
    curtidas: number;
  } | null;
};
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
export function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}
export function dashboardPayload(raw: unknown, month: string): DashboardData {
  const data = (raw as { dashboard?: DashboardData })?.dashboard;
  if (
    !data ||
    data.mes !== month ||
    !Number.isSafeInteger(data.id_organizacao) ||
    data.id_organizacao < 1
  )
    throw new Error("O servidor retornou um dashboard inválido.");
  for (const key of [
    "pessoas_curtiram",
    "curtidas_mes",
    "pessoas_favoritaram_total",
    "novos_favoritos_mes",
    "favoritos_sem_data",
  ] as const)
    if (!Number.isSafeInteger(data[key]) || data[key] < 0)
      throw new Error("O servidor retornou métricas inválidas.");
  if (
    data.post_mais_curtido !== null &&
    (!data.post_mais_curtido ||
      typeof data.post_mais_curtido.titulo !== "string" ||
      !Number.isSafeInteger(data.post_mais_curtido.id_post) ||
      data.post_mais_curtido.id_post < 1 ||
      !Number.isSafeInteger(data.post_mais_curtido.curtidas) ||
      data.post_mais_curtido.curtidas < 1)
  )
    throw new Error("O servidor retornou uma publicação inválida.");
  return data;
}
