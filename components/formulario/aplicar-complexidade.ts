import type { UseFormReturn } from "react-hook-form";

import { resumoResultado, type ResultadoComplexidade } from "@/lib/ferramentas/indice-complexidade";
import type { FormularioContratoValues } from "./form-schema";

/** Preenche Grau de Dificuldade (+ vínculo e resumo da avaliação) com o resultado da ferramenta. */
export function aplicarResultadoComplexidade(
  form: UseFormReturn<FormularioContratoValues>,
  resultado: ResultadoComplexidade
) {
  form.setValue("grau_dificuldade", resultado.grau_dificuldade, { shouldDirty: true, shouldValidate: true });
  form.setValue("avaliacao_complexidade_id", resultado.avaliacao_id, { shouldDirty: true });
  form.setValue("avaliacao_complexidade_resumo", resumoResultado(resultado), { shouldDirty: true });
}
