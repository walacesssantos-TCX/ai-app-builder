# Conversão de Documentos para PDF

## Visão Geral

Esta skill cobre a conversão de qualquer tipo de documento para PDF.
A estratégia correta depende do formato de entrada — consulte a tabela abaixo e siga as instruções da seção correspondente.

## Mapa de Estratégias por Formato

| Formato de Entrada      | Extensões                          | Melhor Ferramenta          |
|-------------------------|------------------------------------|----------------------------|
| Office (Word/Excel/PPT) | .docx .xlsx .pptx .odt .ods .odp .rtf | LibreOffice (headless)  |
| HTML                    | .html .htm                         | wkhtmltopdf                |
| Markdown                | .md .markdown                      | pandoc                     |
| Imagens                 | .jpg .jpeg .png .gif .bmp .tiff    | img2pdf + Pillow           |
| Texto Puro              | .txt                               | reportlab                  |
| CSV / Tabela            | .csv .tsv                          | reportlab + pandas         |

---

## 1. Office: .docx, .xlsx, .pptx, .odt, .ods, .odp, .rtf

**Ferramenta principal: LibreOffice headless**

```bash
libreoffice --headless --convert-to pdf --outdir /saida/ arquivo.docx
```

**Script Python completo:**
```python
import subprocess, shutil, os

def office_to_pdf(input_path: str, output_dir: str) -> str:
    """Converte qualquer arquivo Office para PDF via LibreOffice."""
    os.makedirs(output_dir, exist_ok=True)
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf",
         "--outdir", output_dir, input_path],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice falhou: {result.stderr}")
    
    base = os.path.splitext(os.path.basename(input_path))[0]
    pdf_path = os.path.join(output_dir, f"{base}.pdf")
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF não gerado em: {pdf_path}")
    return pdf_path
```

**Notas importantes:**
- O LibreOffice pode demorar alguns segundos na primeira execução (inicialização JVM).
- Fontes personalizadas podem não estar disponíveis — use fontes padrão se o layout importa.
- Para `.xlsx` com múltiplas abas, cada aba vira uma página do PDF.

---

## 2. HTML: .html, .htm

**Ferramenta principal: wkhtmltopdf** (melhor fidelidade CSS)

```bash
wkhtmltopdf --encoding utf-8 --page-size A4 arquivo.html saida.pdf
```

**Com opções avançadas:**
```bash
wkhtmltopdf \
  --encoding utf-8 \
  --page-size A4 \
  --margin-top 15mm --margin-bottom 15mm \
  --margin-left 15mm --margin-right 15mm \
  --enable-local-file-access \
  arquivo.html saida.pdf
```

**Script Python:**
```python
import subprocess, os

def html_to_pdf(input_path: str, output_path: str) -> str:
    result = subprocess.run([
        "wkhtmltopdf",
        "--encoding", "utf-8",
        "--page-size", "A4",
        "--margin-top", "15mm", "--margin-bottom", "15mm",
        "--margin-left", "15mm", "--margin-right", "15mm",
        "--enable-local-file-access",
        input_path, output_path
    ], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"wkhtmltopdf falhou: {result.stderr}")
    return output_path
```

**Alternativa — via LibreOffice (se wkhtmltopdf falhar):**
```bash
libreoffice --headless --convert-to pdf --outdir /saida/ arquivo.html
```

---

## 3. Markdown: .md, .markdown

**Ferramenta principal: pandoc**

```bash
pandoc arquivo.md -o saida.pdf --pdf-engine=wkhtmltopdf
```

**Com estilos e metadata:**
```bash
pandoc arquivo.md \
  -o saida.pdf \
  --pdf-engine=wkhtmltopdf \
  -V geometry:margin=2cm \
  -V fontsize=12pt \
  --metadata title="Título do Documento"
```

**Script Python:**
```python
import subprocess

def markdown_to_pdf(input_path: str, output_path: str, title: str = "") -> str:
    cmd = [
        "pandoc", input_path,
        "-o", output_path,
        "--pdf-engine=wkhtmltopdf",
        "-V", "geometry:margin=2cm",
        "-V", "fontsize=12pt",
    ]
    if title:
        cmd += ["--metadata", f"title={title}"]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pandoc falhou: {result.stderr}")
    return output_path
```

---

## 4. Imagens: .jpg, .jpeg, .png, .gif, .bmp, .tiff

**Ferramenta principal: img2pdf** (preserva qualidade, sem recompressão)

```python
import img2pdf
from PIL import Image
import os

def images_to_pdf(image_paths: list[str], output_path: str) -> str:
    """Converte uma ou mais imagens para PDF."""
    # Garantir que todas as imagens são RGB (sem transparência)
    processed = []
    temp_files = []
    
    for img_path in image_paths:
        img = Image.open(img_path)
        if img.mode in ("RGBA", "LA", "P"):
            # Converter para RGB com fundo branco
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            tmp = img_path + "_converted.jpg"
            bg.save(tmp, "JPEG", quality=95)
            processed.append(tmp)
            temp_files.append(tmp)
        else:
            processed.append(img_path)
    
    with open(output_path, "wb") as f:
        f.write(img2pdf.convert(processed))
    
    # Limpar temporários
    for tmp in temp_files:
        os.remove(tmp)
    
    return output_path
```

