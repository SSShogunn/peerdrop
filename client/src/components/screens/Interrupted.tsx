import { WifiSlash } from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { Panel } from "@/components/Panel";

export default function Interrupted() {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-md bg-warn-soft text-warn">
          <WifiSlash className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Connection dropped</p>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Trying to reconnect
          </p>
        </div>
      </div>
    </Panel>
  );
}
