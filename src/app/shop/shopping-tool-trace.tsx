import { getToolName, isToolUIPart } from "ai";
import { Wrench } from "lucide-react";

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockTitle,
} from "~/components/ui/code-block";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "~/components/ui/trace";
import type { ShoppingMessage } from "~/lib/shopping-agent";

type MessagePart = ShoppingMessage["parts"][number];
type ToolPart = Extract<MessagePart, { toolCallId: string }>;
type ToolRun = [ToolPart, ...ToolPart[]];

const toolLabels = new Map([
  ["listCategories", "Browse categories"],
  ["searchProducts", "Search the catalog"],
  ["getOffers", "Look up offers"],
  ["validateCart", "Check cart totals"],
  ["askQuestion", "Ask a follow-up question"],
]);

export function groupShoppingParts(parts: MessagePart[], showText = true) {
  const groups: (Extract<MessagePart, { type: "text" }> | ToolRun)[] = [];
  let toolRun: ToolRun | undefined;

  for (const part of parts) {
    if (part.type === "text") {
      if (showText && part.text.trim()) groups.push(part);
      toolRun = undefined;
    } else if (isToolUIPart(part)) {
      if (part.state === "approval-requested") {
        toolRun = undefined;
      } else if (toolRun) {
        toolRun.push(part);
      } else {
        toolRun = [part];
        groups.push(toolRun);
      }
    }
  }

  return groups;
}

function ToolDetail({ title, value, error }: { title: string; value: string; error?: boolean }) {
  return (
    <CodeBlock size="sm" variant={error ? "destructive" : "default"}>
      <CodeBlockHeader>
        <CodeBlockTitle>{title}</CodeBlockTitle>
      </CodeBlockHeader>
      <CodeBlockContent wrap aria-label={title} className="max-h-48">{value}</CodeBlockContent>
    </CodeBlock>
  );
}

function ShoppingToolLine({ part, running }: { part: ToolPart; running: boolean }) {
  const name = getToolName(part);
  const complete = part.state === "output-available";
  const failed = part.state === "output-error";
  const denied = part.state === "output-denied" ||
    (part.state === "approval-responded" && !part.approval.approved);
  const status = complete ? "Completed"
    : failed ? "Failed"
    : denied ? "Denied"
    : running ? "Running"
    : "Interrupted";

  const line = (
    <TraceLine status={status === "Running" ? "running" : failed ? "error" : undefined}>
      <TraceIcon><Wrench /></TraceIcon>
      <TraceTitle>{toolLabels.get(name) ?? name}</TraceTitle>
      <TraceDescription>{status}</TraceDescription>
    </TraceLine>
  );

  if (!complete && !failed) return line;

  const voucher = part.type === "tool-validateCart" ? part.input?.voucherCode : undefined;
  const redactVoucher = (text: string) =>
    typeof voucher === "string" && voucher ? text.replaceAll(voucher, "[redacted]") : text;
  const input = JSON.stringify(part.input, (key, value: unknown) =>
    key === "voucherCode" ? "[redacted]" : value, 2);
  const output = failed ? redactVoucher(part.errorText) : JSON.stringify(part.output, (key, value: unknown) =>
    key === "message" && typeof value === "string" ? redactVoucher(value) : value, 2);

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger className="min-h-8">{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="flex flex-col gap-2">
        {input !== undefined && <ToolDetail title="Input" value={input} />}
        <ToolDetail title={failed ? "Error" : "Output"} value={output ?? "No output"} error={failed} />
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function ShoppingToolTrace({ parts, running }: { parts: ToolRun; running: boolean }) {
  return (
    <Trace role="group" aria-label="Tool calls">
      {parts.map((part) => <ShoppingToolLine key={part.toolCallId} part={part} running={running} />)}
    </Trace>
  );
}
