/**
 * Helper for loading the PDF export libraries (jspdf + html2canvas) on
 * demand. These libraries are large (jspdf ~390KB, html2canvas ~200KB)
 * and are only needed when the user actually triggers a PDF export, so
 * we keep them out of the initial bundle by importing them lazily here.
 */
export type LoadedPdfLibs = {
  jsPDF: typeof import('jspdf').default;
  html2canvas: typeof import('html2canvas').default;
};

export async function loadPdfLibs(): Promise<LoadedPdfLibs> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return { jsPDF, html2canvas };
}
