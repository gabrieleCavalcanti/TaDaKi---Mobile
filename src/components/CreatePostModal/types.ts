export type PostOrganization = {
  id_organizacao?: number;
  nome?: string;
  username?: string;
};

export type PostCategory = {
  id_categoria: number;
  descricao: string;
};

export type CreatePostModalProps = {
  open: boolean;
  close: () => void;
  person: PostOrganization | null;
  categories: PostCategory[];
  onPublished?: () => void | Promise<void>;
  reduced?: boolean;
  /** Use se a tela quiser cuidar do envio. */
  onSubmit?: (data: FormData) => void | Promise<void>;
};
