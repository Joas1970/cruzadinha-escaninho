import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Send, X } from "lucide-react";
import {
  submissionHtml,
  submissionUrl,
  type ActivitySubmission,
} from "@/lib/crossword/submission";

export function SubmissionDialog({
  baseUrl,
  submission,
}: {
  baseUrl: string;
  submission: ActivitySubmission;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const qrUrl = baseUrl ? submissionUrl(baseUrl, submission) : null;
  const file = new File([submissionHtml(submission)], "respostas-cruzadinha.html", {
    type: "text/html;charset=utf-8",
  });

  async function shareFile() {
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files: [file],
          title: `Respostas da cruzadinha: ${submission.title}`,
          text: `${submission.student || "Aluno"} Â· ${submission.classroom || "Turma nÃ£o informada"}`,
        });
        setFeedback("Compartilhamento concluÃ­do pelo menu do aparelho.");
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
      setFeedback("NÃ£o foi possÃ­vel abrir o compartilhamento. Baixei o arquivo formatado.");
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
                DevoluÃ§Ã£o da atividade
              </p>
              <Dialog.Title className="mt-2 font-display text-3xl">
                Enviar respostas
              </Dialog.Title>
            </div>
            <Dialog.Close className="tool-button shrink-0" aria-label="Fechar devoluÃ§Ã£o">
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description id="submission-description" className="mt-3 text-ink-soft">
            O professor pode escanear este QR code para abrir as respostas. Ou envie o arquivo pelo
            menu do celular.
          </Dialog.Description>

          <div className="submission-options mt-5">
            <section className="submission-qr-panel">
              <h3 className="font-display text-xl">Devolver por QR Code</h3>
              {qrUrl ? (
                <div className="share-qr submission-qr">
                  <QRCodeSVG value={qrUrl} size={264} level="L" marginSize={4} title="QR code com as respostas da atividade" />
                </div>
              ) : (
                <p role="status" className="mt-3 bg-paper-deep p-3 text-sm">
                  Esta resposta ficou extensa para um QR code. Envie o arquivo pelo menu do celular.
                </p>
              )}
              <p className="mt-3 text-sm text-ink-soft">
                No aparelho do professor, abra a cÃ¢mera e aponte para o cÃ³digo. A pÃ¡gina mostra a
                atividade em fundo claro e permite imprimir ou salvar como PDF.
              </p>
            </section>

            <section className="submission-file-panel">
              <h3 className="font-display text-xl">Enviar arquivo</h3>
              <p className="mt-2 text-sm text-ink-soft">
                O arquivo HTML mantÃ©m o texto legÃ­vel em fundo branco. No menu de compartilhamento,
                escolha Bluetooth, Quick Share ou WhatsApp, se aparecerem no seu aparelho.
              </p>
              <button
                type="button"
                className="tool-button mt-4 bg-ink text-paper"
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
                  <Printer size={16} aria-hidden /> Abrir página para imprimir
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
