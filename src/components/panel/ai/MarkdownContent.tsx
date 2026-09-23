import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNodeProps = {
  children?: ReactNode;
  href?: string;
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="break-words text-xs leading-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: MarkdownNodeProps) => (
            <p className="my-2 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }: MarkdownNodeProps) => (
            <ul className="my-2 list-disc pl-5">{children}</ul>
          ),
          ol: ({ children }: MarkdownNodeProps) => (
            <ol className="my-2 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }: MarkdownNodeProps) => <li className="my-0.5">{children}</li>,
          a: ({ children, href }: MarkdownNodeProps) => (
            <a
              className="text-primary underline underline-offset-2"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }: MarkdownNodeProps) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }: MarkdownNodeProps) => (
            <pre className="terminal-scroll my-2 max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[0.6875rem] leading-5">
              {children}
            </pre>
          ),
          code: ({ children }: MarkdownNodeProps) => (
            <code className="rounded bg-muted/40 px-1 py-0.5 font-mono text-[0.6875rem]">
              {children}
            </code>
          ),
          table: ({ children }: MarkdownNodeProps) => (
            <div className="terminal-scroll my-2 overflow-auto">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children }: MarkdownNodeProps) => (
            <th className="border border-border px-2 py-1 font-medium">{children}</th>
          ),
          td: ({ children }: MarkdownNodeProps) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
