---
description: Tailwind, shadcn/ui, dark mode, icons, and toast notification rules
---

- Use shadcn/ui components from `src/components/ui/` before building custom components. Check what's already installed before creating anything new.
- Use Tailwind utility classes inline. Do not write new CSS files or add to `App.css` unless there is no Tailwind equivalent.
- Dark mode is class-based (`next-themes`). Use CSS variable tokens (`bg-background`, `text-foreground`, `border`, `muted`, etc.) instead of hardcoded colors like `bg-white` or `text-gray-900`, so dark mode works automatically.
- Icons come from `lucide-react`. Do not add a second icon library.
- Toast notifications use `sonner`. Use `toast.success()`, `toast.error()`, `toast.info()`. Do not use `alert()`, `confirm()`, or `console.log` for user feedback.
- Custom fonts are Plus Jakarta Sans (sans) and JetBrains Mono (mono), configured in `tailwind.config.ts`. Use `font-sans` and `font-mono` — do not import fonts separately.
- When matching a design reference: check spacing, font size/weight, exact hex colors, alignment, border radii, and shadows. Use Puppeteer to screenshot and do at least 2 comparison rounds before stopping.
