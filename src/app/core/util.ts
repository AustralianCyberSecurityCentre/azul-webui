import { editor } from "monaco-editor";
import { ButtonType } from "src/lib/flow/button/button.component";

// Angular's Webpack doesn't like Monaco, but monaco-editor-types *is* available - we
// just need to sub in a couple of our types:
// Available values - https://github.com/microsoft/monaco-editor/blob/gh-pages/node_modules/monaco-editor/monaco.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let monaco: any;

/** Least recently used cache - should be used through cacheData function*/
class LruCache<K, V> {
  cache = new Map<K, V>();
  max: number;

  constructor(max: number) {
    this.max = max;
  }

  /** return first entry in map */
  first(): K {
    return this.cache.keys().next().value;
  }

  delete(key: K) {
    this.cache.delete(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get(key: K): V {
    const val = this.cache.get(key);
    if (val) {
      // refresh key
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: K, val: V) {
    // refresh key
    if (this.cache.has(key)) this.cache.delete(key);
    // evict oldest
    else if (this.cache.size == this.max) this.cache.delete(this.first());
    this.cache.set(key, val);
  }
}

const cacheDataMap = new Map<string, LruCache<number | string, unknown>>();

/** simple wrapper around an observable to cache that observable reference.
 *
 * Note that this doesn't handle caching the returned data from the observable!
 * It just ensures that multiple clients receive the same observable reference.
 *
 * Uses LRU to remove cached observables, hypothetically freeing up memory.
 */
export function cacheData<T>(
  id: string,
  max: number,
  unique: number | string,
  call: () => T,
  refresh: boolean = false,
): T {
  // if type of data doesnt exist yet, create a mapper for it
  if (!cacheDataMap.has(id)) {
    cacheDataMap.set(id, new LruCache<number | string, T>(max));
  }
  // retrieve map for id
  const store = cacheDataMap.get(id);
  // refresh forces data to be cleared
  if (refresh) {
    store.delete(unique);
  }
  // if call hasn't been executed yet, do so
  if (!store.has(unique)) {
    store.set(unique, call());
  }
  // retrieve called data
  return store.get(unique) as T;
}

export function showCache() {
  for (const t of cacheDataMap.keys()) {
    const n = cacheDataMap.get(t);
    console.log(`${t} (${n.cache.size}/${n.max})`);
    let cp = 0;
    for (const entry of n.cache.keys()) {
      console.log(`  * ${entry}`);
      cp += 1;
      if (cp > 20) {
        console.log(`  +++`);
        break;
      }
    }
  }
  return cacheDataMap;
}

export function getCacheKeys(id: string): Array<string | number> {
  if (!cacheDataMap.has(id)) {
    return [];
  }
  return Array.from(cacheDataMap.get(id).cache.keys());
}

export function getCachedValue<T>(id: string, unique: number | string): T {
  const store = cacheDataMap.get(id);
  if (!store) {
    return null;
  }
  return store.get(unique) as T;
}

/**hash the input string*/
export function hashString(source: string) {
  let hash = 0;
  // if (source.length == 0) { return hash; }
  for (let i = 0; i < source.length; i++) {
    const char = source.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**hash the input key-value array*/
export function hashObject(params: { [k: string]: unknown }): number {
  let merged = "";
  const keys = Object.keys(params).sort();

  for (const key of keys) {
    merged += key;

    const value = params[key];
    if (Array.isArray(value)) {
      merged += value.map((x) => stringify(x)).join(",");
    } else {
      merged += stringify(value);
    }
  }

  return hashString(merged);
}

// Helper to stringify nested values
function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map((item) => stringify(item)).join(",");
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const sorted = entries.sort(([a], [b]) => a.localeCompare(b));

    return sorted.map(([key, val]) => `${key}:${stringify(val)}`).join("|");
  }

  return String(value);
}
/**nebular status types for buttons*/
const colourStatus = [
  ButtonType.Primary,
  ButtonType.Green,
  ButtonType.Yellow,
  ButtonType.Purple,
  ButtonType.Danger,
];
/**return nebular status for the input tag, deterministically*/
export function getStatusColour(tag: string): ButtonType {
  return colourStatus[Math.abs(hashString(tag) % colourStatus.length)];
}

const integerRegex = /^[0-9][0-9]*[.]?[0-9]*$/;

/**Escapes a search query parameter */
export function escapeValue(value: string): string {
  // If this is an integer, don't quote it
  if (integerRegex.test(value)) {
    return value;
  } else if (value == undefined || value.length == 0) {
    return "";
  } else {
    const cleanedValue = value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "\\n")
      .replaceAll("\r\n", "\\r\\n");
    return `"${cleanedValue}"`;
  }
}

/**Converts source information to a search string */
export function sourceRefsAsParams(
  source: string,
  source_depth: number,
  track_source_references: string,
  timestamp: string | null,
) {
  let base = `source.name:${escapeValue(source)} depth:${source_depth}`;
  if (track_source_references.length > 0) {
    base += ` track_source_references:${escapeValue(track_source_references)}`;
  }
  // optionally filter by source timestamp as well
  if (timestamp) {
    base += ` source.timestamp:${escapeValue(timestamp)}`;
  }
  return base;
}

/**Converts source information into a purge request */
export function getPurgeQueryParams(
  trackSubmission: string,
  source: string,
  references: { [d: string]: string },
  timestamp: string | undefined = undefined,
) {
  if (!references) {
    // if there are no references this may be undefined, so default to empty object
    references = {};
  }
  const ret = {
    source: source,
    track_source_references: trackSubmission,
    timestamp,
  };
  let index = 0;
  for (const [refKey, refValue] of Object.entries(references)) {
    ret["reference_key[" + index + "]"] = refKey;
    ret["reference_value[" + index + "]"] = refValue;
    index++;
  }
  return ret;
}

/**Determines if the current user is allowed to purge this file/link. */
export function allowedToPurge(
  isAdmin: boolean,
  _trackSubmission: string | undefined = undefined,
  _trackLink: string | undefined = undefined,
) {
  // FUTURE: Consider other conditions, not just admin - a user might be permitted to delete
  //         their own files.
  return isAdmin;
}

/** Get a copy of the Monaco Settings used throughout the UI. */
export function getDefaultMonacoSettings(): editor.IEditorOptions &
  editor.IGlobalEditorOptions {
  return {
    theme: "vs-dark",
    readOnly: true,
    fontFamily: "JetBrains Mono Variable",
    codeLensFontFamily: "Inter Variable",
    automaticLayout: true,
  };
}

/** Some browsers (Chromium/Edge) might let VSCode incorrectly measure unloaded fonts. Recalculate. */
export function recalculateFonts() {
  // The font should be loaded by this call, but inject a listener for
  // any font loads that might happen later
  document.fonts.onloadingdone = (_ev) => {
    monaco.editor.remeasureFonts();
  };

  // Recalculate fonts for any font that may have loaded between Angular
  // component construction & this call
  monaco.editor.remeasureFonts();
}

/** Sets some common actions for use within the Monaco editor, that aren't included by default. */
export function addCommonMonacoActions(editor: editor.IStandaloneCodeEditor) {
  // Word wrapping isn't an option by default:
  let wordWrapEnabled = false;
  editor.addAction({
    id: "toggle-word-wrap",
    label: "Toggle Word Wrap",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
    precondition: null,
    keybindingContext: null,
    contextMenuGroupId: "navigation",
    contextMenuOrder: 1.5,

    run: (ed) => {
      wordWrapEnabled = !wordWrapEnabled;
      ed.updateOptions({ wordWrap: wordWrapEnabled ? "on" : "off" });
    },
  });
  // Add ability to fold and unflod all the json.
  editor.addAction({
    id: "fold-all",
    label: "Fold All",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
    precondition: null,
    keybindingContext: null,
    contextMenuGroupId: "Folding",
    contextMenuOrder: 1.5,

    run: (ed) => {
      ed.trigger("fold", "editor.foldAll", null);
    },
  });
  editor.addAction({
    id: "unfold-all",
    label: "Unfold All",
    keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyG],
    precondition: null,
    keybindingContext: null,
    contextMenuGroupId: "Folding",
    contextMenuOrder: 1.5,

    run: (ed) => {
      ed.trigger("unfold", "editor.unfoldAll", null);
    },
  });

  // Allow for simple
  const numericKeys = [
    monaco.KeyCode.Digit0,
    monaco.KeyCode.Digit1,
    monaco.KeyCode.Digit2,
    monaco.KeyCode.Digit3,
    monaco.KeyCode.Digit4,
    monaco.KeyCode.Digit5,
  ];
  // Add various fold level options.
  for (let i = 2; i < 5; i++) {
    editor.addAction({
      id: `fold-level-${i}`,
      label: `Fold level ${i}`,
      keybindings: [monaco.KeyMod.Alt | numericKeys[i]],
      precondition: null,
      keybindingContext: null,
      contextMenuGroupId: "Folding",
      contextMenuOrder: 1.5,

      run: (ed) => {
        ed.trigger("fold", `editor.foldLevel${i}`, null);
      },
    });
  }
}

/**
 * Formats a floating point to n digits.
 */
export function formatFloat(input: number, digits: number = 2): string {
  return input.toLocaleString("en-AU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
