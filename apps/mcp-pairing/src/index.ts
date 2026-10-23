/**
 * Mentorful teacher-pairing MCP server (stdio).
 *
 * Resources: a school's profiles, exclusion rules and pairing history, at
 * the mcp://mentorful-db/... addresses the agent prompt names. Tool:
 * generate_pairings. Prompt: teacher_pairing_agent, the system prompt in
 * prompts/teacher-pairing-agent.md.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { source } from "./data.ts";
import { generatePairings } from "./pairing.ts";

const SYSTEM_PROMPT = readFileSync(fileURLToPath(new URL("../prompts/teacher-pairing-agent.md", import.meta.url)), "utf8");
const data = source();

const server = new McpServer({ name: "mentorful-pairing", version: "0.1.0" });

const json = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(value, null, 2) }],
});
const schoolOf = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

// ------------------------------------------------------------ resources

server.registerResource(
  "profiles",
  new ResourceTemplate("mcp://mentorful-db/school/{school_id}/profiles", { list: undefined }),
  { title: "Teacher roster", description: "Teachers at a school: id, name, department and strength domains. No contact details.", mimeType: "application/json" },
  async (uri, { school_id }) => json(uri, await data.profiles(schoolOf(school_id)))
);

server.registerResource(
  "exclusion_rules",
  new ResourceTemplate("mcp://mentorful-db/school/{school_id}/exclusion_rules", { list: undefined }),
  { title: "Do-not-pair rules", description: "Active conflict filters as teacher-id pairs. Reasons are not exposed.", mimeType: "application/json" },
  async (uri, { school_id }) => json(uri, await data.exclusionRules(schoolOf(school_id)))
);

server.registerResource(
  "pairing_history",
  new ResourceTemplate("mcp://mentorful-db/school/{school_id}/pairing_history", { list: undefined }),
  { title: "Pairing history", description: "Pairings from recent cycles, most recent first (cycles_ago = 0). Defaults to the last 2 cycles.", mimeType: "application/json" },
  async (uri, { school_id }) => json(uri, await data.pairingHistory(schoolOf(school_id), 2))
);

// ----------------------------------------------------------------- tool

const id = z.string().min(1);

server.registerTool(
  "generate_pairings",
  {
    title: "Generate teacher pairings",
    description:
      "Runs the pairing algorithm for one school. RANDOMIZED pairs everyone across departments; TEACHER_REQUESTED honours mutual then single-sided requests and pairs the rest the same way; ADMIN_ASSIGNED only validates admin_overrides. Conflicts and recent repeats are never paired. Returns pairs, unassigned teachers, rejections with reasons, and a counts-only admin summary.",
    inputSchema: {
      school_id: id,
      variant: z.enum(["RANDOMIZED", "ADMIN_ASSIGNED", "TEACHER_REQUESTED"]),
      requested_pairs: z.array(z.object({ requester_id: id, target_id: id })).optional(),
      admin_overrides: z.array(z.object({ host_id: id, visitor_id: id })).optional(),
      exclude_previous_cycles_count: z.number().int().min(0).max(12).default(2),
      seed: z.number().int().optional().describe("Fixes the random choices so a run can be reproduced."),
    },
  },
  async (input) => {
    const [roster, exclusions, history] = await Promise.all([
      data.profiles(input.school_id),
      data.exclusionRules(input.school_id),
      data.pairingHistory(input.school_id, input.exclude_previous_cycles_count),
    ]);
    const result = generatePairings(input, roster, exclusions, history);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
  }
);

// --------------------------------------------------------------- prompt

server.registerPrompt(
  "teacher_pairing_agent",
  {
    title: "Mentorful teacher-pairing agent",
    description: "The agent's system prompt, followed by the pairing request to carry out.",
    argsSchema: {
      school_id: z.string(),
      variant: z.enum(["RANDOMIZED", "ADMIN_ASSIGNED", "TEACHER_REQUESTED"]),
      request_json: z.string().optional().describe("The full input payload as JSON, if there are requests or overrides."),
    },
  },
  ({ school_id, variant, request_json }) => ({
    messages: [
      { role: "user", content: { type: "text", text: SYSTEM_PROMPT } },
      {
        role: "user",
        content: {
          type: "text",
          text: `Pair the teachers at school ${school_id} using the ${variant} variant.` + (request_json ? `\n\nRequest:\n${request_json}` : ""),
        },
      },
    ],
  })
);

await server.connect(new StdioServerTransport());
