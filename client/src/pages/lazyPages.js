import { lazy } from 'react'

// NF-09: the QR camera library (html5-qrcode, ~360 kB) is only needed by the gate scanner
// and the canteen counter, so these two pages load in their own file when opened.
export const StaffScanPage = lazy(() => import('./staff/StaffScanPage.jsx'))
export const CounterPage = lazy(() => import('./counter/CounterPage.jsx'))
