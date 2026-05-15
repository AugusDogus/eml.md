import PostalMime, { type Address, type Email } from 'postal-mime'

export type ConvertedEmail = {
  fileName: string
  markdown: string
}

export async function convertEmlFileToMarkdown(
  file: File,
): Promise<ConvertedEmail> {
  const email = await PostalMime.parse(file)
  const body = normalizeBody(email)
  const messages = splitConversation(body)
  const markdown = formatMarkdown(email, messages)

  return {
    fileName: toMarkdownFileName(file.name),
    markdown,
  }
}

function normalizeBody(email: Email) {
  const body = email.text?.trim() || htmlToText(email.html || '').trim()

  return body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  doc.querySelectorAll('p, div, blockquote, li').forEach((node) => {
    node.append('\n')
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

function formatMarkdown(email: Email, messages: ConversationMessage[]) {
  const from = formatAddress(email.from) || 'Unknown sender'
  const recipients = formatAddresses(email.to)
  const title = email.subject?.trim() || 'Email conversation'
  const lines = [`# ${escapeMarkdownHeading(title)}`, '']

  lines.push('## Conversation Map', '')
  lines.push(`- Latest message: ${from}`)
  if (recipients) lines.push(`- To: ${recipients}`)
  if (messages.length > 1) {
    lines.push(`- Detected quoted replies: ${messages.length - 1}`)
  }
  lines.push('')

  messages.forEach((message, index) => {
    const label = index === 0 ? from : message.speaker || `Quoted reply ${index}`
    lines.push(`## ${index + 1}. ${escapeMarkdownHeading(label)}`)
    if (message.intro) {
      lines.push('', `> ${message.intro}`)
    }
    lines.push('', message.content.trim(), '')
  })

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
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

function toMarkdownFileName(fileName: string) {
  return fileName.replace(/\.eml$/i, '') + '.md'
}
