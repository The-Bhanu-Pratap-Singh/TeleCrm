import fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const oldExport = `  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('dashboard-report.pdf');
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      console.error('EXPORT_ERROR:', err);
      alert('Failed to generate PDF: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };`;

const newExport = `  const exportPDF = () => {
    // We use the native browser print dialog, which allows users to "Save as PDF".
    // This produces high-quality, searchable vector PDFs instead of blurry canvas images,
    // and properly handles SVG charts and cross-origin iframe security restrictions.
    window.print();
  };`;

code = code.replace(oldExport, newExport);

// Also let's add .no-print to the export button so it doesn't show up in the PDF
code = code.replace(
  'onClick={exportPDF}',
  'onClick={exportPDF}\n          className="no-print flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm"'
);
// wait, if I replace onClick={exportPDF}, it might mess up existing classNames. 
// let's just do a simpler replace.
