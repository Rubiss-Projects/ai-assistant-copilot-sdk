const DISCORD_MAX = 1990; // Leave headroom for code-fence close/reopen overhead
/**
 * Splits text into chunks that each fit within Discord's 2000-char message limit.
 * Splits at paragraph → newline → word boundaries to avoid mid-word cuts.
 * Tracks open code fences: closes the fence at the split point and reopens it
 * (with the same language tag) at the start of the next chunk.
 */
export function chunkForDiscord(text, maxLen = DISCORD_MAX) {
    if (text.length <= maxLen)
        return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLen) {
        // Prefer clean boundaries in the back half of the window
        const half = Math.floor(maxLen / 2);
        let splitAt = maxLen;
        const paraBreak = remaining.lastIndexOf("\n\n", maxLen);
        if (paraBreak >= half) {
            splitAt = paraBreak + 2;
        }
        else {
            const lineBreak = remaining.lastIndexOf("\n", maxLen);
            if (lineBreak >= half) {
                splitAt = lineBreak + 1;
            }
            else {
                const wordBreak = remaining.lastIndexOf(" ", maxLen);
                if (wordBreak >= half) {
                    splitAt = wordBreak + 1;
                }
            }
        }
        let chunk = remaining.slice(0, splitAt);
        remaining = remaining.slice(splitAt);
        // Line-by-line toggle to detect open code fences at the split point.
        // A ``` line opens a fence (capturing the language tag); a closing ``` line
        // (no language tag) closes it. Handles unlabeled fences correctly.
        let openFenceLang = null;
        for (const line of chunk.split("\n")) {
            const m = line.match(/^```(\S*)\s*$/);
            if (!m)
                continue;
            const lang = m[1];
            if (openFenceLang === null) {
                openFenceLang = lang; // entering a fence (lang may be empty for unlabeled)
            }
            else if (lang === "") {
                openFenceLang = null; // valid closer has no language tag
            }
            // A tagged ``` while already inside a fence is ignored (unusual edge case)
        }
        if (openFenceLang !== null) {
            chunk += "\n```";
            remaining = "```" + openFenceLang + "\n" + remaining;
        }
        chunks.push(chunk);
    }
    if (remaining.length > 0)
        chunks.push(remaining);
    return chunks;
}
