import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MiddleTruncate } from "@pierre/truncate/react";
import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  MailIcon,
  PaperclipIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { createEmailBundle } from "~/lib/emailBundle";
import { cn } from "~/lib/utils";
import {
  convertEmlFileToMarkdown,
  formatBytes,
  isImageAttachment,
  type ConvertedAttachment,
  type ConvertedEmail,
} from "~/lib/emlToMarkdown";

export default function EmlConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [converted, setConverted] = useState<ConvertedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [areAttachmentsExpanded, setAreAttachmentsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [isBundleWorking, setIsBundleWorking] = useState(false);

  useLayoutEffect(() => {
    const el = preRef.current;
    if (!el || isPreviewExpanded) {
      setIsOverflowing(false);
      return;
    }

    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [converted, isPreviewExpanded]);

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files).find(
      (entry) =>
        entry.name.toLowerCase().endsWith(".eml") ||
        entry.type === "message/rfc822",
    );

    if (!file) {
      setError("Please choose a .eml file.");
      return;
    }

    setError(null);
    setStatus(file.name);

    try {
      const result = await convertEmlFileToMarkdown(file);
      setIsPreviewExpanded(false);
      setAreAttachmentsExpanded(false);
      setConverted(result);
      setStatus(file.name);
    } catch (conversionError) {
      setConverted(null);
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "Could not parse that .eml file.",
      );
      setStatus(file.name);
    }
  }

  async function copyMarkdown() {
    if (!converted) return;

    await navigator.clipboard.writeText(converted.markdown);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  }

  function downloadMarkdown() {
    if (!converted) return;

    downloadBlob(
      new Blob([converted.markdown], { type: "text/markdown;charset=utf-8" }),
      converted.fileName,
    );
    setStatus(converted.fileName);
  }

  function downloadAttachment(attachment: ConvertedAttachment) {
    downloadBlob(
      new Blob([attachment.content], { type: attachment.mimeType }),
      attachment.fileName,
    );
    setStatus(attachment.fileName);
  }

  async function downloadBundle() {
    if (!converted || isBundleWorking) return;

    setIsBundleWorking(true);
    try {
      const bundle = await createEmailBundle(converted);
      downloadBlob(bundle.blob, bundle.fileName);
      setStatus(bundle.fileName);
    } finally {
      setIsBundleWorking(false);
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start",
          !isPreviewExpanded && "flex-1",
        )}
      >
        <button
          type="button"
          data-dragging={isDragging ? "" : undefined}
          className={cn(
            "group min-h-0 cursor-pointer rounded-xl border border-dashed border-border bg-card text-left text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none lg:min-h-132",
            "hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            "data-dragging:border-primary data-dragging:bg-primary/10",
            !isPreviewExpanded && "flex-1 lg:flex-none",
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <Empty className="h-full border-0">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-5"
              >
                <UploadIcon />
              </EmptyMedia>
              <EmptyTitle className="text-2xl">Drop your .eml file</EmptyTitle>
              <EmptyDescription>or click anywhere to browse</EmptyDescription>
            </EmptyHeader>
            {status && (
              <span className="text-xs text-muted-foreground">{status}</span>
            )}
          </Empty>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".eml,message/rfc822"
            onChange={(event) => {
              if (event.currentTarget.files)
                void handleFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </button>

        <Card
          className={cn(
            "flex flex-col gap-0 py-0 lg:relative lg:overflow-hidden lg:[--preview-header-height:5rem]",
            !isPreviewExpanded && "flex-1 min-h-0 lg:flex-none lg:h-132",
          )}
        >
          <CardHeader className="border-b bg-card py-4 lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 lg:min-h-(--preview-header-height)">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <CardDescription className="text-xs uppercase tracking-[0.2em]">
                  Markdown output
                </CardDescription>
                <PreviewTitle fileName={converted?.fileName ?? null} />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto sm:justify-end">
                <Tooltip open={justCopied}>
                  <TooltipTrigger
                    render={
                      <Button
                        className="cursor-pointer"
                        variant="default"
                        size="sm"
                        disabled={!converted}
                        onClick={() => void copyMarkdown()}
                      />
                    }
                  >
                    <CopyIcon data-icon="inline-start" />
                    Copy
                  </TooltipTrigger>
                  <TooltipContent>Copied!</TooltipContent>
                </Tooltip>
                <DownloadControl
                  disabled={!converted}
                  hasAttachments={Boolean(converted?.attachments.length)}
                  isBundleWorking={isBundleWorking}
                  onDownloadMarkdown={downloadMarkdown}
                  onDownloadBundle={downloadBundle}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent
            className={cn(
              "flex flex-col p-0",
              !isPreviewExpanded && "min-h-0 flex-1",
            )}
          >
            {error ? (
              <div className="p-4 lg:pt-[calc(var(--preview-header-height)+1rem)]">
                <Alert variant="destructive">
                  <AlertTitle>Conversion failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : converted ? (
              <div
                className={cn(
                  "relative lg:pt-(--preview-header-height)",
                  !isPreviewExpanded && "flex min-h-0 flex-1 flex-col",
                )}
              >
                <AttachmentDownloads
                  attachments={converted.attachments}
                  isExpanded={areAttachmentsExpanded}
                  onExpandedChange={setAreAttachmentsExpanded}
                  onDownload={downloadAttachment}
                />
                <pre
                  ref={preRef}
                  className={cn(
                    "scrollbar-thin-themed whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-foreground",
                    !isPreviewExpanded && "min-h-0 flex-1 overflow-auto",
                  )}
                >
                  {converted.markdown}
                </pre>
                {!isPreviewExpanded && isOverflowing && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-card to-transparent"
                  />
                )}
              </div>
            ) : (
              <Empty className="min-h-0 flex-1 border-0">
                <EmptyHeader>
                  <EmptyMedia
                    variant="icon"
                    className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-5"
                  >
                    <MailIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-2xl">
                    Conversation preview
                  </EmptyTitle>
                  <EmptyDescription>
                    Markdown appears here after conversion
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>

          {converted && !error && (isOverflowing || isPreviewExpanded) && (
            <CardFooter
              role="button"
              tabIndex={0}
              aria-expanded={isPreviewExpanded}
              className="cursor-pointer justify-center transition-colors hover:bg-muted/50"
              onClick={() => setIsPreviewExpanded((open) => !open)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsPreviewExpanded((open) => !open);
                }
              }}
            >
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {isPreviewExpanded ? "Show less" : "Show more"}
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform duration-200",
                    isPreviewExpanded && "rotate-180",
                  )}
                />
              </span>
            </CardFooter>
          )}
        </Card>
      </div>
    </TooltipProvider>
  );
}

