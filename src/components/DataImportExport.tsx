// src/components/DataImportExport.tsx
import { useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import * as Papa from 'papaparse';
// @ts-ignore
import { saveAs } from 'file-saver';
import { api } from '../lib/api';
import type { CustomerNew } from '../lib/database.types';

interface DataImportExportProps {
  customers: CustomerNew[];
  onImportSuccess: () => void;
  onClose: () => void;
}

export function DataImportExport({
  customers,
  onImportSuccess,
  onClose,
}: DataImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // 导出数据
  const handleExport = () => {
    setExporting(true);
    try {
      const exportData = customers.map((c) => ({
        Name: c.name,
        Email: c.email,
        Phone: c.phone || '',
        Company: c.company || '',
        'Street Address': c.street_address || '',
        City: c.city || '',
        'State/Province': c.state_province || '',
        'Postal Code': c.postal_code || '',
        Country: c.country || '',
        'Amount Owed': c.amount_owed,
        'Due Date': c.due_date || '',
        'Total Orders': c.total_orders,
        'Avg Order Value': c.average_order_value,
        'Last Purchase': c.last_purchase_date || '',
        'High Risk Industry': c.is_high_risk_industry ? 'Yes' : 'No',
        Tags: c.tags ? c.tags.join(', ') : '',
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = () => {
    const template = [
      {
        Name: 'John Smith',
        Email: 'john@example.com',
        Phone: '+61 412 345 678',
        Company: 'Example Co',
        'Street Address': '123 George St',
        City: 'Sydney',
        'State/Province': 'NSW',
        'Postal Code': '2000',
        Country: 'Australia',
        'Amount Owed': '1000',
        'Due Date': '2026-03-31',
        'Total Orders': '5',
        'Avg Order Value': '200',
        'Last Purchase': '2026-02-01',
        'High Risk Industry': 'No',
        Tags: 'vip,regular',
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'customer_import_template.csv');
  };

  // 处理上传的文件
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<any>) => {
        // 添加类型
        setPreviewData(results.data.slice(0, 5));
        setShowPreview(true);
      },
      error: (error: Error) => {
        // 添加类型
        console.error('Parse error:', error);
        alert('Failed to parse CSV file');
      },
    });
  };

  // 导入数据
  const handleImport = async () => {
    if (!previewData.length) return;

    setImporting(true);
    try {
      const importData = previewData.map((row) => {
        const rowData = row as any;
        return {
          name: rowData.Name || rowData.name || '',
          email: rowData.Email || rowData.email || '',
          phone: rowData.Phone || rowData.phone || null,
          company: rowData.Company || rowData.company || null,
          street_address: rowData['Street Address'] || rowData.street_address || null,
          city: rowData.City || rowData.city || null,
          state_province: rowData['State/Province'] || rowData.state_province || null,
          postal_code: rowData['Postal Code'] || rowData.postal_code || null,
          country: rowData.Country || rowData.country || null,
          amount_owed: parseFloat(rowData['Amount Owed'] || rowData.amount_owed) || 0,
          due_date: rowData['Due Date'] || rowData.due_date || null,
          total_orders: parseInt(rowData['Total Orders'] || rowData.total_orders) || 0,
          average_order_value:
            parseFloat(rowData['Avg Order Value'] || rowData.average_order_value) || 0,
          last_purchase_date: rowData['Last Purchase'] || rowData.last_purchase_date || null,
          is_high_risk_industry: (rowData['High Risk Industry'] || '').toLowerCase() === 'yes',
          tags: rowData.Tags ? String(rowData.Tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        };
      });

      await api.customers.import(importData);

      alert('Data imported successfully!');
      setShowPreview(false);
      onImportSuccess();
      onClose();
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Import/Export Data</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Export Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Export Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Download all your customer data as a CSV file.
            </p>
            <button
              onClick={handleExport}
              disabled={exporting || customers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            {customers.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">No data to export</p>
            )}
          </div>

          {/* Import Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Import Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file with your customer data.{' '}
              <button onClick={handleDownloadTemplate} className="text-blue-600 hover:underline">
                Download template
              </button>
            </p>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Preview Section */}
          {showPreview && previewData.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Preview (First 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200">
                      {Object.keys(previewData[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-600"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        {Object.values(row as any).map((val: any, j) => (
                          <td key={j} className="px-3 py-2 text-xs text-gray-800">
                            {String(val).substring(0, 20)}
                            {String(val).length > 20 ? '...' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
