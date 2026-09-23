import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AIMessage } from "@/types/global";
import { AnimatedStatusText } from "./AnimatedStatusText";
import { MarkdownContent } from "./MarkdownContent";
import {
  extractThinkContent,
  looksLikeStructuredJsonOutput,
  tryParseStructuredOutput,
} from "./structuredOutput";
import type { ParsedStructuredOutput } from "./types";

export function AssistantResponse({
  message,
  loading,
  onEarlyParse,
}: {
  message: AIMessage;
  loading: boolean;
  onEarlyParse?: (parsed: ParsedStructuredOutput) => void;
}) {
  const { t } = useTranslation();
  const contentThink = useMemo(() => extractThinkContent(message.content), [message.content]);
  const displayContent = contentThink.reasoning ? contentThink.visible : message.content;
  const [rawOpen, setRawOpen] = useState(false);
  const earlyParsedRef = useRef(false);

  if (loading && looksLikeStructuredJsonOutput(displayContent)) {
    const parsed = tryParseStructuredOutput(displayContent);
    if (parsed) {
      if (!earlyParsedRef.current && onEarlyParse) {
        earlyParsedRef.current = true;
        queueMicrotask(() => onEarlyParse(parsed));
      }
      return <MarkdownContent content={parsed.text} />;
    }

    return (
      <Collapsible
        open={rawOpen}
        onOpenChange={setRawOpen}
        className="ai-chat-reasoning"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[0.6875rem] font-medium text-primary transition hover:text-foreground"
          >
            <AnimatedStatusText label={t("ai.formattingResponse")} />
            <span className="flex items-center gap-1 text-primary">
              {rawOpen ? t("ai.collapseReasoning") : t("ai.expandReasoning")}
              {rawOpen ? (
                <MdExpandLess className="text-sm" />
              ) : (
                <MdExpandMore className="text-sm" />
              )}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-2 py-2">
            <pre className="max-h-48 overflow-auto font-mono text-[0.6875rem] leading-5 terminal-scroll whitespace-pre-wrap break-all text-muted-foreground">
              {displayContent || message.content}
            </pre>
          </div>
        </CollapsibleContent>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" />
      </Collapsible>
    );
  }

  return <MarkdownContent content={displayContent} />;
}
