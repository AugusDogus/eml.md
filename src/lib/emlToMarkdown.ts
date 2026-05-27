import PostalMime, {
  type Address,
  type Attachment,
  type Email,
} from 'postal-mime'

export interface ConvertedAttachment {
  fileName: string
  mimeType: string
  size: number
  disposition: Attachment['disposition']
  contentId?: string
  related?: boolean
  isInline: boolean
  isReferencedInline: boolean
  content: ArrayBuffer
}

export interface ConvertedEmail {
  fileName: string
  markdown: string
  attachments: ConvertedAttachment[]
}

export async function convertEmlFileToMarkdown(
  file: File,
): Promise<ConvertedEmail> {
  const email = await PostalMime.parse(file)
  const referencedContentIds = getReferencedContentIds(email.html || '')
  const attachments = normalizeAttachments(email.attachments, referencedContentIds)
  const body = normalizeBody(email, attachments)
  const messages = splitConversation(body)
  const markdown = formatMarkdown(email, messages, attachments)

  return {
    fileName: toMarkdownFileName(file.name),
    markdown,
    attachments,
  }
}

function normalizeBody(email: Email, attachments: ConvertedAttachment[]) {
  const hasInlineReferences = attachments.some(
    (attachment) => attachment.isReferencedInline,
  )
  const body =
    hasInlineReferences && email.html
      ? htmlToText(email.html, attachments).trim()
      : email.text?.trim() || htmlToText(email.html || '', attachments).trim()

  return body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToText(html: string, attachments: ConvertedAttachment[]) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const attachmentByContentId = new Map(
    attachments
      .filter((attachment) => attachment.contentId)
      .map((attachment) => [attachment.contentId, attachment]),
  )

  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  doc.querySelectorAll('p, div, blockquote, li').forEach((node) => {
    node.append('\n')
  })
  doc.querySelectorAll('[src], [href]').forEach((node) => {
    const element = node as HTMLElement
    const contentId = cidUrlToContentId(
      element.getAttribute('src') || element.getAttribute('href') || '',
    )
    if (!contentId) return

    const attachment = attachmentByContentId.get(contentId)
    const label = attachment
      ? `Inline attachment: ${attachment.fileName}`
      : `Inline attachment: ${contentId}`

    node.replaceWith(`\n[${label}]\n`)
  })

  return doc.body.textContent || ''
}

type ConversationMessage = {
  speaker?: string
  intro?: string
  content: string
}

function splitConversation(body: string): ConversationMessage[] {
  if (!body) return [{ content: '_No message body found._' }]

  const lines = body.split('\n')
  const messages: ConversationMessage[] = []
  let current: string[] = []

  for (const line of lines) {
    const quoteIntro = getQuoteIntro(line)

    if (quoteIntro && current.some((entry) => entry.trim())) {
      messages.push({ content: cleanMessage(current.join('\n')) })
      current = [line]
      continue
    }

    current.push(line)
  }

  if (current.some((entry) => entry.trim())) {
    messages.push({ content: cleanMessage(current.join('\n')) })
  }

  return messages
    .map((message, index) => {
      const intro = getQuoteIntro(message.content)
      const speaker = intro ? speakerFromIntro(intro) : undefined

      return {
        speaker: index === 0 ? undefined : speaker,
        intro,
        content: stripIntro(message.content, intro),
      }
    })
    .filter((message) => message.content.trim())
}

function getQuoteIntro(text: string) {
  const firstLine = text.split('\n').find((line) => line.trim())?.trim() || ''

  return (
    firstLine.match(/^On .+ wrote:$/i)?.[0] ||
    firstLine.match(/^From:\s*.+$/i)?.[0] ||
    firstLine.match(/^[-_]+\s*Original Message\s*[-_]+$/i)?.[0]
  )
}

function speakerFromIntro(intro: string) {
  const onMatch = intro.match(/^On .+?,\s*(.+?)\s*wrote:$/i)
  if (onMatch?.[1]) return onMatch[1]

  const fromMatch = intro.match(/^From:\s*(.+)$/i)
  if (fromMatch?.[1]) return fromMatch[1]

  return undefined
}

