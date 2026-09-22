import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
  className,
  autoCapitalize = "none",
  autoCorrect = "off",
  spellCheck = false,
  autoComplete = "off",
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      autoComplete={autoComplete}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-[4px] border bg-transparent px-2 py-1.5 text-xs transition-[color,box-shadow] outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
