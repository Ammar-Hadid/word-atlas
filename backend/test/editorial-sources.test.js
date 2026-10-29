import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import normalizeLearnersResponse from "../src/utils/normalizeLearnersResponse.js";
import normalizeCollegiateResponse from "../src/utils/normalizeCollegiateResponse.js";
import { getMatchingEntries } from "../src/utils/getMatchingLearnersEntries.js";
import getValidSuggestions from "../src/utils/getValidSuggestions.js";
import { getEditorial } from "../src/services/editorialService.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/dictionary-cases.json", import.meta.url), "utf8"));
const simple = (word, definition = "Synthetic test meaning.", fields = {}) => ({
    meta: { id: word, stems: [word] }, hwi: { hw: word }, fl: "noun",
    def: [{ sseq: [[["sense", { dt: [["text", definition]] }]]] }], ...fields,
});
const senses = entry => entry.senses.flatMap(group => group.senses);

// Reproduce the old controller's mandatory Learner's gate without calling a
// provider. This is a fixture behavior baseline, not an MW coverage benchmark.
function oldLearnersGate(entries, term) {
    return entries.filter(entry => typeof entry === "object" &&
        (entry.hwi?.hw?.replaceAll("*", "").toLowerCase() === term.toLowerCase()
        || entry.meta?.stems?.includes(term.toLowerCase())));
}

test("old resolver baseline: 4 of 6 positive fixtures survive mandatory Learner's gate", () => {
    const positive = fixture.resolverCases.filter(item => item.expectedFound);
    assert.equal(positive.length, 6);
    assert.equal(positive.filter(item => oldLearnersGate(item.learners, item.term).length).length, 4);
});

test("both references resolve all six positive fixtures and preserve the miss", async () => {
    for (const item of fixture.resolverCases) {
        const result = await getEditorial(item.term, {
            fetchLearners: async () => item.learners, fetchCollegiate: async () => item.collegiate,
        });
        assert.equal(result.word.length > 0, item.expectedFound, item.term);
        if (item.expectedWord) assert.equal(result.word[0].word, item.expectedWord, item.term);
    }
});

test("all definition blocks, binding/sub/divided senses, text segments and examples survive", () => {
    const [entry] = normalizeLearnersResponse([fixture.completeEntry]);
    const list = senses(entry);
    assert.equal(list.length, 6);
    assert.equal(list[0].definition, "First synthetic clause. Second synthetic clause.");
    assert.deepEqual(list[0].examples, ["A synthetic example. [=an explanation]", "A second example."]);
    assert.equal(list[0].exampleDetails[0].author, "Test Author");
    assert.equal(list[0].usageNotes[0].note, "An original usage note.");
    assert.equal(list[0].usageNotes[0].examples[0], "A note example.");
    assert.equal(list[1].definition, "A related but separate meaning.");
    assert.equal(list[1].divider, "also");
    assert.equal(list[2].definition, "A binding introduction.");
    assert.equal(list[3].definition, "A parenthesized meaning.");
    assert.equal(list[4].definition, "Another parenthesized meaning.");
    assert.equal(list[5].definition, "The second definition block.");
    assert.equal(list[5].grammar, "intransitive verb");
    assert.equal(new Set(list.map(sense => sense.id)).size, list.length);
    assert.deepEqual(entry.labels, ["chiefly technical", "rare"]);
    assert.equal(entry.pronunciations.length, 3);
    assert.equal(entry.pronunciations[0].alphabet, "ipa");
    assert.equal(entry.forms.length, 3);
    assert.equal(entry.phrases[0].senses.flatMap(group => group.senses).length, 2);
    assert.equal(entry.phrases[0].type, "phrasal verb");
    assert.equal(entry.phrases[0].forms[0].form, "pivot around something");
    assert.equal(entry.derived[0].word, "pivoter");
});

test("Collegiate normalizer supplies definitions and preserves its phonetic alphabet", () => {
    const result = normalizeCollegiateResponse([simple("lead", "Synthetic metal sense.", {
        hwi: { hw: "lead", prs: [{ mw: "ˈled" }] }, et: [["text", "Synthetic history."]], date: "test date",
    })], "lead");
    assert.equal(result.word[0].phonetic, "ˈled");
    assert.equal(result.word[0].pronunciations[0].alphabet, "mw");
    assert.equal(result.origins[0].etymology, "Synthetic history.");
    assert.equal(result.word[0].source.id, "mw-collegiate");
    assert.equal(result.word[0].source.storage, "live-only");
});

