export type ConnectionStatus =
    | "idle"
    | "connecting"
    | "waiting_for_peer"
    | "peer_joined"
    | "p2p_connected"
    | "transferring"
    | "reconnecting"
    | "done"
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

export interface TransferMeta {
    id: string
    fileName: string
    fileSize: number
    fileType: string
    totalChunks: number
    isLastInQueue: boolean
}

export type QueueItemStatus = "queued" | "sending" | "done" | "error"

export interface QueueItem {
    id: string
    fileName: string
    fileSize: number
    fileType: string
    status: QueueItemStatus
}

export interface PeerContextValue {
    status: ConnectionStatus
    roomCode: string
    role: PeerRole
    progress: number
    speed: number
    isPaused: boolean
    currentFileName: string | null
    queue: QueueItem[]
    createRoom: () => void
    joinRoom: (code: string) => void
    queueFiles: (files: File[]) => void
    pauseTransfer: () => void
    resumeTransfer: () => void
}
