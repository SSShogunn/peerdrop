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
import { formatBytes } from "@/lib/file";
import { FileRow } from "@/components/FileRow";

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
              <FileRow
                key={file.id}
                fileName={file.fileName}
                fileSize={file.fileSize}
                fileType={file.fileType}
                previewDataUrl={file.previewDataUrl}
              />
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
