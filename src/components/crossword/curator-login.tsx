import { useState, type FormEvent } from "react";
import { loginCurator } from "@/lib/crossword/gallery";

export function CuratorLogin({ onAccessGranted }: { onAccessGranted: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await loginCurator({ data: { email, password } });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setPassword("");
      onAccessGranted();
    } catch {
      setMessage("Não foi possível entrar agora. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-lg border border-line bg-paper-deep p-4">
      <div>
        <h3 className="font-semibold text-ink">Acesso do curador</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Entre com o e-mail autorizado e a senha configurada para administrar a galeria.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-ink">
          E-mail do curador
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-paper px-3 font-normal"
            placeholder="seu e-mail"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink">
          Senha do curador
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 rounded-md border border-line bg-paper px-3 font-normal"
            placeholder="senha de acesso"
          />
        </label>
      </div>
      {message ? <p role="alert" className="text-sm text-miss">{message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full bg-ink px-5 font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar como curador"}
      </button>
    </form>
  );
}
