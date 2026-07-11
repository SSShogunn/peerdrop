import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <header className="flex w-full items-center justify-between px-4 py-4 sm:px-6">
      <Logo />
      <ThemeToggle />
    </header>
  );
}
