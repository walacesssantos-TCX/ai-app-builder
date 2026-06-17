import type { FastifyInstance } from 'fastify'

export function registerConvertRoutes(fastify: FastifyInstance) {
  fastify.post('/convert', async (req, reply) => {
    const { content, format, title } = req.body as {
      content: string
      format: string
      title?: string
    }

    if (!content || !format) {
      return reply.status(400).send({ error: 'content and format are required' })
    }

    switch (format) {
      case 'docx': {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')
        const now = new Date()

        const lines = content.split('\n')
        const children: any[] = []

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) {
            children.push(new Paragraph({ spacing: { after: 100 } }))
            continue
          }

          if (trimmed.startsWith('### ')) {
            children.push(new Paragraph({
              text: trimmed.slice(4),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            }))
          } else if (trimmed.startsWith('## ')) {
            children.push(new Paragraph({
              text: trimmed.slice(3),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 150 },
            }))
          } else if (trimmed.startsWith('# ')) {
            children.push(new Paragraph({
              text: trimmed.slice(2),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }))
          } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            children.push(new Paragraph({
              children: [new TextRun({ text: `  ${trimmed}`, size: 22 })],
              spacing: { after: 60 },
            }))
          } else {
            children.push(new Paragraph({
              children: [new TextRun({ text: trimmed, size: 22 })],
              spacing: { after: 100 },
            }))
          }
        }

        if (title) {
          children.unshift(
            new Paragraph({
              children: [new TextRun({ text: `Gerado por Fluxcodex`, italics: true, size: 18, color: '888888' })],
              spacing: { after: 40 },
            }),
            new Paragraph({
              children: [new TextRun({ text: now.toLocaleString('pt-BR'), italics: true, size: 18, color: '888888' })],
              spacing: { after: 300 },
            })
          )
        }

        const doc = new Document({
          sections: [{ properties: {}, children }],
        })

        const buffer = await Packer.toBuffer(doc)
        return reply
          .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
          .header('Content-Disposition', `attachment; filename="${(title || 'documento').replace(/[<>:"/\\|?*]/g, '_')}.docx"`)
          .send(buffer)
      }

      case 'csv': {
        const rows = content.split('\n').filter(l => l.trim())
        const csv = rows.map(r => {
          const clean = r.replace(/^#+\s*/, '').trim()
          return `"${clean.replace(/"/g, '""')}"`
        }).join('\n')
        return reply
          .header('Content-Type', 'text/csv')
          .header('Content-Disposition', `attachment; filename="${(title || 'documento').replace(/[<>:"/\\|?*]/g, '_')}.csv"`)
          .send(csv)
      }

      case 'md':
        return reply
          .header('Content-Type', 'text/markdown')
          .header('Content-Disposition', `attachment; filename="${(title || 'documento').replace(/[<>:"/\\|?*]/g, '_')}.md"`)
          .send(content)

      default:
        return reply.status(501).send({
          error: `Conversion to ${format} is not yet supported. Supported formats: md, docx, csv`,
        })
    }
  })
}