test("case-sensitive homographs are preferred; punctuation and forms match explicitly", () => {
    const lower = simple("us");
    const upper = simple("US");
    assert.deepEqual(getMatchingEntries([lower, upper], "US"), [upper]);
    assert.deepEqual(getMatchingEntries([lower, upper], "us"), [lower]);
    assert.equal(getMatchingEntries([simple("it's", undefined, { meta: { stems: ["it is"] } })], "it’s").length, 1);
    assert.equal(getMatchingEntries([simple("pivot", undefined, { ins: [{ if: "piv*oted" }] })], "pivoted").length, 1);
    assert.equal(getMatchingEntries([null, "unknown", {}], "unknown").length, 0);
});

test("same spelling/POS/homograph number does not authorize unrelated origin or quotation", async () => {
    const learners = simple("lead", "Synthetic guidance sense.", { hom: 1, fl: "noun" });
    const collegiate = simple("lead", "Synthetic metal sense.", { hom: 1, fl: "noun", et: [["text", "Wrong history."]],
        quotes: [{ t: "Wrong quotation." }] });
    const result = await getEditorial("lead", { fetchLearners: async () => [learners], fetchCollegiate: async () => [collegiate] });
    assert.equal(result.word[0].etymology, null);
    assert.deepEqual(result.quotes, []);
});

test("explicit cross-reference UUID alone permits the matching origin", async () => {
    const learners = simple("lead", "Synthetic guidance sense.", {
        meta: { id: "lead:1", stems: ["lead"], target: { tsrc: "collegiate", tuuid: "guide-uuid" } },
    });
    const correct = simple("lead", "Synthetic guidance sense.", { meta: { id: "lead:2", uuid: "guide-uuid" },
        et: [["text", "Correct linked history."]], quotes: [{ t: "Correct linked quotation." }] });
    const wrong = simple("lead", "Synthetic metal sense.", { meta: { id: "lead:1", uuid: "metal-uuid" }, et: [["text", "Wrong history."]] });
    const result = await getEditorial("lead", { fetchLearners: async () => [learners], fetchCollegiate: async () => [wrong, correct] });
    assert.equal(result.word[0].etymology, "Correct linked history.");
    assert.equal(result.word[0].originSource.referenceId, "lead:2");
    assert.equal(result.quotes[0].text, "Correct linked quotation.");
    assert.equal(result.quotes[0].source, null);
    assert.equal(result.quotes[0].dictionarySource.id, "mw-collegiate");
});

test("provider rejection and timeout retain the valid independent reference", async () => {
    const result = await getEditorial("lead", {
        fetchLearners: () => new Promise(() => {}), fetchCollegiate: async () => [simple("lead")], deadlineMs: 15,
    });
    assert.equal(result.availability.learners, "timeout");
    assert.equal(result.word[0].source.id, "mw-collegiate");
    const unavailable = await getEditorial("lead", {
        fetchLearners: async () => { throw Object.assign(new Error("quota"), { code: "quota_exhausted" }); },
        fetchCollegiate: async () => { throw new Error("provider offline"); },
    });
    assert.deepEqual(unavailable.availability, { learners: "allowance_exhausted", collegiate: "unavailable" });
    assert.equal(unavailable.word.length, 0);
});

test("suggestions are bounded strings and never make verification requests", async () => {
    assert.deepEqual(await getValidSuggestions(["alpha", "alpha", null, { word: "beta" }, "", "x".repeat(200), "beta"]), ["alpha", "beta"]);
    assert.equal((await getValidSuggestions(Array.from({ length: 30 }, (_, i) => `word${i}`))).length, 8);
});

test("evaluation has at least fifty distinct idioms and phrasal verbs, without copied definitions", () => {
    const expressions = fixture.coverageTerms.filter(item => ["idiom", "phrasal_verb"].includes(item.category));
    assert.ok(new Set(expressions.map(item => item.term)).size >= 50);
    assert.ok(expressions.every(item => !item.definition));
});
