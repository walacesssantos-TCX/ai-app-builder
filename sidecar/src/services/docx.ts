import path from 'path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'

export interface DocxOptions {
  title: string
  originalFileName: string
}

export async function generateDocx(
  text: string,
  outputPath: string,
  options: DocxOptions
): Promise<string> {
  const now = new Date()
  const formattedDate = now.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `Transcrição: ${options.title}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Arquivo original: ${options.originalFileName}`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Gerado em: ${formattedDate}`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '',
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: text || '(sem conteúdo transcrito)',
                size: 24,
              }),
            ],
          }),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const fs = await import('fs/promises')
  await fs.writeFile(outputPath, buffer)
  return outputPath
}
