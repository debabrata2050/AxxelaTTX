import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-105',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:brightness-110',
        outline:
          'border border-border bg-card/50 hover:bg-accent hover:text-accent-foreground text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-105',
        ghost: 'hover:bg-accent/50 hover:text-foreground text-muted-foreground',
        gold:
          'rounded-full bg-gradient-to-r from-[#ffc81a] via-[#faa000] to-[#f58200] text-black font-bold shadow-xs hover:shadow-md hover:shadow-amber-500/30 hover:brightness-106 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 border-none',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7.5 rounded-md px-3 text-[11px]',
        lg: 'h-10 rounded-xl px-6 text-sm',
        icon: 'size-8.5 rounded-xl',
        pill: 'h-8.5 rounded-full px-4 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
