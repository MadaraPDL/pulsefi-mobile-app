import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePulseFiTheme } from "../theme/usePulseFiTheme";

const QUICK_PAGE_COUNT = 3;

type MobilePagerProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function MobilePager({ page, pageCount, onPageChange }: MobilePagerProps) {
  const { colors } = usePulseFiTheme();

  if (pageCount <= 1) {
    return null;
  }

  const safePage = Math.min(page, pageCount);
  const activeBg = colors.mode === "dark" ? "rgba(0, 209, 255, 0.1)" : "#EAF9FE";
  const activeText = colors.mode === "dark" ? colors.primary : "#0B5D7A";
  const visiblePages = Array.from(
    { length: Math.min(QUICK_PAGE_COUNT, pageCount) },
    (_, index) => index + 1
  );

  return (
    <View style={styles.pageRow}>
      <Pressable
        disabled={safePage <= 1}
        style={[
          styles.pageButton,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            opacity: safePage <= 1 ? 0.45 : 1,
          },
        ]}
        onPress={() => onPageChange(Math.max(safePage - 1, 1))}
      >
        <Text style={[styles.pageButtonText, { color: colors.primary }]}>Previous</Text>
      </Pressable>

      {visiblePages.map((pageNumber) => {
        const active = pageNumber === safePage;

        return (
          <Pressable
            key={pageNumber}
            style={[
              styles.pageNumberButton,
              {
                backgroundColor: active ? activeBg : colors.surfaceMuted,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onPageChange(pageNumber)}
          >
            <Text
              style={[
                styles.pageButtonText,
                { color: active ? activeText : colors.textMuted },
              ]}
            >
              {pageNumber}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        disabled={safePage >= pageCount}
        style={[
          styles.pageButton,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            opacity: safePage >= pageCount ? 0.45 : 1,
          },
        ]}
        onPress={() => onPageChange(Math.min(safePage + 1, pageCount))}
      >
        <Text style={[styles.pageButtonText, { color: colors.primary }]}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  pageButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pageNumberButton: {
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 42,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
});
