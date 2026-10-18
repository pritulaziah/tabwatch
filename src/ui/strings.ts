import { formatDuration } from '@/shared/format';
import type { ImportMode } from '@/shared/transfer';
import type { Period, Settings } from '@/shared/types';
import type { LimitLevel } from '@/ui/limits';

/**
 * Interface strings in one module. A translation will be added here.
 * The components hold no copy literals.
 */
export const strings = {
  appName: 'TabWatch',
  periods: {
    today: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
  } satisfies Record<Period, string>,
  periodSegmentsLabel: 'Period',
  today: 'Today',
  viewAllSites: 'View all sites',
  percent: (value: number): string => `${value}%`,
  totalTime: 'Total time',
  avgPerDay: 'Avg per day',
  daysTracked: 'Days tracked',
  activity: 'Activity',
  otherSeries: 'Other',
  granularityLabel: 'Granularity',
  granularity: {
    hour: 'Hour',
    day: 'Day',
  } satisfies Record<'hour' | 'day', string>,
  newSites: (count: number): string => `${count} new`,
  previousComparison: (diffSeconds: number): string =>
    `${diffSeconds >= 0 ? '+' : '-'}${formatDuration(Math.abs(diffSeconds))} vs previous period`,
  sitesVisited: 'Sites visited',
  overLimit: 'Over limit',
  noActivity: 'No activity yet',
  topSites: 'Top sites',
  table: {
    rank: '#',
    website: 'Website',
    time: 'Time',
    share: '% of period',
  },
  searchLabel: 'Search domain',
  reset: 'Reset',
  storageError: "Couldn't read local data",
  overview: 'Overview',
  settings: 'Settings',
  statistics: 'Statistics',
  appearanceSection: 'Appearance',
  limitsSection: 'Limits',
  themes: {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  } satisfies Record<Settings['theme'], string>,
  toggleTheme: 'Toggle theme',
  noLimits: 'No limits set',
  domainLabel: 'Domain',
  minutesLabel: 'Minutes per day',
  addLimit: 'Add limit',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  editLabel: (domain: string): string => `Edit ${domain}`,
  deleteLabel: (domain: string): string => `Delete ${domain}`,
  shareLabel: (domain: string): string => `${domain} time share`,
  limitLabel: (domain: string): string => `${domain} daily limit`,
  limitCaption: (spentSeconds: number, limitSeconds: number): string =>
    `${formatDuration(spentSeconds)} / ${formatDuration(limitSeconds)}`,
  limitStatus: {
    normal: 'Within limit',
    warning: 'Nearing limit',
    over: 'Over limit',
  } satisfies Record<LimitLevel, string>,
  openLimitSettings: (domain: string, seconds: number): string =>
    `Limit settings for ${domain}, ${formatDuration(seconds)}`,
  dataSection: 'Data',
  exportData: 'Export',
  importModeLabel: 'Import mode',
  importModes: {
    merge: 'Merge',
    replace: 'Replace',
  } satisfies Record<ImportMode, string>,
  importFileLabel: 'Import file',
  mergeWarning:
    'Merge adds the file to existing data. Importing the same file twice doubles the time.',
  reportTitle: 'Import report',
  reportDays: (count: number): string => `Days: ${count}`,
  reportDomains: (count: number): string => `Domains: ${count}`,
  reportTime: (seconds: number): string => `Time: ${formatDuration(seconds)}`,
  reportDropped: (count: number): string => `Dropped records: ${count}`,
  importDamaged: 'Invalid file',
  importNewerVersion: 'File is from a newer version',
  clearData: 'Clear data',
  clearConfirm: 'Delete all days and limits? Settings are kept.',
  dataNote: 'Data stays on this machine. Each Chrome profile has its own data.',
  exportPrivacyNote: 'Export files contain your domains and time. Keep them private.',
  permissionsNote:
    'The "Read your browsing history" permission is used only to read the URL of the active tab.',
  transferError: "Couldn't read or write local data",
};