---

## 5. Texto Puro: .txt

**Ferramenta: reportlab** (controle total de layout)

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_LEFT

def txt_to_pdf(input_path: str, output_path: str, title: str = "") -> str:
    with open(input_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontName="Helvetica", fontSize=11, leading=16,
        alignment=TA_LEFT
    )
    
    story = []
    if title:
        story.append(Paragraph(title, styles["Title"]))
        story.append(Spacer(1, 0.5*cm))
    
    for line in content.split("\n"):
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(escaped or "&nbsp;", body_style))
    
    doc.build(story)
    return output_path
```

---

## 6. CSV / Tabelas: .csv, .tsv

**Ferramenta: pandas + reportlab** (tabela formatada no PDF)

```python
import pandas as pd
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def csv_to_pdf(input_path: str, output_path: str, title: str = "") -> str:
    sep = "\t" if input_path.endswith(".tsv") else ","
    df = pd.read_csv(input_path, sep=sep)
    
    # Usar landscape se muitas colunas
    pagesize = landscape(A4) if len(df.columns) > 6 else A4
    doc = SimpleDocTemplate(output_path, pagesize=pagesize,
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []
    
    if title:
        story.append(Paragraph(title, styles["Title"]))
        story.append(Spacer(1, 0.5*cm))
    
    # Montar dados da tabela
    data = [list(df.columns)] + df.fillna("").astype(str).values.tolist()
    
    # Largura automática das colunas
    page_width = pagesize[0] - 3*cm
    col_width = page_width / len(df.columns)
    
    table = Table(data, colWidths=[col_width] * len(df.columns), repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#2D6A9F")),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.white),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  9),
        ("FONTSIZE",    (0, 1), (-1, -1), 8),
        ("ALIGN",       (0, 0), (-1, -1), "LEFT"),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF4FB")]),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    doc.build(story)
    return output_path
```

---

## Função de Dispatch Universal

Use esta função para detectar o formato e chamar a estratégia correta:

```python
import os

def convert_to_pdf(input_path: str, output_dir: str = None) -> str:
    """Detecta o formato e converte automaticamente para PDF."""
    if output_dir is None:
        output_dir = os.path.dirname(input_path) or "."
    os.makedirs(output_dir, exist_ok=True)
    
    ext = os.path.splitext(input_path)[1].lower()
    base = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(output_dir, f"{base}.pdf")
    
    OFFICE_EXTS   = {".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
                     ".odt", ".ods", ".odp", ".rtf"}
    IMAGE_EXTS    = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp"}
    
    if ext in OFFICE_EXTS:
        return office_to_pdf(input_path, output_dir)
    elif ext in {".html", ".htm"}:
        return html_to_pdf(input_path, output_path)
    elif ext in {".md", ".markdown"}:
        return markdown_to_pdf(input_path, output_path)
    elif ext in IMAGE_EXTS:
        return images_to_pdf([input_path], output_path)
    elif ext == ".txt":
        return txt_to_pdf(input_path, output_path)
    elif ext in {".csv", ".tsv"}:
        return csv_to_pdf(input_path, output_path)
    else:
        # Tentar LibreOffice como fallback genérico
        return office_to_pdf(input_path, output_dir)
```

---

## Workflow Padrão

1. **Identificar** o arquivo de entrada (verificar em `/mnt/user-data/uploads/` se veio por upload).
2. **Selecionar** a estratégia com base na extensão (tabela no topo).
3. **Instalar dependências** se necessário (ver seção abaixo).
4. **Executar** a conversão e salvar em `/home/claude/`.
5. **Copiar** o PDF final para `/mnt/user-data/outputs/`.
6. **Apresentar** com `present_files`.

---

## Instalação de Dependências

```bash
# img2pdf e Pillow (imagens)
pip install img2pdf Pillow --break-system-packages

# pandas (CSV)
pip install pandas --break-system-packages

# reportlab (txt/csv)
pip install reportlab --break-system-packages

# LibreOffice, wkhtmltopdf e pandoc já vêm pré-instalados no ambiente
```

---

## Problemas Comuns e Soluções

| Problema | Solução |
|---|---|
| LibreOffice trava ou timeout | Adicionar `--norestore --nofirststartwizard` aos args |
| Fontes faltando no Office | Copiar fontes TTF para `~/.fonts/` e rodar `fc-cache -f` |
| Imagem RGBA (transparência) | Converter para RGB com fundo branco antes de converter |
| wkhtmltopdf erro de SSL | Adicionar `--disable-smart-shrinking --no-stop-slow-scripts` |
| CSV com encoding errado | Detectar encoding com `chardet` antes de abrir |
| PDF gerado vazio | Verificar se o arquivo de entrada não está corrompido |
| Arquivo sem extensão | Usar `python-magic` para detectar MIME type |