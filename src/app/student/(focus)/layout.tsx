/**
 * Focus screens (onboarding quiz, reader): no sidebar or bottom navigation,
 * each page brings its own minimal top bar.
 */
export default function FocusLayout({ children }: LayoutProps<"/student">) {
  return <div className="min-h-dvh">{children}</div>;
}
