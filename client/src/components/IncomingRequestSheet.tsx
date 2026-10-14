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
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 max-w-full translate-y-0 rounded-t-lg rounded-b-none border border-border p-5 text-sm sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Incoming {request.files.length === 1 ? "file" : `${request.files.length} files`}
            </DialogTitle>
            <DialogDescription>
              <span className="data">{formatBytes(totalSize)}</span> in total. Accept to start receiving.
            </DialogDescription>
          </DialogHeader>

          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
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
            <Button variant="outline" className="h-11 sm:px-5" onClick={() => declineRequest(request.batchId)}>
              Decline
            </Button>
            <Button className="h-11 sm:px-5" onClick={() => acceptRequest(request.batchId)}>
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
