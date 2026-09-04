// Bootstrap danger alert that renders nothing when there's no message —
// so callers can drop it in unconditionally instead of repeating the
// `{message && (...)}` guard around the same markup.
export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div className="alert alert-danger" role="alert">
      {message}
    </div>
  );
}
