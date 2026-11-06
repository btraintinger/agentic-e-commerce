import type { Metadata } from "next";

import { ShoppingAssistant } from "./shopping-assistant";

export const metadata: Metadata = {
  title: "Shopping assistant | JKU Webshop",
  description: "Find campus gear and compare offers with an on-device shopping assistant.",
};

export default function ShopPage() {
  return <ShoppingAssistant />;
}
