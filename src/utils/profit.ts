export function toDisplayProfitPercent(profitPct?: number, profitRatio?: number): number {
    if (typeof profitRatio === 'number' && Number.isFinite(profitRatio)) {
        return profitRatio * 100;
    }
    if (typeof profitPct === 'number' && Number.isFinite(profitPct)) {
        return profitPct;
    }
    return 0;
}
