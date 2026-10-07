import type { Post, FavoriteMap } from "./model";

export const validUF = (value: string) => "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ").includes(value);
export type Address = { rua?: string; bairro?: string; municipio?: string; uf?: string };
export type Locations = { user: Address[]; organizations: Record<number, Address[]> };
export type Consumption = { post: number; organization: number; category: number; kind: "image" | "profile"; at: number };
const normalize = (value?: string) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const same = (a?: string, b?: string) => Boolean(normalize(a)) && normalize(a) === normalize(b);
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
export function cleanHistory(raw: unknown, now = Date.now()): Consumption[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Consumption => item && Number.isSafeInteger(item.post) && item.post > 0 && Number.isSafeInteger(item.organization) && item.organization > 0 && Number.isSafeInteger(item.category) && item.category > 0 && ["image", "profile"].includes(item.kind) && Number.isFinite(item.at) && item.at <= now && item.at > now - MAX_AGE).slice(-200);
}
export function addConsumption(history: Consumption[], post: Post, kind: Consumption["kind"], now = Date.now()) {
  return cleanHistory([...history.filter(item => item.post !== post.id_post || item.kind !== kind), {post: post.id_post, organization: post.id_organizacao, category: post.id_categoria, kind, at: now}], now);
}
// A street or neighborhood is comparable only within the same city AND state.
export function proximity(user: Address[], business: Address[]): number {
  if (!user.length || !business.length) return 5;
  let result = 5;
  for (const a of user) for (const b of business) {
    if (!normalize(a.uf) || !normalize(b.uf)) continue;
    let rank = 4;
    if (same(a.uf, b.uf)) {
      rank = 3;
      if (same(a.municipio, b.municipio)) {
        rank = 2;
        if (same(a.bairro, b.bairro)) {
          rank = 1;
          if (same(a.rua, b.rua)) rank = 0;
        }
      }
    }
    result = Math.min(result, rank);
  }
  return result;
}
export const proximityLabels = ["Na sua rua", "No seu bairro", "Na sua cidade", "No seu estado", "Outras regiões", "Localização indisponível"];
export function recommendations(posts: Post[], likes: Set<number>, favorites: FavoriteMap, history: Consumption[], locations: Locations, personalized = true, now = Date.now()) {
  const orgs = new Map<number, number>();
  const cats = new Map<number, number>();
  const add = (map: Map<number, number>, id: number, amount: number) => map.set(id, (map.get(id) ?? 0) + amount);
  for (const [id, entry] of Object.entries(favorites)) if (entry.favoritado) add(orgs, Number(id), 5);
  for (const post of posts) if (likes.has(Number(post.id_post))) { add(orgs, post.id_organizacao, 3); add(cats, post.id_categoria, 3); }
  for (const event of cleanHistory(history, now)) {
    const weight = (event.kind === "profile" ? 2 : 1) * Math.max(0.1, 1 - (now - event.at) / MAX_AGE);
    add(orgs, event.organization, weight); add(cats, event.category, weight);
  }
  const hasInterests = orgs.size > 0 || cats.size > 0;
  const score = (post: Post) => (orgs.get(Number(post.id_organizacao)) ?? 0) + (cats.get(Number(post.id_categoria)) ?? 0);
  const data = posts.filter(post => !personalized || !hasInterests || score(post) > 0).slice().sort((a,b) => proximity(locations.user, locations.organizations[a.id_organizacao] ?? []) - proximity(locations.user, locations.organizations[b.id_organizacao] ?? []) || score(b) - score(a) || Number(b.id_post) - Number(a.id_post));
  return { posts: data, hasInterests };
}

// Only query the authenticated user's address and businesses present in this feed.
// Four workers cap concurrency; absent addresses never prevent the feed from loading.
export async function loadLocations(userId: number, posts: Post[], request: (personId: number) => Promise<Address[]>, active: () => boolean = () => true): Promise<Locations> {
  const ids = [...new Set([userId, ...posts.map(p => p.id_pessoa_organizacao ?? 0)].filter(id => id > 0))];
  const byPerson = new Map<number, Address[]>(); let cursor = 0;
  await Promise.all(Array.from({length: Math.min(4, ids.length)}, async () => {
    while (active() && cursor < ids.length) {
      const id = ids[cursor++];
      try { byPerson.set(id, await request(id)); } catch { byPerson.set(id, []); }
    }
  }));
  const organizations: Record<number, Address[]> = {};
  for (const post of posts) organizations[post.id_organizacao] = byPerson.get(post.id_pessoa_organizacao ?? 0) ?? [];
  return {user: byPerson.get(userId) ?? [], organizations};
}
