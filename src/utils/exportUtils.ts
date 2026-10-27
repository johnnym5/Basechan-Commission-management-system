import * as XLSX from 'xlsx';
import type { CommissionRate, UserRole } from '../types';

export interface ExportWorkbookOptions {
  rates: CommissionRate[];
  role: UserRole;
  currency?: string;
  customFilename?: string;
}

export const exportMultiSheetRoleWorkbook = ({
  rates,
  role,
  currency = 'GBP',
  customFilename,
}: ExportWorkbookOptions) => {
  if (!rates || rates.length === 0) return;

  // 1. Group rates by Country (e.g. 'UK', 'Canada', 'USA', 'Australia', etc.)
  const countryMap = new Map<string, CommissionRate[]>();
  rates.forEach((r) => {
    const countryName = (r.country || 'UK').trim();
    if (!countryMap.has(countryName)) {
      countryMap.set(countryName, []);
    }
    countryMap.get(countryName)!.push(r);
  });

  const workbook = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().split('T')[0];

  // 2. Build a dedicated worksheet for each country
  countryMap.forEach((countryRates, countryName) => {
    const sheetTabName = countryName.replace(/[:\\/?*\[\]]/g, '').slice(0, 30) || 'Rates';

    const rowData = countryRates.map((r) => {
      const isFlat = r.isFlatFee;
      const fmtVal = (num: number) =>
        isFlat ? `${currency} ${num.toLocaleString()}` : `${num}%`;

      if (role === 'ADMIN') {
        return {
          'University Name': r.universityName,
          'Country': r.country || 'UK',
          'Intake': r.intake,
          'Study Level': r.studyLevel,
          'Application Portal': r.aggregator || 'Direct',
          'Status Guidance': r.guidance || 'ALLOWED',
          'Master Rate': fmtVal(r.masterRate),
          'Sub-Agent Payout': fmtVal(r.agentRate),
          'Net Profit Margin': fmtVal(r.diffMargin),
          'Type': isFlat ? 'Fixed Fee' : 'Percentage',
          'Notes': r.notes || '',
        };
      }

      if (role === 'STAFF') {
        return {
          'University Name': r.universityName,
          'Country': r.country || 'UK',
          'Intake': r.intake,
          'Study Level': r.studyLevel,
          'Application Portal': r.aggregator || 'Direct',
          'Status Guidance': r.guidance || 'ALLOWED',
        };
      }

      // AGENT Role (Columns strictly sanitized for sub-agents)
      return {
        'University Name': r.universityName,
        'Country': r.country || 'UK',
        'Intake': r.intake,
        'Study Level': r.studyLevel,
        'Your Guaranteed Commission': fmtVal(r.agentRate),
        'Type': isFlat ? 'Fixed Fee' : 'Percentage',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rowData);

    // Auto-fit column widths for clean readability
    if (rowData.length > 0) {
      const colWidths = Object.keys(rowData[0]).map((key) => ({
        wch: Math.max(key.length, 18),
      }));
      worksheet['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTabName);
  });

  const roleLabel = role === 'ADMIN' ? 'Admin' : role === 'STAFF' ? 'Staff' : 'Agent';
  const fileName = customFilename || `Basechan_Commission_Directory_${roleLabel}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
};

export const exportToExcel = (rates: CommissionRate[], filename = 'Basechan_Commission_Rates.xlsx') => {
  exportMultiSheetRoleWorkbook({
    rates,
    role: 'ADMIN',
    customFilename: filename,
  });
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
