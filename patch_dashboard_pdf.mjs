import fs from 'fs';
const file = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(file, 'utf-8');

// 1. Add imports
code = code.replace('import { BarChart', 'import jsPDF from \'jspdf\';\nimport html2canvas from \'html2canvas\';\nimport { BarChart');
code = code.replace('Users, CalendarClock } from \'lucide-react\';', 'Users, CalendarClock, Download } from \'lucide-react\';');

// 2. Add ref and export function
const exportFunc = `
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
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
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };
`;

code = code.replace('const [activityFilter', exportFunc + '\n  const [activityFilter');
code = code.replace('import { useEffect, useState, useMemo }', 'import React, { useEffect, useState, useMemo }');

// 3. Add button to header and apply ref
const headerTarget = `    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Welcome back, {user.username}</h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Here is what's happening with your leads today.</p>
      </div>`;

const headerReplacement = `    <div className="space-y-4 sm:space-y-6" ref={dashboardRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Welcome back, {user.username}</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Here is what's happening with your leads today.</p>
        </div>
        <button 
          onClick={exportPDF} 
          disabled={isExporting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isExporting ? <span className="animate-spin text-sm">...</span> : <Download className="w-4 h-4" />}
          {isExporting ? 'Generating...' : 'Export Report'}
        </button>
      </div>`;

code = code.replace(headerTarget, headerReplacement);

fs.writeFileSync(file, code);
console.log('Patched Dashboard for PDF Export');
