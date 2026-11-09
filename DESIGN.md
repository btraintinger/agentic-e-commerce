---
version: alpha
name: JKU Webshop
description: A campus catalog with a shopping desk that runs its assistant on the shopper's device.
colors:
  primary: "#2563EB"
  primary-foreground: "#FFFFFF"
  background: "#FAFAFA"
  foreground: "#18181B"
  card: "#FFFFFF"
  secondary: "#F4F4F5"
  muted: "#F4F4F5"
  muted-foreground: "#52525B"
  accent: "#EFF6FF"
  border: "#E4E4E7"
  input: "#8C8C97"
  ring: "#2563EB"
  destructive: "#B91C1C"
typography:
  sans:
    fontFamily: "Geist, system-ui, sans-serif"
rounded:
  DEFAULT: "0.75rem"
spacing:
  page-max: "75rem"
  workspace-gap: "2rem"
components:
  button: {}
  card: {}
  conversation: {}
  composer: {}
---

# JKU Webshop

## Overview

The shopping desk uses shadcn's neutral surfaces, familiar controls, and a blue accent. The conversation is the working surface, with the cart available in a drawer from the header. The audience is JKU students exploring the course webshop catalog. The interface uses English and displays prices in euros with Austrian English formatting.

The shopping desk is the homepage. Its semantic palette is owned by [desk.module.css](src/app/shop/desk.module.css). [globals.css](src/styles/globals.css) maps those variables to Tailwind utilities used by the shadcn primitives. This document mirrors the runtime values.

## Colors

Blue identifies primary actions and focus. Outgoing messages use the shadcn tinted bubble variant. White conversation and cart surfaces sit on a zinc canvas with quiet borders. Labels explain status alongside color. Errors use the destructive role with readable recovery text.

## Typography

The shopping desk uses Geist. Use sentence case, short questions, and plain action names. Prices use tabular numerals and come from the catalog. Keep assistant prose to a comfortable measure.

## Layout

The desk has one bounded, scrollable conversation above the composer. The welcome prompt sits within the conversation and starter buttons wrap below it. The cart opens from the right and fills narrow screens. Its item list scrolls between the title and subtotal. Use borders to separate working surfaces, a 0.75rem container radius, and visible keyboard focus.

## Components

Shadcn owns conversation scrolling, messages, prompt controls, status badges, alerts, cards, and the modal cart sheet. Tool results render as structured product or offer lists. An action names the selected product for assistive technology. Quick answers appear with their question, and the free-text composer remains available during the conversation. Model progress and errors are visible in the desk. Spinner animation respects reduced-motion preferences.
