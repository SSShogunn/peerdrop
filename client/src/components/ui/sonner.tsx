import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/context/useTheme";

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "!rounded-md !border-border !bg-popover !text-popover-foreground !text-sm",
        },
      }}
      {...props}
    />
  );
}
