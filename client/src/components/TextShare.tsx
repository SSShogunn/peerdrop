import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Send } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { Button } from "@/components/ui/button";

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
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy text"
      className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
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
    <div className="flex flex-col gap-3">
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
          placeholder="Send a text or link…"
          rows={1}
          maxLength={10000}
          className="max-h-30 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm break-words outline-none ring-1 ring-foreground/10 placeholder:text-muted-foreground focus-visible:ring-ring scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/15 [&::-webkit-scrollbar-track]:bg-transparent"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={!draft.trim()}
          onClick={handleSend}
          aria-label="Send text"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {messages.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.li
                key={msg.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={
                  msg.direction === "sent"
                    ? "flex max-w-[85%] items-center gap-2 self-end bg-primary/10 px-3 py-2 text-sm"
                    : "flex max-w-[85%] items-center gap-2 self-start bg-card px-3 py-2 text-sm ring-1 ring-foreground/10"
                }
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
    </div>
  );
}
