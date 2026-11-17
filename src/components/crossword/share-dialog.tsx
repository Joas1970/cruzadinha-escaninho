import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, ExternalLink, Maximize2, MessageCircle, Share2, X } from "lucide-react";
import { activityMessage, activityUrl, embedCode, MAX_QR_LENGTH } from "@/lib/crossword/sharing";

export function ShareDialog({
  baseUrl,
  puzzleId,
  source,
  title,
  teacherMode = true,
  canCheckInitially = true,
}: {
  baseUrl: string;
  puzzleId: string;
  source: string;
  title: string;
  teacherMode?: boolean;
  canCheckInitially?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [canCheck, setCanCheck] = useState(canCheckInitially);
  const [feedback, setFeedback] = useState("");
  const qrRef = useRef<HTMLDivElement | null>(null);
  const linkRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!teacherMode) setCanCheck(canCheckInitially);
  }, [teacherMode, canCheckInitially]);
  const share = useMemo(() => {
    try {
      const url = activityUrl(baseUrl, { puzzleId, source }, canCheck);
      return { url, code: embedCode(url, title), error: "" };
    } catch (error) {
      return {
        url: "",
        code: "",
        error: error instanceof Error ? error.message : "Não foi possível gerar o link.",
      };
    }
  }, [baseUrl, puzzleId, source, canCheck, title]);
  const qrAvailable =
    share.url.length > 0 && new TextEncoder().encode(share.url).length <= MAX_QR_LENGTH;

  async function copy(value: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(
        kind === "link"
          ? teacherMode
            ? "Link copiado. Já pode enviar aos alunos."
            : "Link copiado. Compartilhe com outro aluno."
          : "Código de incorporação copiado.",
      );
    } catch {
      const field = kind === "link" ? linkRef.current : codeRef.current;
      field?.focus();
      field?.select();
      setFeedback(
        "A cópia automática está indisponível. O texto foi selecionado; copie pelo menu do navegador ou com Ctrl+C.",
      );
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copy(share.url, "link");
      return;
    }
    try {
      await navigator.share({
        title: `Palavras Cruzadas — ${title}`,
        text: `Atividade: ${title}. Complete a cruzadinha com base no conteúdo estudado.`,
        url: share.url,
      });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setFeedback("Não foi possível abrir o compartilhamento. Use Copiar link.");
    }
  }

  function downloadQr() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "qr-cruzadinha-escaninho.svg";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setFeedback("QR code baixado. Use a imagem em slides ou na impressão.");
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setPresentation(false);
        setFeedback("");
      }}
    >
      <Dialog.Trigger className="tool-button bg-ink text-paper" disabled={!baseUrl}>
        <Share2 size={16} aria-hidden /> Compartilhar atividade
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="share-backdrop" />
        <Dialog.Content
          className={`share-dialog ${presentation ? "share-presentation" : ""}`}
          aria-describedby="share-description"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-brass-deep uppercase">
                Escaninho Digital
              </p>
              <Dialog.Title className="mt-2 font-display text-3xl">
                {presentation ? title : "Compartilhar atividade"}
              </Dialog.Title>
            </div>
            <Dialog.Close className="tool-button shrink-0" aria-label="Fechar compartilhamento">
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description id="share-description" className="mt-3 text-ink-soft">
            {presentation ? (
              "Aponte a câmera para o QR code e faça a atividade."
            ) : teacherMode ? (
              <>
                Envie <strong>{title}</strong> no modo aluno, sem Revelar, Gabarito ou editor de
                conteúdo.
              </>
            ) : (
              <>Compartilhe <strong>{title}</strong> com outro aluno pelo link ou WhatsApp.</>
            )}
          </Dialog.Description>
          {share.error ? (
            <p role="alert" className="mt-4 text-miss">
              {share.error}
            </p>
          ) : (
            <div className="share-body mt-6">
              <div className="flex min-w-0 flex-col items-center gap-3">
                {qrAvailable ? (
                  <div ref={qrRef} className="share-qr">
                    <QRCodeSVG
                      value={share.url}
                      size={presentation ? 440 : 280}
                      level="M"
                      marginSize={4}
                      title={`QR code para ${title}`}
                    />
                  </div>
                ) : (
                  <p className="bg-paper-deep p-4 text-sm">
                    Esta atividade tem um link extenso para QR code. Compartilhe pelo link ou reduza
                    as dicas.
                  </p>
                )}
                {!presentation ? (
                  <button
                    className="tool-button"
                    type="button"
                    onClick={downloadQr}
                    disabled={!qrAvailable}
                  >
                    <Download size={16} aria-hidden /> Baixar QR code
                  </button>
                ) : null}
                <p className="text-center text-sm text-ink-soft">
                  Cada aluno resolve no próprio dispositivo, sem cadastro.
                </p>
              </div>
              <div className="min-w-0">
                <label className="grid gap-2 text-sm font-semibold">
                  {teacherMode ? "Link para os alunos" : "Link desta atividade"}
                  <input
                    ref={linkRef}
                    className="share-field"
                    readOnly
                    value={share.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="tool-button bg-ink text-paper"
                    type="button"
                    onClick={() => copy(share.url, "link")}
                  >
                    <Copy size={16} aria-hidden /> Copiar link
                  </button>
                  {teacherMode ? (
                    <a
                      className="tool-button"
                      href={share.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={16} aria-hidden /> Abrir como aluno
                    </a>
                  ) : null}
                </div>
                {!presentation && teacherMode ? (
                  <>
                    <label className="mt-5 flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={canCheck}
                        onChange={(event) => {
                          setCanCheck(event.target.checked);
                          setFeedback("");
                        }}
                      />
                      Permitir que os alunos confiram as respostas
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        className="tool-button"
                        href={`https://wa.me/?text=${encodeURIComponent(activityMessage(title, share.url))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle size={16} aria-hidden /> WhatsApp
                      </a>
                      <button className="tool-button" type="button" onClick={nativeShare}>
                        <Share2 size={16} aria-hidden /> Compartilhar no dispositivo
                      </button>
                      <button
                        className="tool-button"
                        type="button"
                        onClick={() => {
                          setPresentation(true);
                          setFeedback("");
                        }}
                        disabled={!qrAvailable}
                      >
                        <Maximize2 size={16} aria-hidden /> Apresentar para a turma
                      </button>
                    </div>
                    <details className="mt-5 border-t border-line pt-4">
                      <summary className="min-h-11 cursor-pointer font-semibold">
                        Incorporar em uma página do site
                      </summary>
                      <p className="my-2 text-sm text-ink-soft">
                        Cole este código no bloco HTML da página. A altura se ajusta
                        automaticamente.
                      </p>
                      <label className="grid gap-2 text-sm">
                        Código de incorporação
                        <textarea
                          ref={codeRef}
                          className="share-field min-h-32 font-mono"
                          readOnly
                          value={share.code}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </label>
                      <button
                        className="tool-button mt-3"
                        type="button"
                        onClick={() => copy(share.code, "code")}
                      >
                        <Copy size={16} aria-hidden /> Copiar código
                      </button>
                    </details>
                  </>
                ) : presentation ? (
                  <button
                    className="tool-button mt-5"
                    type="button"
                    onClick={() => setPresentation(false)}
                  >
                    Voltar às opções
                  </button>
                ) : null}
                {!presentation && !teacherMode ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="tool-button"
                      href={`https://wa.me/?text=${encodeURIComponent(activityMessage(title, share.url))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle size={16} aria-hidden /> WhatsApp
                    </a>
                    <button className="tool-button" type="button" onClick={nativeShare}>
                      <Share2 size={16} aria-hidden /> Compartilhar no dispositivo
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm text-brass-deep">
            {feedback}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
