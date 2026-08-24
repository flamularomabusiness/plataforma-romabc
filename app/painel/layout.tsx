import { Sidebar } from "@/components/sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 lg:p-8">{children}</main>
    </div>
  );
}
