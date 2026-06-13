export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-50) 0%, var(--accent-50) 100%)",
      }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
