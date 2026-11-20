# Issues – Epics and user stories

13 user stories in 4 epics. FA and NFA IDs refer to the Requirements (EN) (`Requirements_v3.md`).

## Epic: UI

Implement the shop UI that shows the chat and the cart.

### US-01 Clear chat UI

**User story:** As a user, I want a clear chat UI, so that I can control the web shop intuitively just by chatting.

**Context:** The chat is the only way to control the shop. Results appear as numbered options so the user can refer to them later (“No. 2”), and follow-up questions offer clickable answers that send the same text the user could type. A new conversation resets the conversation state (US-07) but keeps the cart (US-02).

**Acceptance criteria**

- [ ] The chat UI is responsive.
- [ ] When a request matches several products, the chat shows them as options. Example: the user asks for brown T-shirts → Option 1: T-shirt, 80 % cotton, brown; Option 2: T-shirt, 20 % cotton, dark brown.
- [ ] Follow-up questions offer answer options. Example: the user asks for JKU merch → Option 1: for men; Option 2: for women.
- [ ] The chat can be cleared by starting a new conversation, without emptying the shopping cart.
- [ ] The cart options are always clickable and don't need the model.

**Depends on:** FA-01, FA-02, FA-03, FA-05, FA-14 (clickable answer options and product cards are recognised in code, without the model)

### US-02 Visible shopping cart

**User story:** As a user, I want a visible shopping cart that can also be controlled via the chat, so that I can see what I have already added.

**Context:** The cart lives in the frontend (React state) next to the chat. A change by chat and a change by button have the same effect. Adding by chat only works if the intent is recognised (US-04) and the products were shown as options before (US-01).

**Acceptance criteria**

- [ ] The shopping cart can be filled and emptied via the chat or via the menu (buttons).
- [ ] The shopping cart is always visible next to the chat.
- [ ] Products can be added to the cart by ordinal (e.g. click “No. 1”) or by name (e.g. “I want the JKU shirt”).

**Depends on:** FA-04, FA-08, FA-70, FA-71

**Related:** US-04 (Harness): the intent must be recognised from the chat. US-01: the product options must exist.

### US-03 Visual feedback on what the app is doing

**User story:** As a user, I want clear visual hints about what is going on in the app, so that I know what my actions do when I click or ask something.

**Context:** The local model and the backend calls take a few seconds; without feedback the app looks frozen. This story also covers the transparency nice-to-have of the brief (e.g. “Searching the database for light fabrics …”). An error must never end the conversation. The search problems themselves are reported by the backend (US-10).

**Acceptance criteria**

- [ ] When an action is performed, it is shown in the UI (e.g. backend tool call, “AI is working”).
- [ ] When an error is thrown, it is shown in the UI.
- [ ] When an action fails, the user is told, e.g. when no products are found or when a search returns too many products.

**Depends on:** FA-06

### US-13 English-only chat

**User story:** As a user, I want the shop to tell me clearly that it only understands English, so that I know how to write my requests.

**Context:** The catalogue and the recognition are in English; a message in German or another language would be recognised wrongly. Instead of guessing, the chat answers with a friendly note. The replies themselves are plain English without technical terms.

**Acceptance criteria**

- [ ] A message in another language (e.g. “Ich suche eine Regenjacke”) gets a friendly reply that the shop only understands English, with an example in English.
- [ ] No search is started; conversation state and cart stay unchanged.
- [ ] All bot replies are in English and free of jargon: no IDs, no JSON, no field names (these appear only in the transparency view).

**Depends on:** FA-07, FA-09

**Related:** US-04 (the language is checked together with the intent recognition).

## Epic: Harness

Check and guide the AI so that it is correct and makes the right tool calls.

### US-04 Recognise the user's intent

**User story:** As a user, I want my intent to be clearly recognised when I use the chat, so that I can use the whole app conveniently through the chat alone.

**Context:** The whole shopping process and the use of the app should be possible through the chat. The model does not answer the user; it translates each message into one JSON object, which the code checks (US-06) and turns into tool calls. The same intent must be recognised regardless of wording: “I need headphones” and “Show me headphones” are both a search.

**Acceptance criteria**

- [ ] The basic intents are `search`, `add_to_cart`, `remove_from_cart` and `off_topic` (e.g. “Write a poem”).
- [ ] The LLM does not answer the message; it translates it into exactly one JSON object.
- [ ] The JSON object contains at least intent, gender, quantity and price.
- [ ] English words are recognised even with a typo.
- [ ] Prompt injections are also labelled as `off_topic`.

**Depends on:** FA-10, FA-11, FA-12, FA-13, FA-24 (split between US-04 and US-06)

**Related:** When the user is searching for an entire outfit, see US-05.

### US-05 Abstract requests and outfits

**User story:** As a user, I want even more abstract prompts (for instance outfits) to be processed correctly, so that I can make more complex requests.

**Context:** Abstract wishes such as “Put together a summer outfit for me” are a must-have of the project brief. The dataset has no season tags, so season and weather terms have to be mapped to product types; the outfit is then searched item by item via `GET /search` (US-09).

**Acceptance criteria**

