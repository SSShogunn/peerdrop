import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Send } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy text"
      className="-my-2 -mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4" />}
    </button>
  );
}

const MAX_TEXTAREA_HEIGHT = 120;

export default function TextShare() {
  const { messages, sendText, queueFiles } = usePeer();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    sendText(draft);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (images.length === 0) return;
    e.preventDefault();
    queueFiles(images);
  };

  return (
    <Panel title="Messages" meta={messages.length > 0 ? `${messages.length}` : undefined}>
      <div className="flex flex-col gap-3">
        {messages.length > 0 && (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.li
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "flex max-w-[88%] items-center gap-2 rounded-md px-3 py-2 text-sm",
                    msg.direction === "sent"
                      ? "self-end bg-signal-soft"
                      : "self-start border border-border bg-background",
                  )}
                >
                  <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                    <Linkified text={msg.text} />
                  </span>
                  <CopyButton text={msg.text} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              resizeTextarea(e.target);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Send a text or link"
            aria-label="Message"
            rows={1}
            maxLength={10000}
            className="min-h-11 max-h-30 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-base break-words outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"
          />
          <Button
            size="icon"
            className="size-11 shrink-0"
            disabled={!draft.trim()}
            onClick={handleSend}
            aria-label="Send text"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </Panel>
  );
}
