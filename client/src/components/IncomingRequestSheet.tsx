import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePeer } from "@/context/usePeer";
import { formatBytes, getFileIcon } from "@/lib/file";

export default function IncomingRequestSheet() {
  const { incomingRequests, acceptRequest, declineRequest } = usePeer();
  const request = incomingRequests[0];

  const totalSize = request?.files.reduce((sum, f) => sum + f.fileSize, 0) ?? 0;

  return (
    <Dialog open={!!request}>
      {request && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Incoming {request.files.length === 1 ? "file" : `${request.files.length} files`}
            </DialogTitle>
            <DialogDescription>
              {formatBytes(totalSize)} total — accept to start receiving.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {request.files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 bg-card px-3 py-2 ring-1 ring-foreground/10"
              >
                <span className="text-lg">{getFileIcon(file.fileName, file.fileType)}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{file.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.fileSize)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => declineRequest(request.batchId)}>
              Decline
            </Button>
            <Button onClick={() => acceptRequest(request.batchId)}>Accept</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