- [ ] Outfit items really match the request.
- [ ] The outfit request is recognised as its own intent, `outfit`.
- [ ] The app (harness, model or a hard-coded mapping) maps season and weather terms to certain products. Example: rain outfit → rain jacket, hood, umbrella.

**Depends on:** FA-50, FA-51, FA-52

### US-06 Check and correct the model

**User story:** As a user, I want the model to be checked and corrected when it makes mistakes, so that I have a safe and good user experience.

**Context:** Small LLMs make mistakes; the harness corrects them as well as possible. The design philosophy is that the code always checks the LLM: its output is treated as untrusted input, like a form field, and every value is checked against the user's text, the conversation state and the allowed values before any backend call or cart change.

**Acceptance criteria**

- [ ] Invented values in the model output are removed. Example: “I want a hoodie for men” → the LLM says gender: female.
- [ ] Wrong values are corrected, e.g. a price or a gender that ended up in the search term.
- [ ] Invalid model output that cannot be corrected leads to a follow-up question such as “Could you please ask again?”, not to a crash.

**Depends on:** FA-20, FA-21, FA-22, FA-23, FA-24 (split between US-04 and US-06)

### US-07 Remember the conversation

**User story:** As a user, I want the app to remember details clarified earlier in the conversation, so that I don't have to clarify them again.

**Context:** References such as “the second one” or “the jacket from before” only work if the app knows what was shown and settled earlier. The code keeps settled details, the open follow-up question, the shown products and the cart.

**Acceptance criteria**

- [ ] The conversation state is stored so that the user can refer to previous questions and products.
- [ ] When searching, all filters are kept until the result. Example: searching for a T-shirt goes category → colour → size; all filters are kept and no question is asked twice.
- [ ] The conversation state is stored in the harness (code), because the context of the LLM is too small.

**Depends on:** FA-30, FA-31

## Epic: Backend and DB

Provide the products via API calls and store the web shop data in a database.

### US-08 Implement the database

**User story:** As a developer, I want the data to be structured and quickly queryable, so that the app offers a good user experience.

**Context:** The base repository provides the catalogue (products, variants, offers, vendors, warehouses, vouchers) as JSON. According to the architecture, the backend reads it from PostgreSQL via Drizzle ORM.

**Acceptance criteria**

- [ ] The provided JSON data is stored in a database (PostgreSQL).
- [ ] The database is accessible from the backend.
- [ ] The database is easy to access and adapt during development.

### US-09 Reliable product search

**User story:** As a user, I want searched products to be found reliably even if I write them differently, so that I can search easily without remembering the exact product name.

**Context:** The search terms come from the model's JSON object and are often not the exact product names. The provided backend has no similarity search, so a new route `GET /search` is added to it.

**Acceptance criteria**

- [ ] Provide an endpoint `/search` that finds products via synonyms and despite typos (e.g. “rain jakkt” finds a rain jacket, “shirt” finds a T-shirt).
- [ ] Include the endpoint in the existing (provided) backend.
- [ ] Apply filters for every attribute in the output JSON (e.g. gender, max_price, category …).
- [ ] If no product is found, relax the filters (e.g. raise max_price) to find a product.

**Depends on:** FA-40, FA-41, FA-44

### US-10 Report search problems

**User story:** As a user, I want to know if something went wrong with the product search, so that I know what I have to clarify or do.

**Context:** The backend has to report problems in a clear, structured way so that the frontend can show them (US-03). Rejected requests (HTTP 400) are also the basis for the self-correction nice-to-have.

**Acceptance criteria**

- [ ] Signal the user if a search has too many results (e.g. 20 products): ask the user again (frontend change) or cut the results.
- [ ] Reject requests with invalid parameters in the JSON (HTTP 400).
- [ ] If no products are found even with relaxing the filters, inform the user and don't search further (implemented together with US-03).

**Depends on:** FA-42, FA-43, FA-45

**Related:** US-03 (UI)

## Epic: Quality

Implement tests and check the non-functional requirements (NFAs).

### US-11 Tests with and without the model

**User story:** As a developer, I want unit tests and tests that run with the model, so that I find bugs.

**Context:** Write tests for the application: unit tests and local tests that run with the model. Unit tests replace the model and the backend calls with fixed answers, so they run without GPU and without a running server; the model tests run in the browser with WebGPU.

**Acceptance criteria**

- [ ] Define local tests (or tests in the browser) that run with the model.
- [ ] For these, define the correct model output for given inputs and check whether the AI matches it.
- [ ] Define unit tests for the backend functionality.
- [ ] Define unit tests for the frontend logic and the harness.
- [ ] The unit tests are run automatically on GitHub (CI/CD).

**Depends on:** NFA-06

### US-12 Meet the quality standards

**User story:** As a developer, I want the app to meet quality standards, so that it is reliable and works.

**Context:** These checks are done before the final presentation, ideally on the device used for the demo, and the results go into the README and the project report.

**Acceptance criteria**

- [ ] Check that replies are fast (2–3 seconds).
- [ ] Check that the chat stays local (no cloud LLM, chats not saved in the database).
- [ ] Try to crash the application; if it crashes, fix it.
- [ ] Define the supported browsers and devices.
- [ ] Improve the README so that it documents all important decisions and architecture decisions.

**Depends on:** NFA-01, NFA-03, NFA-04, NFA-05, NFA-08
