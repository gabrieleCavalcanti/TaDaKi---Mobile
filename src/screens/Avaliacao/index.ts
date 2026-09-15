import api from "../../api/api";

export interface IAvaliacao {
    id_avaliacao: number;
    comentario: string;
    titulo: string;
    anonimo: boolean | number;
    csat: number | string;
    id_cliente: number;
    id_organizacao: number;
    nome_cliente: string;
}

export async function buscarAvaliacoes(): Promise<IAvaliacao[]> {
    try {
        const response = await api.get("/Avaliacao");
        return response.data?.resultadoSelecionaTodos || [];
    } catch (error) {
        console.error("ERRO NO buscarAvaliacoes:", error);
        throw error;
    }
}

export async function buscarAvaliacoesPorOrganizacao(idOrganizacao: number): Promise<IAvaliacao[]> {
    try {
        const avaliacoes = await buscarAvaliacoes();
        return avaliacoes.filter(
            (item) =>
                Number(item.id_organizacao) === Number(idOrganizacao)
        );
    } catch (error) {
        console.error(
            "ERRO NO buscarAvaliacoesPorOrganizacao:",
            error
        );
        throw error;
    }
}

export function calcularMediaAvaliacoes(avaliacoes: IAvaliacao[]): string {
    if (avaliacoes.length === 0) {
        return "0,0";
    }

    const soma = avaliacoes.reduce(
        (total, item) => total + Number(item.csat || 0),
        0
    );

    return (soma / avaliacoes.length)
        .toFixed(1)
        .replace(".", ",");
}
