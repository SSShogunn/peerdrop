export type ConnectionStatus =
    | "idle"
    | "connecting"
    | "waiting_for_peer"
    | "peer_joined"
    | "p2p_connected"
    | "reconnecting"
    | "error"

export type SignalingMessage =
    | { type: "create_room" }
    | { type: "join_room"; code: string }
    | { type: "room_created"; code: string }
    | { type: "room_joined" }
    | { type: "peer_joined" }
    | { type: "peer_disconnected" }
    | { type: "offer"; sdp: string }
    | { type: "answer"; sdp: string }
    | { type: "ice"; candidate: RTCIceCandidateInit }
    | { type: "error"; message: string }

export type PeerRole = "offerer" | "answerer" | null

export type ConnectionType = "direct" | "relay" | null

export interface FileSummary {
    id: string
    fileName: string
    fileSize: number
    fileType: string
}

export interface TransferRequest {
    type: "request"
    batchId: string
    files: FileSummary[]
}

export interface TransferAccept {
    type: "accept"
    batchId: string
}

export interface TransferDecline {
    type: "decline"
    batchId: string
}

export interface TransferMeta {
    type: "meta"
    id: string
    fileName: string
    fileSize: number
    fileType: string
    totalChunks: number
    isLastInQueue: boolean
}

export interface TransferComplete {
    type: "complete"
    id: string
    checksum: string
}

export interface TransferAck {
    type: "ack"
    id: string
    ok: boolean
}

export interface TransferCancel {
    type: "cancel"
    id: string
}

export interface TextMessage {
    type: "text"
    id: string
    text: string
}

export type DataChannelMessage =
    | TransferRequest
    | TransferAccept
    | TransferDecline
    | TransferMeta
    | TransferComplete
    | TransferAck
    | TransferCancel
    | TextMessage

export type QueueItemStatus =
    | "pending"
    | "queued"
    | "sending"
    | "done"
    | "error"
    | "cancelled"

export interface QueueItem {
    id: string
    batchId: string
    fileName: string
    fileSize: number
    fileType: string
    status: QueueItemStatus
}

export interface ReceivedFile {
    id: string
    fileName: string
    fileSize: number
    fileType: string
    receivedAt: number
}

export interface IncomingRequest {
    batchId: string
    files: FileSummary[]
}

export interface TextEntry {
    id: string
    text: string
    direction: "sent" | "received"
    at: number
}

export interface PeerContextValue {
    status: ConnectionStatus
    roomCode: string
    role: PeerRole
    connectionType: ConnectionType
    disconnectReason: "peer_left" | null
    dismissDisconnectReason: () => void
    queue: QueueItem[]
    isPaused: boolean

    sendProgress: number
    sendSpeed: number
    sendFileName: string | null

    recvProgress: number
    recvSpeed: number
    recvFileName: string | null

    canStreamToDisk: boolean
    saveFolder: string | null
    transferError: string | null
    errorReason: string | null
    receivedFiles: ReceivedFile[]

    incomingRequests: IncomingRequest[]
    acceptRequest: (batchId: string) => void
    declineRequest: (batchId: string) => void

    messages: TextEntry[]
    sendText: (text: string) => void

    reset: () => void
    createRoom: () => void
    joinRoom: (code: string) => void
    queueFiles: (files: File[]) => void
    pauseTransfer: () => void
    resumeTransfer: () => void
    cancelTransfer: (id: string) => void
    chooseSaveFolder: () => Promise<void>
}
