import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform } from "react-native"
import * as Clipboard from "expo-clipboard"
import { wideTextSelection } from "../../lib/scroll-config"

interface Props {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: Props) {
  const isDark = useColorScheme() === "dark"
  const [copied, setCopied] = useState(false)
  const sel = wideTextSelection(Platform.OS)

  // Cosmetic wrapping: one Text per logical line, so indentation survives and a
  // long line folds inside the block instead of needing sideways scrolling.
  // The clipboard gets `code` — the raw string from the server — so what you
  // paste is byte-identical to what was sent, line breaks and all. Wrapping only
  // exists in the rendering. See ../../lib/scroll-config for why these blocks no
  // longer scroll horizontally.
  const lines = code.split("\n")

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.language, isDark && styles.languageDark]}>{language || "code"}</Text>
        <TouchableOpacity onPress={copy} hitSlop={8}>
          <Text style={[styles.copyBtn, isDark && styles.copyBtnDark]}>{copied ? "Copied!" : "Copy"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.codeBody} testID="code-block-body">
        {lines.map((line, idx) => (
          // An empty Text collapses to zero height, which would eat blank lines
          // and make pasted-vs-displayed line counts disagree.
          <Text key={idx} style={[styles.code, isDark && styles.codeDark]} selectable={sel.selectable}>
            {line.length > 0 ? line : " "}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#141926",
    borderRadius: 8,
    marginVertical: 8,
    overflow: "hidden",
  },
  containerDark: {
    backgroundColor: "#0d1018",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#141926",
  },
  headerDark: {
    backgroundColor: "#1c2333",
  },
  language: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8a93a8",
    textTransform: "uppercase",
  },
  languageDark: {
    color: "#8a93a8",
  },
  copyBtn: {
    fontSize: 11,
    color: "#22d3ee",
    fontWeight: "600",
  },
  copyBtnDark: {
    color: "#22d3ee",
  },
  codeBody: {
    padding: 12,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
    color: "#0d1018",
  },
  codeDark: {
    color: "#e5e5e5",
  },
})