interface AttachmentDownloadsProps {
  attachments: ConvertedAttachment[];
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
  onDownload: (attachment: ConvertedAttachment) => void;
}

interface DownloadControlProps {
  disabled: boolean;
  hasAttachments: boolean;
  isBundleWorking: boolean;
  onDownloadMarkdown: () => void;
  onDownloadBundle: () => Promise<void>;
}

function DownloadControl({
  disabled,
  hasAttachments,
  isBundleWorking,
  onDownloadMarkdown,
  onDownloadBundle,
}: DownloadControlProps) {
  if (!hasAttachments) {
    return (
      <Button
        className="cursor-pointer"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onDownloadMarkdown}
      >
        <DownloadIcon data-icon="inline-start" />
        Download
      </Button>
    );
  }

  return (
    <DownloadMenu
      disabled={disabled}
      isBundleWorking={isBundleWorking}
      onDownloadMarkdown={onDownloadMarkdown}
      onDownloadBundle={onDownloadBundle}
    />
  );
}

interface DownloadMenuProps {
  disabled: boolean;
  isBundleWorking: boolean;
  onDownloadMarkdown: () => void;
  onDownloadBundle: () => Promise<void>;
}

function DownloadMenu({
  disabled,
  isBundleWorking,
  onDownloadMarkdown,
  onDownloadBundle,
}: DownloadMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function downloadMarkdown() {
    onDownloadMarkdown();
    setIsOpen(false);
  }

  async function downloadBundle() {
    await onDownloadBundle();
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <Button
        className="cursor-pointer"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <DownloadIcon data-icon="inline-start" />
        Download
        <ChevronDownIcon data-icon="inline-end" />
      </Button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 grid w-64 gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={downloadMarkdown}
          >
            <span className="block font-medium">Markdown</span>
            <span className="block text-xs text-muted-foreground">
              Download the converted .md file
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            disabled={isBundleWorking}
            onClick={() => void downloadBundle()}
          >
            <span className="block font-medium">Bundle with attachments</span>
            <span className="block text-xs text-muted-foreground">
              Download a zip with markdown and extracted files
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function AttachmentDownloads({
  attachments,
  isExpanded,
  onExpandedChange,
  onDownload,
}: AttachmentDownloadsProps) {
  const [previewState, setPreviewState] = useState<{
    gallery: ConvertedAttachment[];
    index: number;
  } | null>(null);

  function openPreview(
    attachment: ConvertedAttachment,
    gallery: ConvertedAttachment[],
  ) {
    const index = gallery.indexOf(attachment);
    if (index === -1) return;

    setPreviewState({ gallery, index });
  }

  if (!attachments.length) return null;

  const attachedFiles = attachments.filter((attachment) => !attachment.isInline);
  const inlineAttachments = attachments.filter((attachment) => attachment.isInline);

  return (
    <div className="shrink-0 border-b bg-muted/30">
      <div className={cn("px-4 pt-4", isExpanded ? "pb-3" : "pb-4")}>
        <button
          type="button"
          aria-expanded={isExpanded}
          className="flex w-full cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onExpandedChange(!isExpanded)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
            <PaperclipIcon className="size-4 shrink-0" />
            <span className="truncate">Attachments</span>
          </span>
          <Badge variant="secondary" className="shrink-0">
            {attachments.length}{" "}
            {attachments.length === 1 ? "file" : "files"}
          </Badge>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>
      {isExpanded && (
        <div className="scrollbar-thin-themed max-h-48 overflow-y-auto overflow-x-hidden">
          <div className="grid gap-3 px-4 pb-4">
            <AttachmentGroup
              attachments={attachedFiles}
              title="Attached files"
              onDownload={onDownload}
              onPreview={openPreview}
            />
            <AttachmentGroup
              attachments={inlineAttachments}
              title="Inline assets"
              onDownload={onDownload}
              onPreview={openPreview}
            />
          </div>
        </div>
      )}
      {previewState && (
        <ImagePreviewOverlay
          gallery={previewState.gallery}
          index={previewState.index}
          onIndexChange={(index) =>
            setPreviewState((current) =>
              current ? { ...current, index } : current,
            )
          }
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}

interface AttachmentGroupProps {
  attachments: ConvertedAttachment[];
  title: string;
  onDownload: (attachment: ConvertedAttachment) => void;
  onPreview: (
    attachment: ConvertedAttachment,
    gallery: ConvertedAttachment[],
  ) => void;
}

function AttachmentGroup({
  attachments,
  title,
  onDownload,
  onPreview,
}: AttachmentGroupProps) {
  if (!attachments.length) return null;

  const previewableAttachments = attachments.filter(isImageAttachment);

  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h3>
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.fileName}-${index}`}
          className="flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border bg-card p-3"
        >
          {isImageAttachment(attachment) && (
            <AttachmentImageThumbnail
              attachment={attachment}
              onClick={() => onPreview(attachment, previewableAttachments)}
            />
          )}
          <div className="min-w-0 flex-1">
            <MiddleTruncatedFileName fileName={attachment.fileName} />
            <p className="text-xs text-muted-foreground">
              {formatAttachmentDetails(attachment)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {isImageAttachment(attachment) && (
              <Button
                className="cursor-pointer"
                variant="outline"
                size="sm"
                onClick={() => onPreview(attachment, previewableAttachments)}
              >
                <EyeIcon data-icon="inline-start" />
                View
              </Button>
            )}
            <Button
              className="cursor-pointer"
              variant="outline"
              size="sm"
              onClick={() => onDownload(attachment)}
            >
              <DownloadIcon data-icon="inline-start" />
              Download
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

interface AttachmentImageThumbnailProps {
  attachment: ConvertedAttachment;
  onClick: () => void;
}

function AttachmentImageThumbnail({
  attachment,
  onClick,
}: AttachmentImageThumbnailProps) {
  const url = useAttachmentObjectUrl(attachment);

  if (!url) return null;

  return (
    <button
      type="button"
      className="shrink-0 cursor-pointer overflow-hidden rounded-md border bg-muted/40 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onClick}
      aria-label={`View ${attachment.fileName}`}
    >
      <img
        src={url}
        alt=""
        className="block size-14 object-contain"
      />
    </button>
  );
}

interface ImagePreviewOverlayProps {
  gallery: ConvertedAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function ImagePreviewOverlay({
  gallery,
  index,
  onIndexChange,
  onClose,
}: ImagePreviewOverlayProps) {
  const attachment = gallery[index];
  const url = useAttachmentObjectUrl(attachment);
  const hasPrevious = index > 0;
  const hasNext = index < gallery.length - 1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onIndexChange(index - 1);
      }

      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasNext, hasPrevious, index, onClose, onIndexChange]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.fileName}`}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 cursor-pointer rounded-md p-2 text-white/80 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/50"
        aria-label="Close preview"
        onClick={onClose}
      >
        <XIcon className="size-5" />
      </button>
      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={url}
          alt={attachment.fileName}
          className="max-h-[85vh] max-w-full object-contain"
        />
        <p className="max-w-full truncate text-sm text-white/80">
          {attachment.fileName}
          {gallery.length > 1 && (
            <span className="text-white/50">{` · ${index + 1} / ${gallery.length}`}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function useAttachmentObjectUrl(attachment: ConvertedAttachment | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(
      new Blob([attachment.content], { type: attachment.mimeType }),
    );
    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  return url;
}

function formatAttachmentDetails(attachment: ConvertedAttachment) {
  return [
    attachment.mimeType,
    formatBytes(attachment.size),
    attachment.isReferencedInline ? "referenced in body" : undefined,
  ]
    .filter(Boolean)
    .join(" - ");
}

interface PreviewTitleProps {
  fileName: string | null;
}

interface MiddleTruncatedFileNameProps {
  fileName: string;
}

function PreviewTitle({ fileName }: PreviewTitleProps) {
  if (!fileName) {
    return (
      <CardTitle>
        <MiddleTruncate>No file converted yet</MiddleTruncate>
      </CardTitle>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<CardTitle />}>
        <MiddleTruncate>{fileName}</MiddleTruncate>
      </TooltipTrigger>
      <TooltipContent className="break-words">{fileName}</TooltipContent>
    </Tooltip>
  );
}

function MiddleTruncatedFileName({ fileName }: MiddleTruncatedFileNameProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="text-sm font-medium" />}>
        <MiddleTruncate>{fileName}</MiddleTruncate>
      </TooltipTrigger>
      <TooltipContent className="break-words">{fileName}</TooltipContent>
    </Tooltip>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
