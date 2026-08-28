export function FormLayoutGoogle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6 scroll-smooth px-4 py-10">
      {children}
    </div>
  );
}
