import { Toaster as Sonner, type ToasterProps } from "sonner";

const DEFAULT_OFFSET = {
  top: "3rem",
  right: "1.5rem",
  bottom: "1.5rem",
  left: "1.5rem",
} satisfies ToasterProps["offset"];

const DEFAULT_MOBILE_OFFSET = {
  top: "3rem",
  right: "1rem",
  bottom: "1rem",
  left: "1rem",
} satisfies ToasterProps["mobileOffset"];

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      offset={DEFAULT_OFFSET}
      mobileOffset={DEFAULT_MOBILE_OFFSET}
      className="toaster group"
      richColors
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--popover)",
          "--success-border": "var(--border)",
          "--success-text": "var(--df-success)",
          "--info-bg": "var(--popover)",
          "--info-border": "var(--border)",
          "--info-text": "var(--df-primary)",
          "--warning-bg": "var(--popover)",
          "--warning-border": "var(--border)",
          "--warning-text": "var(--df-warning)",
          "--error-bg": "var(--popover)",
          "--error-border": "var(--border)",
          "--error-text": "var(--df-danger)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
