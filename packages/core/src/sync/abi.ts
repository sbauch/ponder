import { getDuplicateElements } from "@/utils/duplicates.js";
import {
  type Abi,
  type AbiEvent,
  type AbiFunction,
  formatAbiItem,
} from "abitype";
import {
  type GetEventArgs,
  type Hex,
  encodeEventTopics,
  getAbiItem,
  parseAbiItem,
  toEventSelector,
  toFunctionSelector,
} from "viem";
import type { Config } from "../config/index.js";

/**
 * Fix issue with Array.isArray not checking readonly arrays
 * {@link https://github.com/microsoft/TypeScript/issues/17002}
 */
declare global {
  interface ArrayConstructor {
    isArray(arg: ReadonlyArray<any> | any): arg is ReadonlyArray<any>;
  }
}

type AbiEventMeta = {
  // Event name (if no overloads) or full event signature (if name is overloaded).
  // This is the event name used when registering indexing functions using `ponder.on("ContractName:EventName", ...)`
  safeName: string;
  // Full event signature, e.g. `event Deposit(address indexed from,bytes32 indexed id,uint value);`
  signature: string;
  // Keccak256 hash of the event signature (topic[0]).
  selector: Hex;
  // ABI item used for decoding raw logs.
  item: AbiEvent;
};

type AbiFunctionMeta = {
  // Function name (if no overloads) or full function signature (if name is overloaded).
  // This is the function name used when registering indexing functions using `ponder.on("ContractName.FunctionName", ...)`
  safeName: string;
  // Full function signature, e.g. `function transfer(address to,uint256 amount)`
  signature: string;
  // Keccak256 hash of the function signature.
  selector: Hex;
  // ABI item used for decoding input and output data.
  item: AbiFunction;
};

export type AbiEvents = {
  bySafeName: { [key: string]: AbiEventMeta | undefined };
  bySelector: { [key: Hex]: AbiEventMeta | undefined };
};

export type AbiFunctions = {
  bySafeName: { [key: string]: AbiFunctionMeta | undefined };
  bySelector: { [key: Hex]: AbiFunctionMeta | undefined };
};

export const buildAbiEvents = ({ abi }: { abi: Abi }) => {
  const abiEvents = abi
    .filter((item): item is AbiEvent => item.type === "event")
    .filter((item) => item.anonymous === undefined || item.anonymous === false);

  const overloadedEventNames = getDuplicateElements(
    abiEvents.map((item) => item.name),
  );

  return abiEvents.reduce<AbiEvents>(
    (acc, item) => {
      const signature = formatAbiItem(item);
      const safeName = overloadedEventNames.has(item.name)
        ? signature.split("event ")[1]!
        : item.name;
      const selector = toEventSelector(item);

      const abiEventMeta = { safeName, signature, selector, item };

      acc.bySafeName[safeName] = abiEventMeta;
      acc.bySelector[selector] = abiEventMeta;

      return acc;
    },
    { bySafeName: {}, bySelector: {} },
  );
};

export function buildTopics(
  abi: Abi,
  filter: NonNullable<Config["contracts"][string]["filter"]>,
): {
  topic0: Hex;
  topic1: Hex | Hex[] | null;
  topic2: Hex | Hex[] | null;
  topic3: Hex | Hex[] | null;
}[] {
  const filters = Array.isArray(filter) ? filter : [filter];

  const topics = filters.map((filter) => {
    // Single event with args
    const topics = encodeEventTopics({
      abi: [findAbiEvent(abi, filter.event)],
      args: filter.args as GetEventArgs<Abi, string>,
    });

    return {
      topic0: topics[0],
      topic1: topics[1] ?? null,
      topic2: topics[2] ?? null,
      topic3: topics[3] ?? null,
    };
  });

  return topics;
}

/**
 * Finds the event ABI item for the event name or event signature.
 *
 * @param eventName Event name or event signature if there are duplicates
 */
const findAbiEvent = (abi: Abi, eventName: string): AbiEvent => {
  if (eventName.includes("(")) {
    // full event signature
    return parseAbiItem(`event ${eventName}`) as AbiEvent;
  } else {
    return getAbiItem({ abi, name: eventName }) as AbiEvent;
  }
};

export const buildAbiFunctions = ({ abi }: { abi: Abi }) => {
  const abiFunctions = abi.filter(
    (item): item is AbiFunction => item.type === "function",
  );

  const overloadedFunctionNames = getDuplicateElements(
    abiFunctions.map((item) => item.name),
  );

  return abiFunctions.reduce<AbiFunctions>(
    (acc, item) => {
      const signature = formatAbiItem(item);
      const safeName = overloadedFunctionNames.has(item.name)
        ? signature.split("function ")[1]!
        : `${item.name}()`;
      const selector = toFunctionSelector(item);

      const abiEventMeta = { safeName, signature, selector, item };

      acc.bySafeName[safeName] = abiEventMeta;
      acc.bySelector[selector] = abiEventMeta;

      return acc;
    },
    { bySafeName: {}, bySelector: {} },
  );
};
