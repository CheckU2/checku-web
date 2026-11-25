import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentPropsWithoutRef } from "react";
import { passwordRules } from "../auth/passwordPolicy";

type PasswordFieldProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
  matches?: boolean;
  policy?: boolean;
};

export default function PasswordField({ id, label, matches, policy, ...inputProps }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const hasIndicator = matches !== undefined;
  const hasValue = Boolean(inputProps.value);
  const rules = policy ? passwordRules(String(inputProps.value ?? "")) : [];
  const descriptions = [
    inputProps["aria-describedby"], hasIndicator && `${inputId}-match`, policy && `${inputId}-rules`,
  ].filter(Boolean).join(" ");

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-control">
        <input
          {...inputProps}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-describedby={descriptions || undefined}
          aria-invalid={hasValue && (matches === false || rules.some(rule => !rule.valid)) || inputProps["aria-invalid"]}
        />
        <button
          type="button"
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.replace(/\s*\*$/, "").toLowerCase()}`}
          aria-controls={inputId}
          disabled={inputProps.disabled}
          onClick={() => setVisible(current => !current)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
      {policy && (
        <ul id={`${inputId}-rules`} className="password-rules">
          {rules.map(rule => <li key={rule.label} className={hasValue ? rule.valid ? "register-password-match" : "register-password-mismatch" : "muted"}>
            <span aria-hidden="true">{hasValue ? rule.valid ? "✓" : "×" : "•"}</span>
            {rule.label}{hasValue && <span className="sr-only">{rule.valid ? ", cumple" : ", pendiente"}</span>}
          </li>)}
        </ul>
      )}
      {hasIndicator && (
        <span id={`${inputId}-match`} role="status" className={matches ? "register-password-match" : "register-password-mismatch"}>
          {inputProps.value && (matches ? "Las contraseñas coinciden." : "Las contraseñas no coinciden.")}
        </span>
      )}
    </div>
  );
}
