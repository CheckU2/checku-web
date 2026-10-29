interface FeedbackProps {
  error?: string;
  success?: string;
}

export default function Feedback({ error, success }: FeedbackProps) {
  if (!error && !success) return null;
  return (
    <div className={error ? "feedback feedback-error" : "feedback feedback-success"} role={error ? "alert" : "status"}>
      {error || success}
    </div>
  );
}
