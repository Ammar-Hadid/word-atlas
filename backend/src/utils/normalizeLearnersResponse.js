import { normalizeMerriamEntry } from "./normalizeMerriamEntry.js";

const normalizeLearnersResponse = entries => Array.isArray(entries)
    ? entries.filter(entry => entry && typeof entry === "object" && entry.hwi?.hw)
        .map(entry => normalizeMerriamEntry(entry, "learners"))
    : [];

export default normalizeLearnersResponse;
