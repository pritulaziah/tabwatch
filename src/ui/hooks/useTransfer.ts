import { useState } from 'react';

import {
  beginMaintenance,
  endMaintenance,
  getAllDays,
  getDayKeys,
  getLimits,
  getSettings,
  removeDays,
  setDays,
  setLimits,
} from '@/background/store';
import {
  buildExport,
  exportFileName,
  mergeImport,
  parseImport,
  replaceImport,
} from '@/shared/transfer';
import type { ImportError, ImportMode, ImportReport } from '@/shared/transfer';

/**
 * State of the data transfer block: operation flags, errors, and the
 * import report.
 */
export interface TransferState {
  exporting: boolean;
  importing: boolean;
  error: boolean;
  importError: ImportError | null;
  report: ImportReport | null;
  runExport(): Promise<void>;
  runImport(file: File, mode: ImportMode): Promise<void>;
  clearData(): Promise<boolean>;
}

/**
 * Gives the text to the browser as a file: a Blob, an object URL, and a
 * click on the link.
 */
function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Data transfer: export of the days, limits, and settings, import in the
 * Merge and Replace modes, and clearing of the days and limits. The
 * settings screen uses this hook. A read or write error gives a console
 * message and the flag for the banner. The shown data does not change.
 * The bulk writes hold the worker commits through the maintenance marker,
 * so a 30 s commit does not overwrite the imported days.
 */
export function useTransfer(): TransferState {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(false);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const runExport = async (): Promise<void> => {
    setExporting(true);
    setError(false);
    try {
      const [days, limits, settings] = await Promise.all([
        getAllDays(),
        getLimits(),
        getSettings(),
      ]);
      // One time value for the file build and the name. They belong to
      // one export.
      const now = Date.now();
      const file = buildExport(days, limits, settings, now);
      downloadText(exportFileName(now), JSON.stringify(file, null, 2));
    } catch (exportError) {
      console.error('[tabwatch] failed to export data', exportError);
      setError(true);
    } finally {
      setExporting(false);
    }
  };

  const runImport = async (file: File, mode: ImportMode): Promise<void> => {
    setImporting(true);
    setError(false);
    setImportError(null);
    setReport(null);
    try {
      const parsed = parseImport(await file.text());
      if (!parsed.ok) {
        // Validation failure is an expected result: a UI message, and no
        // console entry.
        setImportError(parsed.error);
        return;
      }
      // The marker holds the worker commits: the read below and the writes
      // after it must not interleave with a commit.
      await beginMaintenance();
      try {
        const [days, limits] = await Promise.all([getAllDays(), getLimits()]);
        const outcome =
          mode === 'merge'
            ? mergeImport({ days, limits }, parsed.data, parsed.droppedRecords)
            : replaceImport(parsed.data, parsed.droppedRecords);
        await setDays(outcome.days);
        if (mode === 'replace') {
          // Replace removes the days that are not in the file. Merge keeps
          // them. The keys come from the storage as they are: a damaged day
          // must also disappear.
          const dayKeys = await getDayKeys();
          await removeDays(dayKeys.filter((day) => !Object.hasOwn(outcome.days, day)));
        }
        await setLimits(outcome.limits);
        setReport(outcome.report);
      } finally {
        await endMaintenance();
      }
    } catch (importFailure) {
      console.error('[tabwatch] failed to import data', importFailure);
      setError(true);
    } finally {
      setImporting(false);
    }
  };

  const clearData = async (): Promise<boolean> => {
    setError(false);
    setReport(null);
    setImportError(null);
    try {
      await beginMaintenance();
      try {
        await removeDays(await getDayKeys());
        await setLimits({});
      } finally {
        await endMaintenance();
      }
      return true;
    } catch (clearError) {
      console.error('[tabwatch] failed to clear data', clearError);
      setError(true);
      return false;
    }
  };

  return { exporting, importing, error, importError, report, runExport, runImport, clearData };
}
