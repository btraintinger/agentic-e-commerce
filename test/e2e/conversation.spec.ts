import { shopRequestSchema } from "@/agent/message-parser/shop-request-schema";
import { conversation } from "./prompt-cases";
import { expect, openChat, send, test } from "./support/chat-driver";

const lower = (value: unknown) =>
  value &&
  typeof value === "object" &&
  "product" in value &&
  typeof value.product === "string"
    ? { ...value, product: value.product.toLowerCase() }
    : value;

test("shopping conversation is recognised correctly", async ({
  chatPage: page,
}) => {
  await openChat(page);
  let schemaOk = 0;
  let fieldsOk = 0;

  for (const turn of conversation) {
    await test.step(turn.message, async () => {
      const { reply, request } = await send(page, turn.message);
      console.log(
        `> ${turn.message}\n  ${reply}\n  ${JSON.stringify(request)}`,
      );

      const valid = shopRequestSchema.safeParse(request).success;
      if (valid) schemaOk++;
      expect
        .soft(valid, `valid ShopRequest JSON: ${JSON.stringify(request)}`)
        .toBe(true);

      const expected = lower(turn.expected) as Record<string, unknown>;
      if (valid && matches(lower(request), expected)) fieldsOk++;
      expect.soft(lower(request), "recognised fields").toMatchObject(expected);
      expect.soft(reply, "agent reply").toMatch(turn.reply);
    });
  }

  // After the run, only the cap from turn 2 should be left in the cart.
  await expect.soft(page.getByTestId("cart-line")).toHaveCount(1);

  const summary = `${schemaOk}/${conversation.length} valid JSON, ${fieldsOk}/${conversation.length} fields correct`;
  console.log(summary);
  test.info().annotations.push({ type: "summary", description: summary });
});

function matches(actual: unknown, expected: Record<string, unknown>) {
  if (!actual || typeof actual !== "object") return false;
  return Object.entries(expected).every(
    ([key, value]) => (actual as Record<string, unknown>)[key] === value,
  );
}
