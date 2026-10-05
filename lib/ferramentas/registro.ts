import { Gauge, type LucideIcon } from "lucide-react";

export interface Ferramenta {
  href: string;
  nome: string;
  descricao: string;
  icone: LucideIcon;
}

/** Cada nova ferramenta é uma rota em app/ferramentas/<slug>/ + uma entrada aqui. */
export const FERRAMENTAS: Ferramenta[] = [
  {
    href: "/ferramentas/indice-complexidade",
    nome: "Índice de Complexidade",
    descricao:
      "Avalie a complexidade do cliente em 7 dimensões e veja o consultor sugerido e o multiplicador de remuneração.",
    icone: Gauge,
  },
];
