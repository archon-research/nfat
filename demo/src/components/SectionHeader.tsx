export function SectionHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h3
      style={{
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 10,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 1,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}
