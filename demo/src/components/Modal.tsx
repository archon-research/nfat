export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              color: "var(--text-muted)",
              fontSize: 18,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {"\u2715"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
