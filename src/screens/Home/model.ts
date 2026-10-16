export type Person = {
  id_pessoa?: number;
  id_pessoa_login?: number;
  id_organizacao?: number;
  id_cliente?: number;
  nome?: string;
  username?: string;
  tipo?: string;
  foto?: string | null;
  foto_perfil?: string | null;
  imagem_perfil?: string | null;
  imagem?: string | null;
  avatar?: string | null;
};
export type Category = { id_categoria: number; descricao: string };
export type Post = {
  id_post: number;
  titulo: string;
  descricao?: string | null;
  vincularImagem?: string | null;
  id_categoria: number;
  id_organizacao: number;
  id_pessoa_organizacao?: number;
  nome_organizacao?: string;
  foto_organizacao?: string | null;
  descricao_categoria?: string;
};
export type Favorite = { favoritado: boolean; id_favorito?: number };
export type FavoriteMap = Record<number, Favorite>;
export function rows<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object")
    for (const key of keys) {
      const list = (value as Record<string, unknown>)[key];
      if (Array.isArray(list)) return list as T[];
    }
  return [];
}
export function photo(person?: Person | null) {
  return (
    person?.foto ??
    person?.foto_perfil ??
    person?.imagem_perfil ??
    person?.imagem ??
    person?.avatar ??
    null
  );
}
export function userType(person?: Person | null) {
  return String(person?.tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
export function enrichPosts(
  posts: Post[],
  organizations: Person[],
  categories: Category[],
): Post[] {
  const orgs = new Map(
    organizations.map((org) => [
      Number(org.id_organizacao ?? org.id_pessoa),
      org,
    ]),
  );
  const cats = new Map(
    categories.map((cat) => [Number(cat.id_categoria), cat.descricao]),
  );
  return posts
    .map((post) => {
      const org = orgs.get(Number(post.id_organizacao));
      return {
        ...post,
        id_pessoa_organizacao:
          Number(org?.id_pessoa ?? post.id_pessoa_organizacao ?? 0) ||
          undefined,
        nome_organizacao: org?.nome ?? post.nome_organizacao ?? "Microempresa",
        foto_organizacao: photo(org) ?? post.foto_organizacao,
        descricao_categoria:
          cats.get(Number(post.id_categoria)) ??
          post.descricao_categoria ??
          "Produto ou serviço",
      };
    })
    .sort((a, b) => Number(b.id_post) - Number(a.id_post));
}
export function filterPosts(
  posts: Post[],
  search: string,
  category: number,
  favoritesOnly: boolean,
  favorites: FavoriteMap,
) {
  const norm = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = norm(search.trim());
  return posts.filter(
    (post) =>
      (!category || Number(post.id_categoria) === category) &&
      (!favoritesOnly || favorites[post.id_organizacao]?.favoritado) &&
      norm(
        [
          post.titulo,
          post.descricao,
          post.nome_organizacao,
          post.descricao_categoria,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
  );
}
export function validateImage(type: string, size: number) {
  if (!["image/png", "image/jpeg"].includes(type))
    return "Escolha uma imagem PNG ou JPEG.";
  if (size > 10 * 1024 * 1024) return "A imagem deve ter no máximo 10 MB.";
  if (size <= 0) return "O arquivo está vazio. Escolha outra imagem.";
  return "";
}
