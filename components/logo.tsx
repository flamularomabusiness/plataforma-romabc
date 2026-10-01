import Image from "next/image";

import { cn } from "@/lib/utils";

const ASPECTO = 1956 / 804;

/**
 * O logo tem texto escuro ("ROMABC") sobre fundo transparente — em `chip`,
 * um fundo branco fixo garante contraste mesmo em superfícies que viram
 * escuras no modo dark (sidebar), já que o logo em si não se adapta a tema.
 */
export function Logo({
  width,
  chip = false,
  className,
  priority = false,
}: {
  width: number;
  chip?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const altura = Math.round(width / ASPECTO);
  const imagem = (
    <Image src="/romabc-one-logo.webp" alt="ROMABC ONE" width={width} height={altura} priority={priority} />
  );

  if (!chip) {
    return <div className={className}>{imagem}</div>;
  }

  return (
    <div className={cn("inline-flex w-fit rounded-md bg-white p-1.5 shadow-sm", className)}>{imagem}</div>
  );
}
