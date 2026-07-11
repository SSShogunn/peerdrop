import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Copy, Loader2 } from "lucide-react"
import QRCode from "react-qr-code"
import { PeerProvider } from "./context/PeerContext"
import { usePeer } from "./context/usePeer"
import Landing from "./components/Landing"
import FileDropzone from "./components/FileDropzone"
import TransferProgress from "./components/TransferProgress"
import ReceiverPanel from "./components/ReceiverPanel"

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center px-6 py-10">
            <div className="flex w-full max-w-md flex-col gap-6">
                <h1 className="text-3xl font-bold tracking-tight text-white">
                    PeerDrop
                </h1>
                {children}
            </div>
        </div>
    )
}

function StatusMessage({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
    return (
        <p className={`flex items-center gap-2 text-sm ${tone === "error" ? "text-red-400" : "text-neutral-400"}`}>
            {children}
        </p>
    )
}

function errorCopy(reason: string | null): string {
    switch (reason) {
        case "room_not_found":
            return "That code doesn't exist — check it and try again."
        case "room_full":
            return "That room already has two people in it."
        case "room_expired":
            return "That room expired before anyone joined. Create a new one."
        case "server_busy":
            return "The server is at capacity right now. Please try again in a bit."
        case "rate_limited":
            return "Too many attempts. Wait a moment and try again."
        default:
            return "Something went wrong. Please try again."
    }
}

function RetryButton() {
    return (
        <motion.button
            onClick={() => window.location.reload()}
            whileHover={{ backgroundColor: "#e5e5e5" }}
            whileTap={{ scale: 0.97 }}
            className="w-full cursor-pointer rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
        >
            Start over
        </motion.button>
    )
}

function Spinner() {
    return (
        <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            className="flex"
        >
            <Loader2 className="h-4 w-4" strokeWidth={2} />
        </motion.span>
    )
}

function AppInner() {
    const { status, role, roomCode, joinRoom, transferError, errorReason } = usePeer()

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("room")
        if (!code) return

        window.history.replaceState({}, "", window.location.pathname)
        joinRoom(code)
    }, [joinRoom])

    if (status === "idle") {
        return <Landing />
    }

    let content: React.ReactNode

    if (status === "connecting") {
        content = (
            <StatusMessage>
                <Spinner /> Connecting...
            </StatusMessage>
        )
    } else if (status === "waiting_for_peer" && roomCode) {
        content = <WaitingForPeer />
    } else if (status === "waiting_for_peer") {
        content = (
            <StatusMessage>
                <Spinner /> Waiting for sender to start...
            </StatusMessage>
        )
    } else if (status === "peer_joined") {
        content = (
            <StatusMessage>
                <Spinner /> Peer joined. Establishing connection...
            </StatusMessage>
        )
    } else if (status === "p2p_connected") {
        content =
            role === "offerer" ? (
                <FileDropzone />
            ) : (
                <div className="flex flex-col gap-4">
                    <StatusMessage>
                        Connected. Waiting for sender to drop a file...
                    </StatusMessage>
                    <ReceiverPanel />
                </div>
            )
    } else if (status === "transferring") {
        content = (
            <div className="flex flex-col gap-6">
                {role === "offerer" ? <FileDropzone /> : <ReceiverPanel />}
                <TransferProgress />
            </div>
        )
    } else if (status === "reconnecting") {
        content = (
            <StatusMessage>
                <Spinner /> Connection dropped. Reconnecting...
            </StatusMessage>
        )
    } else if (status === "done") {
        content = (
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex flex-col gap-4"
            >
                {transferError ? (
                    <StatusMessage tone="error">{transferError}</StatusMessage>
                ) : (
                    <StatusMessage>Transfer complete.</StatusMessage>
                )}
                {role !== "offerer" && <ReceiverPanel />}
            </motion.div>
        )
    } else if (status === "error") {
        content = (
            <div className="flex flex-col gap-4">
                <StatusMessage tone="error">{errorCopy(errorReason)}</StatusMessage>
                <RetryButton />
            </div>
        )
    } else {
        content = null
    }

    return (
        <Shell>
            <AnimatePresence mode="wait">
                <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    {content}
                </motion.div>
            </AnimatePresence>
        </Shell>
    )
}

function CopyRoomLinkButton({ roomCode }: { roomCode: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <motion.button
            onClick={handleCopy}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
        >
            <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                    <motion.span
                        key="copied"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-2"
                    >
                        <Check className="h-4 w-4 text-emerald-400" /> Copied!
                    </motion.span>
                ) : (
                    <motion.span
                        key="copy"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-2"
                    >
                        <Copy className="h-4 w-4" /> Copy invite link
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    )
}

function WaitingForPeer() {
    const { roomCode } = usePeer()
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-400">
                Share this code with the receiver:
            </p>
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="rounded-2xl border border-white/10 bg-white/5 py-6 text-center text-5xl font-bold tracking-[0.5rem] text-white"
            >
                {roomCode}
            </motion.div>
            <CopyRoomLinkButton roomCode={roomCode} />
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="flex justify-center rounded-2xl border border-white/10 bg-white p-4"
            >
                <QRCode value={inviteUrl} size={160} />
            </motion.div>
            <p className="text-center text-xs text-neutral-500">
                Scan to open this room on another device
            </p>
            <StatusMessage>
                <Spinner /> Waiting for them to join...
            </StatusMessage>
        </div>
    )
}

export default function App() {
    return (
        <PeerProvider>
            <AppInner />
        </PeerProvider>
    )
}
