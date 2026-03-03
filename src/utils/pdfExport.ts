import { A4_HEIGHT_MM, A4_WIDTH_MM, DrawingElement, Layer, MM_TO_PX, PAGE_MARGIN, Units } from '../context/DrawingContext';

interface ExportDrawingToPdfOptions {
  elements: DrawingElement[];
  layers: Layer[];
  units: Units;
  gridVisible: boolean;
  currentPage: number;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  pdfMode: 'all' | 'current' | 'range';
  pdfFrom: number;
  pdfTo: number;
  baseName: string;
}

const pxToMm = (px: number) => px / MM_TO_PX;

const parseColor = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

const approxTextWidthMm = (text: string, fontSizePt: number) => {
  return text.length * fontSizePt * 0.5 * 0.352778;
};

function drawPdfArc(pdf: any, cx: number, cy: number, r: number, startAngle: number, endAngle: number, ccw: boolean) {
  let sweep = endAngle - startAngle;
  if (ccw) {
    while (sweep > 0) sweep -= 2 * Math.PI;
    if (sweep === 0) sweep = -2 * Math.PI;
  } else {
    while (sweep < 0) sweep += 2 * Math.PI;
    if (sweep === 0) sweep = 2 * Math.PI;
  }
  const segments = Math.max(24, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
  const step = sweep / segments;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + i * step;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 'S');
  }
}

function getPageBounds(pageNumber: number, pageWidth: number, pageHeight: number) {
  const CANVAS_PADDING = 50;
  return {
    x: CANVAS_PADDING,
    y: CANVAS_PADDING + (pageNumber - 1) * (pageHeight + PAGE_MARGIN),
    width: pageWidth,
    height: pageHeight,
  };
}

function getPageForPoint(point: { x: number; y: number }, totalPages: number, pageWidth: number, pageHeight: number): number | null {
  for (let p = 1; p <= totalPages; p++) {
    const b = getPageBounds(p, pageWidth, pageHeight);
    if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) return p;
  }
  return null;
}

function renderElementToPdf(
  pdf: any,
  el: DrawingElement,
  pageOriginX: number,
  pageOriginY: number,
  layers: Layer[],
  units: Units
) {
  const layer = layers.find(l => l.id === el.layerId);
  if (!layer?.visible) return;
  if (el.points.length === 0) return;

  const mx = (px: number) => pxToMm(px - pageOriginX);
  const my = (py: number) => pxToMm(py - pageOriginY);
  const mLen = (px: number) => pxToMm(px);

  const [r, g, b] = parseColor(el.style.strokeColor);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(mLen(el.style.strokeWidth));
  pdf.setLineCap('round');
  pdf.setLineJoin('round');

  switch (el.type) {
    case 'line': {
      if (el.points.length < 2) break;
      const x1 = mx(el.points[0].x), y1 = my(el.points[0].y);
      const x2 = mx(el.points[1].x), y2 = my(el.points[1].y);
      pdf.line(x1, y1, x2, y2, 'S');

      const dotR = mLen(3);
      pdf.setFillColor(r, g, b);
      pdf.circle(x1, y1, dotR, 'F');
      pdf.circle(x2, y2, dotR, 'F');

      if (el.measurements?.length) {
        const angle = Math.atan2(el.points[1].y - el.points[0].y, el.points[1].x - el.points[0].x);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const offsetDistance = mLen(el.labelOffset ?? (el.style.strokeWidth * 3 + 8));
        const oX = Math.cos(angle + Math.PI / 2) * offsetDistance;
        const oY = Math.sin(angle + Math.PI / 2) * offsetDistance;
        const lengthMm = el.measurements.length / MM_TO_PX;
        const text = units === 'cm' ? `${(lengthMm / 10).toFixed(1)} cm` : `${lengthMm.toFixed(1)} mm`;
        const fontSizePt = 8;
        pdf.setFontSize(fontSizePt);
        pdf.setFont('helvetica', 'bold');
        const tw = approxTextWidthMm(text, fontSizePt);
        const th = fontSizePt * 0.352778;
        const pad = 1.2;
        const lx = midX + oX;
        const ly = midY + oY;
        pdf.setFillColor(255, 255, 255);
        pdf.rect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, 'F');
        pdf.setTextColor(0, 0, 0);
        pdf.text(text, lx, ly + th * 0.35, { align: 'center' });
      }
      break;
    }
    case 'angle': {
      if (el.points.length < 3) break;
      const [baseline, center, endpoint] = el.points;
      const cx = mx(center.x), cy = my(center.y);
      const bx = mx(baseline.x), by = my(baseline.y);
      const ex = mx(endpoint.x), ey = my(endpoint.y);

      pdf.line(bx, by, cx, cy, 'S');
      pdf.line(cx, cy, ex, ey, 'S');

      const bAngle = Math.atan2(baseline.y - center.y, baseline.x - center.x);
      const eAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);
      const sA = Math.sqrt((baseline.x - center.x) ** 2 + (baseline.y - center.y) ** 2);
      const sB = Math.sqrt((endpoint.x - center.x) ** 2 + (endpoint.y - center.y) ** 2);
      const arcRPx = Math.max(8, Math.min(40, Math.min(sA, sB) * 0.35));
      const arcR = mLen(arcRPx);
      let angleDiff = eAngle - bAngle;
      while (angleDiff < 0) angleDiff += 2 * Math.PI;
      while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;
      const side = el.selectedAngleSide;

      if (!side || side === 'primary') drawPdfArc(pdf, cx, cy, arcR, bAngle, eAngle, false);
      if (!side || side === 'secondary') drawPdfArc(pdf, cx, cy, arcR, bAngle, eAngle, true);

      if (el.measurements?.angle) {
        const primaryDeg = angleDiff * 180 / Math.PI;
        const secondaryDeg = 360 - primaryDeg;
        const midA = bAngle + angleDiff / 2;
        const tR = el.labelOffset != null ? mLen(el.labelOffset) : mLen(arcRPx + 18);
        const fontSizePt = 8;
        pdf.setFontSize(fontSizePt);
        pdf.setFont('helvetica', 'bold');
        const th = fontSizePt * 0.352778;
        const pad = 1.5;

        const drawAngleLabel = (label: string, lx: number, ly: number) => {
          const tw = approxTextWidthMm(label, fontSizePt);
          pdf.setFillColor(255, 255, 255);
          pdf.rect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, 'F');
          pdf.setDrawColor(r, g, b);
          pdf.setTextColor(0, 0, 0);
          pdf.text(label, lx, ly + th * 0.35, { align: 'center' });
        };

        if (!side || side === 'primary') drawAngleLabel(`${primaryDeg.toFixed(1)}°`, cx + Math.cos(midA) * tR, cy + Math.sin(midA) * tR);
        if (!side || side === 'secondary') drawAngleLabel(`${secondaryDeg.toFixed(1)}°`, cx + Math.cos(midA + Math.PI) * tR, cy + Math.sin(midA + Math.PI) * tR);
      }
      break;
    }
    case 'freehand': {
      if (el.points.length < 2) break;
      const pts: { x: number; y: number }[] = [{ x: mx(el.points[0].x), y: my(el.points[0].y) }];
      for (let i = 1; i < el.points.length; i++) {
        const prev = el.points[i - 1], cur = el.points[i];
        const cpx = prev.x, cpy = prev.y;
        const endx = (prev.x + cur.x) / 2, endy = (prev.y + cur.y) / 2;
        const startx = pts[pts.length - 1].x * MM_TO_PX + pageOriginX;
        const starty = pts[pts.length - 1].y * MM_TO_PX + pageOriginY;
        const steps = 6;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const ix = (1 - t) * (1 - t) * startx + 2 * (1 - t) * t * cpx + t * t * endx;
          const iy = (1 - t) * (1 - t) * starty + 2 * (1 - t) * t * cpy + t * t * endy;
          pts.push({ x: mx(ix), y: my(iy) });
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 'S');
      }
      break;
    }
    case 'text': {
      if (el.points.length === 0 || !el.text) break;
      const tx = mx(el.points[0].x);
      const ty = my(el.points[0].y);
      const fontSizePx = el.fontSize || 14;
      const fontSizePt = fontSizePx * 0.75;
      pdf.setFontSize(fontSizePt);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(r, g, b);
      pdf.text(el.text, tx, ty + fontSizePt * 0.352778, { align: 'left' });
      break;
    }
    case 'image':
      break;
  }
}

