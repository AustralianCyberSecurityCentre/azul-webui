// Media query observables.
// From https://notiz.dev/blog/media-observable

import { fromEvent, Observable } from "rxjs";
import { startWith, map } from "rxjs/operators";

/** Creates an observable which matches a given media query. */
export function media(query: string): Observable<boolean> {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
}
