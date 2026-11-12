import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * Chunky "3D" buttons: a solid face with a darker bottom edge drawn as a hard
 * shadow; pressing moves the face down onto the edge.
 */
const press =
  "active:not-aria-[haspopup]:translate-y-[3px] active:not-aria-[haspopup]:shadow-none"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-100 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow-[0_3px_0_var(--primary-edge)] hover:brightness-105 ${press}`,
        orange: `bg-brand-orange text-white shadow-[0_3px_0_var(--brand-orange-edge)] hover:brightness-105 ${press}`,
        blue: `bg-brand-blue text-white shadow-[0_3px_0_var(--brand-blue-edge)] hover:brightness-105 ${press}`,
        outline: `border-border bg-card text-foreground shadow-[0_3px_0_var(--border)] hover:bg-muted aria-expanded:bg-muted ${press}`,
        secondary: `bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--primary)_10%)] aria-expanded:bg-secondary`,
        ghost:
          "font-semibold hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive: `bg-destructive text-white shadow-[0_3px_0_var(--destructive-edge)] hover:brightness-105 focus-visible:ring-destructive/30 ${press}`,
        link: "font-semibold text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        xl: "h-14 gap-2.5 rounded-2xl px-8 text-base tracking-wide [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
