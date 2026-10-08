import * as XLSX from 'xlsx';
import type { CommissionRate } from '../types';

export const exportToExcel = (rates: CommissionRate[], filename = 'Basechan_Commission_Rates.xlsx') => {
  const exportData = rates.map((r) => ({
    'University Name': r.universityName,
    'School Guidance Status': r.guidance || 'ALLOWED',
    'Intake': r.intake,
    'Study Level': r.studyLevel,
    'Aggregator / Portal': r.aggregator,
    'Master Rate': r.isFlatFee ? `£${r.masterRate}` : `${r.masterRate}%`,
    'Agent Rate': r.isFlatFee ? `£${r.agentRate}` : `${r.agentRate}%`,
    'Profit Margin': r.isFlatFee ? `£${r.diffMargin}` : `${r.diffMargin}%`,
    'Country': r.country || 'UK',
    'Updated At': r.updatedAt || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Commission Rates');
  XLSX.writeFile(workbook, filename);
};

export const exportToCSV = (rates: CommissionRate[], filename = 'Basechan_Commission_Rates.csv') => {
  const exportData = rates.map((r) => ({
    'University Name': r.universityName,
    'School Guidance Status': r.guidance || 'ALLOWED',
    'Intake': r.intake,
    'Study Level': r.studyLevel,
    'Aggregator / Portal': r.aggregator,
    'Master Rate': r.isFlatFee ? `£${r.masterRate}` : `${r.masterRate}%`,
    'Agent Rate': r.isFlatFee ? `£${r.agentRate}` : `${r.agentRate}%`,
    'Profit Margin': r.isFlatFee ? `£${r.diffMargin}` : `${r.diffMargin}%`,
    'Country': r.country || 'UK',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
};

export const printSchedule = (rates: CommissionRate[], title = 'Basechan Commission Schedule') => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const rowsHtml = rates
    .map(
      (r) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${r.universityName}</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.guidance || 'ALLOWED'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.intake}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.studyLevel}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.aggregator}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;">${
        r.isFlatFee ? `£${r.agentRate}` : `${r.agentRate}%`
      }</td>
    </tr>
  `
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
          th { background: #f8fafc; padding: 10px; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Basechan International · Generated ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>University Name</th>
              <th>Status</th>
              <th>Intake</th>
              <th>Level</th>
              <th>Portal</th>
              <th>Commission Rate</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};
