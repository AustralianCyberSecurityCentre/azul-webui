/**
 * Tools to assist with formatting user provided external URLs.
 */

import { BinaryExternalLink, BinaryExternalLinkType } from "../settings";

export type FormattedLink = {
  name: string;
  link: string;
};

/**
 * Given a dot-delimited key (i.e apple.orange.grape), walk a given object to return that value.
 *
 * This avoids the use of eval() and instead manually implements a search.
 *
 * The comparison function returns a non-undefined value if the function passes - the first instance
 * of a defined value will be returned.
 */
function walkContext<Type>(
  context: unknown,
  keys: string[],
  compFn: (value: unknown) => Type,
): Type | undefined {
  if (context === undefined) {
    /// Cannot walk an empty object
    return undefined;
  }

  if (keys.length === 0) {
    // No more elements in the keys array.
    return compFn(context);
  }

  if (typeof context === "object") {
    // Note - An array is an object in JavaScript
    if (Array.isArray(context)) {
      // Walk every element of the array until we find a hit (or a miss)
      for (const element of context) {
        const result = walkContext(element, keys, compFn);
        if (result !== undefined) {
          return result;
        }
      }

      // No array matched
      console.debug("Bailing from array walk as value not found in", context);
      return undefined;
    } else {
      const currentKey = keys[0];
      const remainingKeys = keys.slice(1);

      if (currentKey in context) {
        return walkContext(context[currentKey], remainingKeys, compFn);
      } else {
        // We couldn't find this key in the context
        console.debug("Bailing from context walk with remaining keys", keys);
        return undefined;
      }
    }
  } else {
    // We cannot index into a non-object value
    console.warn("Attempt to index into", typeof context);
    return undefined;
  }
}

/** Returns a reference from an arbitary JavaScript something. */
function getReferenceFromContext<Type>(
  context: unknown,
  key: string,
  compFn: (value: unknown) => Type,
): Type | undefined {
  const value = walkContext(context, key.split("."), compFn);
  return value;
}

/** Formats a URL in the form of "http://xyz/{}/{}/{}". */
function formatURL(url: string, args: string[]): string {
  let workingUrl = url;
  for (const arg of args) {
    workingUrl = workingUrl.replace("{}", arg);
  }
  return workingUrl;
}

/** Formats a user-supplied link. */
export function formatLink(
  context: unknown,
  link: BinaryExternalLink,
): FormattedLink | undefined {
  const ifValue = getReferenceFromContext(context, link.if, (value) => {
    switch (link.operator) {
      case BinaryExternalLinkType.Eq:
        return value === link.match ? true : undefined;
      case BinaryExternalLinkType.Regex:
        return new RegExp(link.match).test("" + value) ? true : undefined;
      case BinaryExternalLinkType.Exists:
        return value;
    }
  });

  if (ifValue === undefined) {
    return undefined;
  }

  const linkArguments = link.url_args.map(
    (str) => "" + getReferenceFromContext(context, str, (value) => value),
  );
  const formattedString = formatURL(link.url, linkArguments);

  return {
    name: link.display_name,
    link: formattedString,
  };
}
