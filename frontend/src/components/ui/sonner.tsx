import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      style={
        {
          '--normal-bg': 'oklch(var(--popover))',
          '--normal-text': 'oklch(var(--popover-foreground))',
          '--normal-border': 'oklch(var(--border))',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
export { toast } from 'sonner';
