import JSZip from "jszip";

import {
  formatBytes,
  type ConvertedAttachment,
  type ConvertedEmail,
} from "~/lib/emlToMarkdown";

const ZIP_MIME_TYPE = "application/zip";

interface BundleAttachmentEntry {
  attachment: ConvertedAttachment;
  kind: "attached-file" | "inline-asset";
  path: string;
}

export interface EmailBundle {
  blob: Blob;
  fileName: string;
}

export async function createEmailBundle(
  converted: ConvertedEmail,
): Promise<EmailBundle> {
  const zip = new JSZip();
  const bundleName = toBundleName(converted.fileName);
  const entries = createAttachmentEntries(converted.attachments);

  zip.file(`${bundleName}/email.md`, createBundleMarkdown(converted, entries));
  zip.file(`${bundleName}/manifest.json`, createManifest(converted, entries));

  entries.forEach((entry) => {
    zip.file(`${bundleName}/${entry.path}`, entry.attachment.content);
  });

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType: ZIP_MIME_TYPE,
  });

  return {
    blob,
    fileName: `${bundleName}.zip`,
  };
}

function createBundleMarkdown(
  converted: ConvertedEmail,
  entries: BundleAttachmentEntry[],
) {
  if (!entries.length) return converted.markdown;

  const attachedFiles = entries.filter((entry) => entry.kind === "attached-file");
  const inlineAssets = entries.filter((entry) => entry.kind === "inline-asset");
  const lines = [converted.markdown.trim(), "", "## Bundle Files", ""];

  if (attachedFiles.length) {
    lines.push("### Attached Files", "");
    lines.push(...formatBundleLinks(attachedFiles), "");
  }

  if (inlineAssets.length) {
    lines.push("### Inline Assets", "");
    lines.push(...formatBundleLinks(inlineAssets), "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function formatBundleLinks(entries: BundleAttachmentEntry[]) {
  return entries.map((entry) => {
    const details = [
      entry.attachment.mimeType,
      formatBytes(entry.attachment.size),
      entry.attachment.isReferencedInline ? "referenced in body" : undefined,
    ]
      .filter(Boolean)
      .join(" - ");

    return `- [${escapeMarkdownLinkText(entry.attachment.fileName)}](${encodeURI(
      entry.path,
    )})${details ? ` (${details})` : ""}`;
  });
}

function createManifest(
  converted: ConvertedEmail,
  entries: BundleAttachmentEntry[],
) {
  return (
    JSON.stringify(
      {
        markdown: "email.md",
        originalMarkdownFileName: converted.fileName,
        attachments: entries.map((entry) => ({
          path: entry.path,
          originalFileName: entry.attachment.fileName,
          kind: entry.kind,
          mimeType: entry.attachment.mimeType,
          size: entry.attachment.size,
          disposition: entry.attachment.disposition,
          contentId: entry.attachment.contentId,
          related: entry.attachment.related,
          isReferencedInline: entry.attachment.isReferencedInline,
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

function createAttachmentEntries(attachments: ConvertedAttachment[]) {
  const usedPaths = new Set<string>();

  return attachments.map((attachment): BundleAttachmentEntry => {
    const kind = attachment.isInline ? "inline-asset" : "attached-file";
    const folder = attachment.isInline ? "inline-assets" : "attachments";
    const path = getUniquePath(
      usedPaths,
      `${folder}/${sanitizeFileName(attachment.fileName)}`,
    );

    return {
      attachment,
      kind,
      path,
    };
  });
}

function getUniquePath(usedPaths: Set<string>, path: string) {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const extensionIndex = path.lastIndexOf(".");
  const base =
    extensionIndex > 0 ? path.slice(0, extensionIndex) : path;
  const extension = extensionIndex > 0 ? path.slice(extensionIndex) : "";
  let nextPath = path;
  let count = 2;

  while (usedPaths.has(nextPath)) {
    nextPath = `${base}-${count}${extension}`;
    count += 1;
  }

  usedPaths.add(nextPath);
  return nextPath;
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return sanitized || "attachment";
}

function toBundleName(markdownFileName: string) {
  const baseName = markdownFileName.replace(/\.md$/i, "");
  return sanitizeFileName(baseName).replace(/\.+$/g, "") || "email-bundle";
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}
