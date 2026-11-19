import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { readSubmission } from "@/lib/crossword/submission";

export const Route = createFileRoute("/entrega")({ component: SubmissionPage });

function SubmissionPage() {
  const [resposta, setResposta] = useState<string | null>(null);
  useEffect(() => {
    setResposta(new URLSearchParams(window.location.hash.slice(1)).get("resposta") ?? "");
  }, []);
  const submission = readSubmission(resposta ?? "");

  function printSubmission() {
    const clear = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", clear);
    };
    document.body.dataset.print = "submission";
    window.addEventListener("afterprint", clear);
    window.print();
  }

  if (resposta === null) {
    return (
      <main className="submission-page">
        <section className="submission-paper" aria-busy="true">
          <p className="submission-kicker">Escaninho Digital · Devolução</p>
          <h1>Preparando a atividade…</h1>
        </section>
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="submission-page">
        <section className="submission-paper">
          <p className="submission-kicker">Escaninho Digital · Devolução</p>
          <h1>Não foi possível abrir esta resposta</h1>
          <p>Peça ao aluno para gerar um novo QR code ou enviar o arquivo da atividade.</p>
          <Link className="tool-button mt-5" to="/">Voltar às atividades</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="submission-page">
      <section className="submission-paper">
        <div className="submission-no-print mb-6 flex flex-wrap gap-2">
          <button type="button" className="tool-button bg-ink text-paper" onClick={printSubmission}>
            <Printer size={16} aria-hidden /> Imprimir ou salvar como PDF
          </button>
          <Link className="tool-button" to="/">Voltar às atividades</Link>
        </div>
        <p className="submission-kicker">Escaninho Digital · Atividade devolvida</p>
        <h1>{submission.title}</h1>
        <dl className="submission-meta">
          <div><dt>Aluno</dt><dd>{submission.student || "Não informado"}</dd></div>
          <div><dt>Turma</dt><dd>{submission.classroom || "Não informada"}</dd></div>
          <div><dt>Palavras preenchidas</dt><dd>{submission.completeCount} de {submission.totalCount}</dd></div>
        </dl>
        {(["across", "down"] as const).map((direction) => {
          const answers = submission.answers.filter((item) => item.direction === direction);
          if (!answers.length) return null;
          return (
            <section className="submission-section" key={direction}>
              <h2>{direction === "across" ? "Horizontais" : "Verticais"}</h2>
              <ol>
                {answers.map((item, index) => (
                  <li key={`${direction}-${item.number}-${index}`}>
                    <p>{item.number}. {item.clue}</p>
                    <strong>
                      Resposta: {/^_+$/.test(item.answer) ? "Não preenchida" : item.answer.replace(/_/g, "□")}
                    </strong>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
        <p className="submission-footer">Respostas enviadas pelo aluno via QR code.</p>
      </section>
    </main>
  );
}
