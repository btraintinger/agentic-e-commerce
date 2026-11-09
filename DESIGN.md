---
version: alpha
name: JKU Webshop
description: A campus catalog with a shopping desk that runs its assistant on the shopper's device.
colors:
  primary: "#194DBB"
  primary-hover: "#133C93"
  primary-foreground: "#FFFFFF"
  background: "#FFFFFF"
  foreground: "#17191F"
  card: "#FFFFFF"
  secondary: "#FFFFFF"
  secondary-foreground: "#17191F"
  muted: "#FFFFFF"
  muted-foreground: "#4F5664"
  accent: "#E5EFFF"
  border: "#738FB5"
  input: "#5279B2"
  ring: "#194DBB"
  destructive: "#9D233B"
  success: "#14604A"
  warning: "#744600"
typography:
  sans:
    fontFamily: "Geist, system-ui, sans-serif"
rounded:
  DEFAULT: "0.75rem"
spacing:
  page-max: "57rem"
  comparison-gap: "0.75rem"
components:
  button: {}
  card: {}
  conversation: {}
  composer: {}
---

# JKU Webshop

## Overview

The shopping desk gives JKU students a place to explore the course catalog and compare offers. The conversation is the working surface, with the cart available in a drawer from the header. The interface uses English and displays prices in euros with Austrian English formatting.

The shopping desk is the homepage. [globals.css](src/styles/globals.css) owns the semantic palette and maps it to Tailwind utilities used by the shadcn primitives. Root-level tokens also style content rendered through a portal, including the cart and its backdrop. This document mirrors the runtime values.

## Colors

The canvas, masthead, conversation, composer, drawer, and card surfaces are white. Crisp outlines and spacing separate cards and panels. Cobalt fills primary buttons and identifies interactive accents and focus. Secondary actions use white fill, blue text, and a stronger blue outline. Ink carries body text, with softer ink for supporting details. White stock badges use emerald outlines and text for available, amber for low stock, and rose for unavailable. Error alerts use the same rose family.

## Typography

The shopping desk uses Geist. Use sentence case, short questions, and plain action names. Prices use tabular numerals and come from the catalog. Keep assistant prose to a comfortable measure.

## Layout

The desk has one bounded, scrollable conversation above the composer. The welcome prompt sits within the conversation and starter buttons wrap below it. The cart opens from the right and fills narrow screens. Product and offer cards display in two columns once the conversation has 32rem of content width and stack on narrower screens. Price and stock sit above the offer actions, with the footer aligned to the bottom of its card. Use borders to separate working surfaces, a 0.75rem container radius, and visible keyboard focus.

## Components

Shadcn owns conversation scrolling, messages, prompt controls, status badges, alerts, cards, and the modal cart sheet. Product and offer results and cart items use the shared Card primitive. An action names the selected product for assistive technology. Quick answers appear with their question, and the free-text composer remains available during the conversation. Model progress and errors are visible in the desk. Spinner animation respects reduced-motion preferences.
