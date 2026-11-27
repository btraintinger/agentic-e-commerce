import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { LanguageModel } from "ai";
import { toOptions } from "@/agent/agent_util/catalog";
import { parseUserMessage } from "@/agent/parse-message";
import { pickItem, type Picked } from "@/agent/agent_util/matching";
import { ProductSearch } from "@/agent/agent_util/product-search";
import { replies } from "@/agent/agent_util/replies";
import type {
  ShopResponse,
  CartControls,
  CartLine,
  ProductOption,
  ShopRequest
} from "@/agent/types";
import type { AppRouter } from "@/server/api/root";

/**
 * One chat message → one shop action:
 *   parseUserMessage → execute (search | addToCart | removeFromCart | offTopic) → reply
 *
 * Public methods are arrow functions, so `agent.handleMessage` can be passed
 * around (props, callbacks, destructuring) without losing `this`.
 */
export class ShoppingAgent {
  private readonly model: LanguageModel | undefined;
  private readonly productSearch: ProductSearch;
  private readonly cart: CartControls | undefined;
  private shownOptions: ProductOption[] = [];

  constructor(
    model: LanguageModel | undefined,
    trpc: TRPCOptionsProxy<AppRouter>,
    queryClient: QueryClient,
    cart?: CartControls,
  ) {
    this.model = model;
    this.productSearch = new ProductSearch(trpc, queryClient);
    this.cart = cart;
  }

  // --- Public API ------------------------------------------------------------

  handleMessage = async (userMessage: string): Promise<ShopResponse> => {
    if (!this.model) return { text: replies.modelNotLoaded };
    const shopRequest = await this.parseUserMessageWithTiming(this.model, userMessage);
    if (!shopRequest) return { text: replies.retry };
    return this.executeSafely(shopRequest);
  };

  execute = async (request: ShopRequest): Promise<ShopResponse> => {
    switch (request.intent) {
      case "search":
        return this.searchProducts(request);
      case "add_to_cart":
        return this.addToCart(request);
      case "remove_from_cart":
        return this.removeFromCart(request);
      case "off_topic":
        return { request, text: replies.offTopic };
    }
  };

  /** Called when the user clicks an option instead of typing. */
  addOption = (option: ProductOption): string => this.putInCart(option, 1);

  // --- Steps of handleMessage ------------------------------------------------

  private async parseUserMessageWithTiming(model: LanguageModel, userMessage: string) {
    const start = performance.now();
    const shopRequest = await parseUserMessage(model, userMessage);
    const ms = Math.round(performance.now() - start);
    console.debug(`Model reply took ${ms} ms`);
    return shopRequest;
  }

  private async executeSafely(request: ShopRequest): Promise<ShopResponse> {
    try {
      return await this.execute(request);
    } catch (error) {
      console.error(error);
      return { request, text: replies.failure };
    }
  }

  // --- Actions ---------------------------------------------------------------

  private async searchProducts(request: ShopRequest): Promise<ShopResponse> {
    const product = request.product;
    if (!product) return { request, text: replies.askForProduct };
    const products = await this.productSearch.find(product, request);
    const options = toOptions(products, request);
    this.shownOptions = options;
    if (options.length === 0)
      return { request, text: replies.noResults(product) };
    return {
      request,
      options,
      text: replies.foundOptions(options.length, product),
    };
  }

  private addToCart(request: ShopRequest): ShopResponse {
    const picked = this.pickShownOption(request);
    if ("text" in picked) return { request, text: picked.text };
    return { request, text: this.putInCart(picked.item, request.quantity ?? 1) };
  }

  private removeFromCart(request: ShopRequest): ShopResponse {
    const lines = this.cart?.lines() ?? [];
    if (lines.length === 0) return { request, text: replies.cartEmpty };
    const picked = this.pickCartLine(request, lines);
    if ("text" in picked) return { request, text: picked.text };
    this.cart?.remove(picked.item.offerId);
    return { request, text: replies.removed(picked.item) };
  }

  // --- Helpers ---------------------------------------------------------------

  private pickShownOption(request: ShopRequest): Picked<ProductOption> {
    const options = this.shownOptions;
    if (options.length === 0) return { text: replies.searchFirst };
    return pickItem(options, request, {
      ambiguous: replies.ambiguousOption,
      notFound: replies.notAmongOptions,
      askPosition: replies.askOptionNumber(options.length),
    });
  }

  private pickCartLine(request: ShopRequest, lines: CartLine[]): Picked<CartLine> {
    return pickItem(lines, request, {
      ambiguous: replies.ambiguousCartLine,
      notFound: replies.notInCart,
      askPosition: replies.askCartLine,
    });
  }

  private putInCart(option: ProductOption, quantity: number): string {
    this.cart?.add({
      offerId: option.offerId,
      name: option.name,
      variantName: option.variantName,
      price: option.price,
      quantity,
    });
    return replies.added(option, quantity);
  }
}
