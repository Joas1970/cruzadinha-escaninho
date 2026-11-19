import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Send, X } from "lucide-react";
import {
  submissionHtml,
  submissionUrl,
  type ActivitySubmission,
} from "@/lib/crossword/submission";

function filenamePart(value: string, fallback: string) {
  return (
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 36) || fallback
  );
}

function submissionFileName(data: ActivitySubmission) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `respostas_${filenamePart(data.classroom, "turma")}_${filenamePart(data.student, "aluno")}_${filenamePart(data.title, "cruzadinha")}_${date}_${time}.html`;
}

export function SubmissionDialog({
  baseUrl,
  submission,
}: {
  baseUrl: string;
  submission: ActivitySubmission;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [studentName, setStudentName] = useState(submission.student);
  const [classroom, setClassroom] = useState(submission.classroom);
  useEffect(() => setStudentName(submission.student), [submission.student]);
  useEffect(() => setClassroom(submission.classroom), [submission.classroom]);

  const identifiedSubmission: ActivitySubmission = {
    ...submission,
    student: studentName.trim(),
    classroom: classroom.trim(),
  };
  const hasIdentity = Boolean(identifiedSubmission.student && identifiedSubmission.classroom);
  const qrUrl = hasIdentity && baseUrl ? submissionUrl(baseUrl, identifiedSubmission) : null;

  async function shareFile() {
    if (!hasIdentity) {
      setFeedback("Informe seu nome e sua turma antes de compartilhar.");
      return;
    }
    const file = new File([submissionHtml(identifiedSubmission)], submissionFileName(identifiedSubmission), {
      type: "text/html;charset=utf-8",
    });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files: [file],
          title: `Respostas da cruzadinha: ${identifiedSubmission.title}`,
          text: `${identifiedSubmission.student} - ${identifiedSubmission.classroom}`,
        });
        setFeedback("Compartilhamento conclu\u00eddo pelo menu do aparelho.");
        return;
      }
      downloadFile(file);
      setFeedback("Arquivo salvo. Abra-o para ler ou imprimir como PDF.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setFeedback("Compartilhamento cancelado.");
        return;
      }
      downloadFile(file);
      setFeedback("N\u00e3o foi poss\u00edvel abrir o compartilhamento. Baixei o arquivo formatado.");
    }
  }

  function downloadFile(download: File) {
    const url = URL.createObjectURL(download);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = download.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFeedback("");
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="tool-button bg-ink text-paper">
          <Send size={16} aria-hidden /> Enviar atividade realizada
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="share-backdrop" />
        <Dialog.Content className="share-dialog submission-dialog" aria-describedby="submission-description">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-brass-deep uppercase">
                {"Devolu\u00e7\u00e3o da atividade"}
              </p>
              <Dialog.Title className="mt-2 font-display text-3xl">Enviar respostas</Dialog.Title>
            </div>
            <Dialog.Close className="tool-button shrink-0" aria-label={"Fechar devolu\u00e7\u00e3o"}>
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description id="submission-description" className="mt-3 text-ink-soft">
            O professor pode escanear este QR code para abrir as respostas. Ou envie o arquivo pelo menu do celular.
          </Dialog.Description>

          <div className="submission-identity">
            <label className="grid gap-1 text-sm font-semibold">
              Nome do aluno
              <input
                className="share-field"
                value={studentName}
                onChange={(event) => { setStudentName(event.target.value); setFeedback(""); }}
                maxLength={100}
                autoComplete="name"
                aria-required="true"
                placeholder="Digite seu nome completo"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Turma
              <input
                className="share-field"
                value={classroom}
                onChange={(event) => { setClassroom(event.target.value); setFeedback(""); }}
                maxLength={80}
                aria-required="true"
                placeholder="Ex.: 8 C"
              />
            </label>
            {hasIdentity ? (
              <p className="col-span-full m-0 text-xs text-ink-soft">
                Nome do arquivo: <strong>{submissionFileName(identifiedSubmission)}</strong>
              </p>
            ) : null}
          </div>

          <div className="submission-options mt-5">
            <section className="submission-qr-panel">
              <h3 className="font-display text-xl">Devolver por QR Code</h3>
              {qrUrl ? (
                <div className="share-qr submission-qr">
                  <QRCodeSVG value={qrUrl} size={264} level="L" marginSize={4} title="QR code com as respostas da atividade" />
                </div>
              ) : !hasIdentity ? (
                <p role="status" className="mt-3 bg-paper-deep p-3 text-sm">
                  {"Preencha nome e turma para gerar o QR code de devolu\u00e7\u00e3o."}
                </p>
              ) : (
                <p role="status" className="mt-3 bg-paper-deep p-3 text-sm">
                  Esta resposta ficou extensa para um QR code. Envie o arquivo pelo menu do celular.
                </p>
              )}
              <p className="mt-3 text-sm text-ink-soft">
                {"No aparelho do professor, abra a c\u00e2mera e aponte para o c\u00f3digo. A p\u00e1gina mostra a atividade em fundo claro e permite imprimir ou salvar como PDF."}
              </p>
            </section>

            <section className="submission-file-panel">
              <h3 className="font-display text-xl">Enviar arquivo</h3>
              <p className="mt-2 text-sm text-ink-soft">
                {"O arquivo HTML mant\u00e9m o texto leg\u00edvel em fundo branco. No menu de compartilhamento, escolha Bluetooth, Quick Share ou WhatsApp, se aparecerem no seu aparelho."}
              </p>
              <button
                type="button"
                className="tool-button mt-4 bg-ink text-paper"
                disabled={!hasIdentity}
                onClick={() => void shareFile()}
              >
                <Send size={16} aria-hidden /> Compartilhar arquivo
              </button>
              {qrUrl ? (
                <button
                  type="button"
                  className="tool-button mt-2"
                  onClick={() => window.open(qrUrl, "_blank", "noopener,noreferrer")}
                >
                  <Printer size={16} aria-hidden /> {"Abrir p\u00e1gina para imprimir"}
                </button>
              ) : null}
            </section>
          </div>
          <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm text-brass-deep">
            {feedback}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
