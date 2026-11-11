import { useEffect, useState } from "react";

const people = [
  { name: "Dan Cho", detail: "Your manager", role: "Can use" },
  { name: "Dan's AI assistant", detail: "Acts as Dan", role: "Can use" },
];

type Props = {
  toolName: string;
  onClose: () => void;
  onSent: () => void;
};

export function ShareDialog({ toolName, onClose, onSent }: Props) {
  const [role, setRole] = useState("Can use");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copy(label: string) {
    const url = window.location.href;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(label);
  }

  return (
    <>
      <button type="button" className="share-backdrop" aria-label="Close share dialog" onClick={onClose} />
      <div className="share-dialog" role="dialog" aria-labelledby="share-title">
        <div className="share-head">
          <h2 id="share-title">Share “{toolName}”</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <label className="field">
          <span>Add people or teams</span>
          <input placeholder="Name or team" />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option>Can use</option>
            <option>Can edit</option>
            <option>Owner</option>
          </select>
        </label>

        <ul className="people">
          {people.map((person) => (
            <li key={person.name}>
              <span>
                <strong>{person.name}</strong>
                <span className="muted">{person.detail}</span>
              </span>
              <span className="muted">{person.role}</span>
            </li>
          ))}
        </ul>

        <p className="share-note">Everyone at the firm can find and use this tool.</p>
        <div className="share-links">
          <button type="button" className="text-btn" onClick={() => copy("Tool link copied")}>
            Copy tool link
          </button>
          <button type="button" className="text-btn" onClick={() => copy("Result link copied")}>
            Copy result link
          </button>
        </div>
        {copied && <p className="copied">{copied}</p>}

        <button type="button" className="btn send" onClick={onSent}>
          Send
        </button>
      </div>
    </>
  );
}
