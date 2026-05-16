import { useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  MailIcon,
  UploadIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { cn } from "~/lib/utils";
import {
  convertEmlFileToMarkdown,
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
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

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

    const url = URL.createObjectURL(
      new Blob([converted.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = converted.fileName;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(converted.fileName);
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
                <CardTitle className="truncate">
                  {converted?.fileName || "No file converted yet"}
                </CardTitle>
              </div>
              <div className="flex shrink-0 gap-2 sm:ml-auto">
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
                <Button
                  className="cursor-pointer"
                  variant="outline"
                  size="sm"
                  disabled={!converted}
                  onClick={downloadMarkdown}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Download
                </Button>
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
                <pre
                  ref={preRef}
                  className={cn(
                    "whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-foreground",
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
