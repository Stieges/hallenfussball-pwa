import { getStorageQuota } from './StorageFactory';

export interface QuotaStatus {
    usage: number;
    quota: number;
    percentage: number;
    isWarning: boolean;
    isCritical: boolean;
}

const WARNING_THRESHOLD = 80; // 80%
const CRITICAL_THRESHOLD = 95; // 95%

/**
 * Get current storage quota status with warning levels.
 * Returns null if quota API is not supported.
 */
export async function getQuotaStatus(): Promise<QuotaStatus | null> {
    const quota = await getStorageQuota();

    if (!quota) {
        return null;
    }

    const percentage = quota.quota > 0 ? (quota.usage / quota.quota) * 100 : 0;

    return {
        usage: quota.usage,
        quota: quota.quota,
        percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
        isWarning: percentage >= WARNING_THRESHOLD,
        isCritical: percentage >= CRITICAL_THRESHOLD,
    };
}

/**
 * Log storage quota status to console (for debugging).
 */
export async function logQuotaStatus(): Promise<void> {
    const status = await getQuotaStatus();

    if (!status) {
        // eslint-disable-next-line no-console
        console.log('📊 Storage Quota: API not supported');
        return;
    }

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) { return `${bytes} B`; }
        if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
        if (bytes < 1024 * 1024 * 1024) { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    const icon = status.isCritical ? '🔴' : status.isWarning ? '🟡' : '🟢';
    // eslint-disable-next-line no-console
    console.log(
        `${icon} Storage: ${formatBytes(status.usage)} / ${formatBytes(status.quota)} (${status.percentage.toFixed(1)}%)`
    );
}
