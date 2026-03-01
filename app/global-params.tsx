import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';

type GlobalParams = {
    maxOpenTrades: string;
    stakeAmount: string;
    timeframe: string;
    stoplossPct: string;
    trailingStopPct: string;
};

const STORAGE_KEY = 'ft_global_params';

const DEFAULT_PARAMS: GlobalParams = {
    maxOpenTrades: '5',
    stakeAmount: '100',
    timeframe: '5m',
    stoplossPct: '5',
    trailingStopPct: '1.5',
};

export default function GlobalParamsScreen() {
    const [form, setForm] = useState<GlobalParams>(DEFAULT_PARAMS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const raw = await SecureStore.getItemAsync(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as Partial<GlobalParams>;
                    setForm({ ...DEFAULT_PARAMS, ...parsed });
                }
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const hasInvalidValues = useMemo(() => {
        const maxOpenTrades = Number(form.maxOpenTrades);
        const stakeAmount = Number(form.stakeAmount);
        const stoplossPct = Number(form.stoplossPct);
        const trailingStopPct = Number(form.trailingStopPct);
        if (!Number.isFinite(maxOpenTrades) || maxOpenTrades < 1) return true;
        if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) return true;
        if (!Number.isFinite(stoplossPct) || stoplossPct <= 0 || stoplossPct > 100) return true;
        if (!Number.isFinite(trailingStopPct) || trailingStopPct < 0 || trailingStopPct > 100) return true;
        if (!form.timeframe.trim()) return true;
        return false;
    }, [form]);

    const update = (key: keyof GlobalParams, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (isSaving || hasInvalidValues) return;
        setIsSaving(true);
        try {
            await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(form));
            Alert.alert('保存成功', '全局参数已保存。');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setForm(DEFAULT_PARAMS);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={Colors.dark.primary} />
                <Text style={styles.loadingText}>读取参数中...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>交易参数</Text>

                <Text style={styles.label}>最大同时持仓数</Text>
                <TextInput
                    style={styles.input}
                    value={form.maxOpenTrades}
                    onChangeText={(v) => update('maxOpenTrades', v)}
                    keyboardType="numeric"
                    placeholder="例如 5"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                <Text style={styles.label}>单笔仓位金额</Text>
                <TextInput
                    style={styles.input}
                    value={form.stakeAmount}
                    onChangeText={(v) => update('stakeAmount', v)}
                    keyboardType="decimal-pad"
                    placeholder="例如 100"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                <Text style={styles.label}>默认周期</Text>
                <TextInput
                    style={styles.input}
                    value={form.timeframe}
                    onChangeText={(v) => update('timeframe', v)}
                    autoCapitalize="none"
                    placeholder="例如 5m"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                <Text style={styles.label}>止损百分比（%）</Text>
                <TextInput
                    style={styles.input}
                    value={form.stoplossPct}
                    onChangeText={(v) => update('stoplossPct', v)}
                    keyboardType="decimal-pad"
                    placeholder="例如 5"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                <Text style={styles.label}>移动止损百分比（%）</Text>
                <TextInput
                    style={styles.input}
                    value={form.trailingStopPct}
                    onChangeText={(v) => update('trailingStopPct', v)}
                    keyboardType="decimal-pad"
                    placeholder="例如 1.5"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                <Text style={styles.hint}>提示：此页面用于管理移动端参数模板，便于快速调整。</Text>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset} activeOpacity={0.8}>
                    <Text style={styles.secondaryText}>重置默认</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.primaryBtn, (hasInvalidValues || isSaving) && styles.primaryBtnDisabled]}
                    onPress={handleSave}
                    disabled={hasInvalidValues || isSaving}
                    activeOpacity={0.8}
                >
                    {isSaving ? <ActivityIndicator color="#FFF" size="small" /> : null}
                    <Text style={styles.primaryText}>{isSaving ? '保存中...' : '保存参数'}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    loadingWrap: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
    },
    card: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        padding: Spacing.lg,
    },
    sectionTitle: {
        color: Colors.dark.text,
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    label: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        marginBottom: Spacing.xs,
        marginTop: Spacing.md,
        fontWeight: '600',
    },
    input: {
        backgroundColor: Colors.dark.surfaceLight,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        borderRadius: BorderRadius.md,
        color: Colors.dark.text,
        fontSize: FontSize.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    hint: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginTop: Spacing.lg,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    secondaryBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    secondaryText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.dark.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
    },
    primaryBtnDisabled: {
        opacity: 0.6,
    },
    primaryText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontWeight: '700',
    },
});
