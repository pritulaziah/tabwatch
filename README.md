# TabWatch

A Chrome extension that tracks time spent on websites by domain. All data
stays on your machine.

## Description

TabWatch records the time you spend on websites. The extension groups the
time by registrable domain and reports it for the current day, week, month,
and year.

The extension is for people who want usage statistics and who do not want
to send browsing data to a server. TabWatch keeps every record in
`chrome.storage.local` on your computer. It makes no network requests,
collects no telemetry, and needs no account.

Chrome asks for the *Read your browsing history* permission. TabWatch uses
this permission only to read the URL of the active tab.

## Installation

TabWatch is not published in the Chrome Web Store. Build the extension
from source.

Requirements:

- Google Chrome 120 or later
- Node.js 22 or later with npm

Steps:

1. Clone the repository and open the project directory in a terminal.
2. Run `npm install`.
3. Run `npm run build`. The build writes the extension to the `dist`
   directory.
4. Open `chrome://extensions` in Chrome.
5. Turn on **Developer mode**.
6. Click **Load unpacked** and select the `dist` directory.
7. Pin the TabWatch icon to the toolbar.

## Quick Start

1. Open a website and leave the tab in the foreground for at least one
   minute. TabWatch writes the time to storage every 30 seconds.
2. Click the TabWatch icon in the toolbar. The popup shows the time for
   today, the change against yesterday, and the five most visited domains.
3. Click **View all sites**. The dashboard opens on the **Overview**
   screen, with the metric cards, the **Activity** chart, and the **Top
   sites** table.
4. Click **Settings** in the sidebar to open the **Appearance**,
   **Limits**, and **Data** sections.
5. To set a limit, type a domain and the number of minutes per day, then
   click **Add limit**.

## Features

- Tracks the active tab of the focused Chrome window and groups the time
  by registrable domain. Tracking pauses when you switch tabs, leave
  Chrome, or open a page that is not http or https.
- Reports the total time for the current day, week, month, and year, and
  compares each period with the previous one.
- Shows an activity chart by hour or by day. The chart shows the five most
  visited domains and groups the other domains as `Other`.
- Sets a daily limit in minutes for one domain. A progress bar shows the
  status **Within limit**, **Nearing limit**, or **Over limit**. A limit
  does not block a site.
- Exports all data to a JSON file and imports the file back. An import can
  merge the file into the current data or replace the data.
- Applies a light or a dark theme, or follows the system theme.

## Documentation

- [DEVELOPMENT.md](DEVELOPMENT.md) — set up a development environment, run
  the checks, and understand the code layout
- [CONTRIBUTING.md](CONTRIBUTING.md) — report a problem or propose a change

## License

MIT — see [LICENSE](LICENSE).
