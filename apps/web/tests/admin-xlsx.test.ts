import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { workbook } from "@/lib/admin/xlsx";

async function open(file: ArrayBuffer) {
  return JSZip.loadAsync(file);
}

describe("the Excel writer", () => {
  it("makes a zip with the parts Excel needs", async () => {
    const zip = await open(await workbook([{ name: "Results", rows: [["metric", "value"], ["Respondents", 32]] }], "Test"));
    for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) expect(zip.file(part), part).not.toBeNull();
  });
  it("holds plain files only, no folder entries", async () => {
    const zip = await open(await workbook([{ name: "S", rows: [["h"], [1]] }], "T"));
    expect(Object.keys(zip.files).filter((n) => n.endsWith("/"))).toEqual([]);
  });
  it("writes numbers as numbers and text as text, with a bold header", async () => {
    const zip = await open(await workbook([{ name: "S", rows: [["metric", "value"], ["Efficacy", "4.70"], ["Cycle", "Fall 2026"], ["Count", 32]] }], "T"));
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('<c r="B2"><v>4.7</v></c>');
    expect(xml).toContain('<c r="B4"><v>32</v></c>');
    expect(xml).toContain("Fall 2026");
    expect(xml).toMatch(/<c r="A1" s="1" t="inlineStr">/);
  });
  it("escapes characters XML cannot carry and keeps sheet names legal", async () => {
    const zip = await open(await workbook([{ name: "A/B: a very long sheet name that goes past thirty one characters", rows: [["x"], ["a < b & \"c\"\u0001"]] }], "T"));
    const wb = await zip.file("xl/workbook.xml")!.async("string");
    const name = wb.match(/<sheet name="([^"]*)"/)![1];
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[/:]/);
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain("a &lt; b &amp; &quot;c&quot;");
    expect(xml).not.toContain("\u0001");
  });
  it("can hold more than one sheet and skip the header", async () => {
    const zip = await open(await workbook([{ name: "One", rows: [["h"], [1]] }, { name: "Two", rows: [["k", "v"]], header: false }], "T"));
    expect(zip.file("xl/worksheets/sheet2.xml")).not.toBeNull();
    const two = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(two).not.toContain('s="1"');
  });
});