export async function exportDrawingToPdf(options: ExportDrawingToPdfOptions): Promise<number> {
  const {
    elements,
    layers,
    units,
    gridVisible,
    currentPage,
    totalPages,
    pageWidth,
    pageHeight,
    pdfMode,
    pdfFrom,
    pdfTo,
    baseName,
  } = options;

  const { jsPDF } = await import('jspdf');

  const pagesToExport: number[] = [];
  if (pdfMode === 'current') {
    pagesToExport.push(currentPage);
  } else if (pdfMode === 'range') {
    const from = Math.max(1, Math.min(pdfFrom, totalPages));
    const to = Math.max(from, Math.min(pdfTo, totalPages));
    for (let p = from; p <= to; p++) pagesToExport.push(p);
  } else {
    for (let p = 1; p <= totalPages; p++) pagesToExport.push(p);
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let idx = 0; idx < pagesToExport.length; idx++) {
    const page = pagesToExport[idx];
    if (idx > 0) pdf.addPage();

    const bounds = getPageBounds(page, pageWidth, pageHeight);

    if (gridVisible) {
      pdf.setDrawColor(232, 232, 232);
      pdf.setLineWidth(0.13);
      for (let x = 0; x <= A4_WIDTH_MM; x += 1) {
        pdf.line(x, 0, x, A4_HEIGHT_MM, 'S');
      }
      for (let y = 0; y <= A4_HEIGHT_MM; y += 1) {
        pdf.line(0, y, A4_WIDTH_MM, y, 'S');
      }

      pdf.setDrawColor(208, 208, 208);
      pdf.setLineWidth(0.26);
      for (let x = 0; x <= A4_WIDTH_MM; x += 10) {
        pdf.line(x, 0, x, A4_HEIGHT_MM, 'S');
      }
      for (let y = 0; y <= A4_HEIGHT_MM; y += 10) {
        pdf.line(0, y, A4_WIDTH_MM, y, 'S');
      }
    }

    const pageElements = elements.filter((el) => {
      if (el.points.length === 0) return false;
      return getPageForPoint(el.points[0], totalPages, pageWidth, pageHeight) === page;
    });

    for (const el of pageElements) {
      if (el.type === 'image' && el.imageSrc && el.imageWidth && el.imageHeight) {
        try {
          const imgX = pxToMm(el.points[0].x - bounds.x);
          const imgY = pxToMm(el.points[0].y - bounds.y);
          const imgW = pxToMm(el.imageWidth);
          const imgH = pxToMm(el.imageHeight);
          pdf.addImage(el.imageSrc, 'PNG', imgX, imgY, imgW, imgH);
        } catch {
          // skip broken images
        }
      }
    }

    pageElements.forEach((el) => {
      if (el.type !== 'image') {
        renderElementToPdf(pdf, el, bounds.x, bounds.y, layers, units);
      }
    });
  }

  pdf.save(`${baseName}.pdf`);
  return pagesToExport.length;
}
