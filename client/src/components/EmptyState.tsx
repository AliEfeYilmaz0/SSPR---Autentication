const EmptyState = ({ title, message }: { title: string; message: string }) => {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <p className="muted">{message}</p>
    </div>
  );
};

export default EmptyState;