function stripIntro(content: string, intro?: string) {
  let text = content.trim()
  if (intro && text.startsWith(intro)) text = text.slice(intro.length).trim()

  return text
    .split('\n')
    .map((line) => line.replace(/^>+\s?/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanMessage(content: string) {
  return content
    .replace(/^\s*Sent from my .+$/gim, '')
    .replace(/^\s*Get Outlook for .+$/gim, '')
    .replace(/^\s*Confidentiality Notice:.*$/gim, '')
    .trim()
}

function formatMarkdown(
  email: Email,
  messages: ConversationMessage[],
  attachments: ConvertedAttachment[],
) {
  const from = formatAddress(email.from) || 'Unknown sender'
  const recipients = formatAddresses(email.to)
  const title = email.subject?.trim() || 'Email conversation'
  const lines = [`# ${escapeMarkdownHeading(title)}`, '']
  const inlineAttachments = attachments.filter((attachment) => attachment.isInline)
  const attachedFiles = attachments.filter((attachment) => !attachment.isInline)

  lines.push('## Conversation Map', '')
  lines.push(`- Latest message: ${from}`)
  if (recipients) lines.push(`- To: ${recipients}`)
  if (messages.length > 1) {
    lines.push(`- Detected quoted replies: ${messages.length - 1}`)
  }
  if (attachedFiles.length) lines.push(`- Attached files: ${attachedFiles.length}`)
  if (inlineAttachments.length)
    lines.push(`- Inline assets: ${inlineAttachments.length}`)
  lines.push('')

  messages.forEach((message, index) => {
    const label = index === 0 ? from : message.speaker || `Quoted reply ${index}`
    lines.push(`## ${index + 1}. ${escapeMarkdownHeading(label)}`)
    if (message.intro) {
      lines.push('', `> ${message.intro}`)
    }
    lines.push('', message.content.trim(), '')
  })

  if (attachedFiles.length) {
    lines.push('## Attached Files', '')
    lines.push(...formatAttachmentLines(attachedFiles))
    lines.push('')
  }

  if (inlineAttachments.length) {
    lines.push('## Inline Assets', '')
    lines.push(...formatAttachmentLines(inlineAttachments))
    lines.push('')
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function formatAttachmentLines(attachments: ConvertedAttachment[]) {
  return attachments.map((attachment, index) => {
    const details = [
      attachment.mimeType,
      formatBytes(attachment.size),
      attachment.isReferencedInline ? 'referenced in body' : undefined,
    ]
      .filter(Boolean)
      .join(' - ')

    return `${index + 1}. ${escapeMarkdownInline(attachment.fileName)}${
      details ? ` (${details})` : ''
    }`
  })
}

function normalizeAttachments(
  attachments: Attachment[] = [],
  referencedContentIds: Set<string>,
) {
  return attachments.map((attachment, index): ConvertedAttachment => {
    const content = attachmentContentToArrayBuffer(attachment.content)
    const contentId = normalizeContentId(attachment.contentId)
    const isReferencedInline = Boolean(
      contentId && referencedContentIds.has(contentId),
    )
    const isInline = Boolean(
      attachment.disposition === 'inline' ||
        attachment.related ||
        isReferencedInline,
    )

    return {
      fileName: attachment.filename || fallbackAttachmentFileName(index, attachment),
      mimeType: attachment.mimeType || 'application/octet-stream',
      size: content.byteLength,
      disposition: attachment.disposition,
      contentId,
      related: attachment.related,
      isInline,
      isReferencedInline,
      content,
    }
  })
}

function getReferencedContentIds(html: string) {
  const referencedContentIds = new Set<string>()
  if (!html) return referencedContentIds

  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('[src], [href]').forEach((node) => {
    const element = node as HTMLElement
    const contentId = cidUrlToContentId(
      element.getAttribute('src') || element.getAttribute('href') || '',
    )
    if (contentId) referencedContentIds.add(contentId)
  })

  return referencedContentIds
}

function cidUrlToContentId(value: string) {
  if (!value.toLowerCase().startsWith('cid:')) return undefined

  try {
    return normalizeContentId(decodeURIComponent(value.slice(4)))
  } catch {
    return normalizeContentId(value.slice(4))
  }
}

function normalizeContentId(value?: string) {
  return value?.replace(/[<>]/g, '').trim().toLowerCase()
}

function attachmentContentToArrayBuffer(content: Attachment['content']) {
  if (content instanceof ArrayBuffer) return content
  if (ArrayBuffer.isView(content)) {
    const bytes = new Uint8Array(content.byteLength)
    bytes.set(content)
    return bytes.buffer
  }

  const binary = atob(content)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}

function fallbackAttachmentFileName(index: number, attachment: Attachment) {
  const extension = extensionFromMimeType(attachment.mimeType)
  return `attachment-${index + 1}${extension}`
}

function extensionFromMimeType(mimeType?: string) {
  const extensionByMimeType: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'text/csv': '.csv',
    'text/plain': '.txt',
  }

  return mimeType ? extensionByMimeType[mimeType] || '' : ''
}

function formatAddress(address?: Address) {
  if (!address || 'group' in address) return undefined

  if (address.name && address.address) return `${address.name} <${address.address}>`
  return address.name || address.address
}

function formatAddresses(addresses?: Address[]) {
  return addresses?.map(formatAddress).filter(Boolean).join(', ')
}

function escapeMarkdownHeading(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/^#+\s*/, '').trim()
}

function escapeMarkdownInline(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1')
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** unitIndex

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${
    units[unitIndex]
  }`
}

function toMarkdownFileName(fileName: string) {
  return fileName.replace(/\.eml$/i, '') + '.md'
}
