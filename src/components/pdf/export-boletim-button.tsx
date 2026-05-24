"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText } from "lucide-react";
import type { BoletimData } from "@/lib/data/pedagogico";

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}

async function urlToDataUrl(url: string | null): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 100, h: 100 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function formatEndereco(e: BoletimData["escola"]): string {
  const parts = [
    e.endereco,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade ?? e.uf,
    e.cep ? `CEP ${e.cep}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function imgFitInBox(orig: { w: number; h: number }, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / orig.w, maxH / orig.h);
  return { w: orig.w * ratio, h: orig.h * ratio };
}

export function ExportBoletimButton({
  boletim,
  fotoUrl,
  logoUrl,
}: {
  boletim: BoletimData;
  fotoUrl?: string | null;
  logoUrl?: string | null;
}) {
  async function exportPdf() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    const [logo, foto] = await Promise.all([
      urlToDataUrl(logoUrl ?? null),
      urlToDataUrl(fotoUrl ?? null),
    ]);

    // ============ HEADER ============
    const headerY = 12;

    // Logo (esquerda)
    if (logo) {
      const box = imgFitInBox(logo, 25, 20);
      doc.addImage(logo.data, "PNG", 15, headerY, box.w, box.h, undefined, "FAST");
    }

    // Título centro
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("BOLETIM ESCOLAR", pageW / 2, headerY + 10, { align: "center" });

    // Dados da escola (direita)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(boletim.escola.nome, pageW - 15, headerY + 4, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let yE = headerY + 9;
    if (boletim.escola.cnpj) {
      doc.text(`CNPJ: ${boletim.escola.cnpj}`, pageW - 15, yE, { align: "right" });
      yE += 4;
    }
    if (boletim.escola.email) {
      doc.text(boletim.escola.email, pageW - 15, yE, { align: "right" });
      yE += 4;
    }
    if (boletim.escola.telefone) {
      doc.text(boletim.escola.telefone, pageW - 15, yE, { align: "right" });
      yE += 4;
    }
    const endereco = formatEndereco(boletim.escola);
    if (endereco) {
      doc.text(endereco, pageW - 15, yE, { align: "right" });
    }

    // Linha separadora
    doc.setDrawColor(180);
    doc.setLineWidth(0.4);
    doc.line(15, headerY + 30, pageW - 15, headerY + 30);

    // ============ CARD DO ALUNO ============
    const cardY = headerY + 34;
    const cardH = 28;
    const cardX = 15;
    const cardW = pageW - 30;

    doc.setDrawColor(140);
    doc.setLineWidth(0.3);
    doc.rect(cardX, cardY, cardW, cardH);

    // Foto aluno (à esquerda, dentro do card)
    if (foto) {
      const fbox = imgFitInBox(foto, 22, 24);
      const fx = cardX + 2 + (22 - fbox.w) / 2;
      const fy = cardY + 2 + (24 - fbox.h) / 2;
      doc.addImage(foto.data, "JPEG", fx, fy, fbox.w, fbox.h, undefined, "FAST");
    }

    // Dados aluno (texto à direita da foto)
    const infoX = cardX + 28;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Aluno(a):", infoX, cardY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(boletim.aluno.nome, infoX + 14, cardY + 5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Curso:", infoX, cardY + 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${boletim.matricula.serie} - Turma ${boletim.matricula.turma}`,
      infoX + 14,
      cardY + 11,
    );

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Segmento:", infoX, cardY + 17);
    doc.setFont("helvetica", "normal");
    doc.text(boletim.matricula.segmento, infoX + 18, cardY + 17);

    // Coluna direita do card
    const rightX = pageW - 17;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Matrícula:", rightX - 28, cardY + 5);
    doc.setFont("helvetica", "normal");
    doc.text(boletim.aluno.matriculaCodigo ?? "—", rightX, cardY + 5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Ano letivo:", rightX - 28, cardY + 11);
    doc.setFont("helvetica", "normal");
    doc.text(String(boletim.matricula.anoLetivo), rightX, cardY + 11, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Emissão:", rightX - 28, cardY + 17);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("pt-BR"), rightX, cardY + 17, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text("Resultado:", infoX, cardY + 23);
    doc.setFont("helvetica", "normal");
    doc.text("Cursando", infoX + 18, cardY + 23);

    // ============ TABELA NOTAS ============
    const bodyNotas = boletim.disciplinas.map((d) => {
      const situacao =
        d.mediaAnual === null ? "—" : d.mediaAnual >= 6 ? "Aprovado" : "Reprovado";
      return [
        d.disciplina,
        fmt(d.bimestres[0]?.media ?? null),
        fmt(d.bimestres[1]?.media ?? null),
        fmt(d.bimestres[2]?.media ?? null),
        fmt(d.bimestres[3]?.media ?? null),
        d.mediaAnual !== null ? d.mediaAnual.toFixed(2) : "—",
        situacao,
      ];
    });

    autoTable(doc, {
      startY: cardY + cardH + 4,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [120, 120, 120],
        lineWidth: 0.2,
        textColor: 20,
        halign: "center",
      },
      headStyles: {
        fillColor: [27, 63, 184], // brand color
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        fontSize: 9,
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 55 },
        5: { fontStyle: "bold" },
        6: { halign: "center" },
      },
      head: [["Disciplina", "1º Bim", "2º Bim", "3º Bim", "4º Bim", "Anual", "Situação"]],
      body:
        bodyNotas.length > 0
          ? bodyNotas
          : [
              [
                {
                  content: "Nenhuma nota lançada",
                  colSpan: 7,
                  styles: { halign: "center", textColor: 140 },
                },
              ],
            ],
      didParseCell: (data) => {
        if (data.section !== "body") return;
        // Colorir cell de situação
        if (data.column.index === 6) {
          const txt = String(data.cell.raw ?? "");
          if (txt === "Aprovado") {
            data.cell.styles.textColor = [16, 122, 79];
            data.cell.styles.fontStyle = "bold";
          } else if (txt === "Reprovado") {
            data.cell.styles.textColor = [200, 50, 50];
            data.cell.styles.fontStyle = "bold";
          }
        }
        // Colorir notas baixas
        if (data.column.index >= 1 && data.column.index <= 5) {
          const txt = String(data.cell.raw ?? "");
          const num = Number(txt);
          if (Number.isFinite(num) && num < 6) {
            data.cell.styles.textColor = [200, 50, 50];
          }
        }
      },
    });

    // ============ FREQUÊNCIA ============
    const f = boletim.frequencia;
    autoTable(doc, {
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [120, 120, 120],
        lineWidth: 0.2,
        textColor: 20,
      },
      headStyles: {
        fillColor: [27, 63, 184],
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
      },
      head: [["Frequência", "Valor"]],
      body: [
        ["Total de dias com registro", String(f.totalDias)],
        ["Presenças", String(f.presencas)],
        ["Faltas", String(f.faltas)],
        ["Taxa de presença", `${(f.taxa * 100).toFixed(1)}%`],
      ],
      columnStyles: {
        1: { halign: "right", fontStyle: "bold" },
      },
    });

    // ============ ASSINATURAS ============
    const pageH = doc.internal.pageSize.getHeight();
    const assY = pageH - 35;

    doc.setDrawColor(80);
    doc.setLineWidth(0.3);
    // Linha esquerda
    doc.line(25, assY, 90, assY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Direção", 57.5, assY + 4, { align: "center" });
    // Linha direita
    doc.line(pageW - 90, assY, pageW - 25, assY);
    doc.text("Secretaria", pageW - 57.5, assY + 4, { align: "center" });

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
    doc.text(boletim.escola.nome, pageW / 2, pageH - 5, { align: "center" });

    const nomeArquivo = `boletim_${boletim.aluno.nome.replace(/\s+/g, "_")}_${boletim.matricula.anoLetivo}.pdf`;
    doc.save(nomeArquivo);
  }

  return (
    <button type="button" onClick={exportPdf} className="ds-button ds-button-primary">
      <FileText size={14} /> Exportar PDF
    </button>
  );
}
