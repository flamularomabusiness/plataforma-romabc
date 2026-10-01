import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
