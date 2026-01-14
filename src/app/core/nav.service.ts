import { inject, Injectable } from "@angular/core";
import { DomSanitizer, SafeUrl, Title } from "@angular/platform-browser";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import * as ops from "rxjs/operators";

import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { faUncharted } from "@fortawesome/free-brands-svg-icons";
import {
  faBook,
  faCameraRetro,
  faCode,
} from "@fortawesome/free-solid-svg-icons";
import { select, Store } from "@ngrx/store";
import { Entity } from "src/app/core/services";
import { config } from "../settings";
import { components } from "./api/openapi";
import * as fromRoute from "./store/route-selector";

type BaseMenuItem = {
  title: string;
  disabled?: boolean;
  listItem?: boolean;
  active?: boolean;
  subtitle?: string;
  icon?: IconProp;
};

type InternalMenuItem = BaseMenuItem & {
  external?: false;
  link?: string | string[];
  fragment?: string;
};

type ExternalMenuItem = BaseMenuItem & {
  external: true;
  link: string | SafeUrl;
};

export type MenuItem = InternalMenuItem | ExternalMenuItem;

@Injectable({
  providedIn: "root",
})
export class NavService {
  private readonly store = inject(Store);
  private title = inject(Title);
  entityService = inject(Entity);

  dbg = (...d) => console.debug("NavService:", ...d);
  err = (...d) => console.error("NavService:", ...d);

  /**menu entries for topbar sources*/
  topbarSource$: Observable<MenuItem[]> = null;
  /**menu entries for topbar binaries*/
  // Note - done as two observables to delay subscription to after auth (because service is injected into root).
  topbarEntity$: Observable<MenuItem[]> = null;
  topbarEntityExtraInfo$: Observable<MenuItem[]> = null;
  /**menu entries for topbar features*/
  topbarFeature$: Observable<MenuItem[]> = null;
  topbarPlugin$: Observable<MenuItem[]> = null;
  topbarExternal: MenuItem[] = [
    { title: "API", icon: faCode, external: true, link: "/api" },
    { title: "Docs", icon: faBook, external: true, link: "/docs" },
  ];

  windowSizeChange$ = new Subject<null>();

  /**Does this window have focus? Use this to disable intensive operations like repeating rest requests */
  windowFocus$ = new BehaviorSubject<boolean>(false);

  constructor() {
    const sanitizer = inject(DomSanitizer);

    // monitor for when users switch away from this window
    window.addEventListener("blur-sm", () => this.windowFocus$.next(false));
    window.addEventListener("focus", () => this.windowFocus$.next(true));
    // set initial state of focus
    if (document.hasFocus()) {
      this.windowFocus$.next(true);
    }

    // if window resized, wait a little while and then emit event
    window.addEventListener("resize", () =>
      setTimeout(() => this.windowSizeChange$.next(null), 1000),
    );

    // Configure an alt icon for this instance if needed
    if (config.deployment_alticon) {
      // Select header elements and replace their href with their alt.
      document.querySelectorAll("link[data-alt]").forEach((value) => {
        value.setAttribute("href", value.getAttribute("data-alt"));
      });
    }

    if (config.global_external_links?.retrohunt_url) {
      this.topbarExternal.push({
        title: "Retrohunt",
        icon: faCameraRetro,
        external: true,
        // Security: these are specifically indicated to be external URLs
        link: sanitizer.bypassSecurityTrustUrl(
          config.global_external_links.retrohunt_url,
        ),
      });
    }

    if (config.global_external_links?.nsrl_url) {
      this.topbarExternal.push({
        title: "NSRL",
        icon: faUncharted,
        external: true,
        // Security: these are specifically indicated to be external URLs
        link: sanitizer.bypassSecurityTrustUrl(
          config.global_external_links.nsrl_url,
        ),
      });
    }

    // assemble menu for source dropdown
    this.topbarSource$ = this.store.pipe(
      select(fromRoute.selectLastSourceUrls),
      ops.map((d) => {
        // construct entity menu
        const items: MenuItem[] = [
          { title: "Explore", link: "/pages/sources/explore" },
        ];
        if (d.length > 0) {
          items.push({ title: "Recent", disabled: true });
        }
        // max 5 last
        for (const link of d.slice(0, 5)) {
          const broken = link.split("/");
          const feat = broken[broken.length - 1];
          items.push({
            title: `${feat}`,
            link: link,
            listItem: true,
          });
        }
        return items;
      }),
    );

    // assemble menu for feature dropdown
    this.topbarFeature$ = this.store.pipe(
      select(fromRoute.selectLastFeatureUrls),
      ops.map((d) => {
        // construct entity menu
        const items: MenuItem[] = [
          { title: "Explore", link: "/pages/features/explore" },
          { title: "Tags", link: "/pages/features/tags" },
        ];
        if (d.length > 0) {
          items.push({ title: "Recent", disabled: true });
        }
        // max 5 last
        for (const link of d.slice(0, 5)) {
          const broken = link.split("/");
          const feat = broken[broken.length - 1];
          // if (feat.length > 10) { feat = feat.slice(0, 7) + '...' }
          items.push({
            title: `${feat}`,
            link: link,
            listItem: true,
          });
        }
        return items;
      }),
    );

    // assemble menu for entity dropdown
    this.topbarEntity$ = this.store.pipe(
      select(fromRoute.selectLastEntityUrls),
      ops.map((d) => {
        // construct entity menu
        const items: MenuItem[] = [
          { title: "Explore", link: "/pages/binaries/explore" },
          { title: "Hash Lookup", link: "/pages/binaries/hash_lookup" },
          { title: "Upload", link: "/pages/binaries/upload" },
          { title: "Tags", link: "/pages/binaries/tags" },
          // { title: 'Compare', link: '/pages/binaries/compare' },
        ];
        if (d.length > 0) {
          items.push({ title: "Recent", disabled: true });
        }
        // max 5 last
        for (const link of d.slice(0, 5)) {
          const broken = link.split("/");
          const eid = broken[broken.length - 1];

          items.push({
            title: `${eid}`,
            link: link,
            listItem: true,
          });
        }
        return items;
      }),
    );

    this.topbarEntityExtraInfo$ = this.topbarEntity$.pipe(
      // Add a debounce time to "deprioritise" this request
      ops.delay(500),
      ops.mergeMap((arr) => {
        // Determine which hashes to lookup data for
        const hashFetch = arr.filter((i) => !!i.listItem).map((i) => i.title);

        return this.entityService.find({}, hashFetch).pipe(
          ops.map((res) => {
            // Convert to a lookup dictionary
            const resultDict: Record<
              string,
              components["schemas"]["EntityFindItem"]
            > = {};
            for (const item of res.items) {
              if (item.sha256 != null) {
                resultDict[item.sha256] = item;
              }
            }

            // Create menu items regardless of if there are results or not
            return arr.map((i) => {
              const item = resultDict[i.title];
              if (
                item !== undefined &&
                item.exists &&
                item.file_format != null &&
                item.sources[0].name != null
              ) {
                return {
                  ...i,
                  subtitle: `${item.file_format} | ${item.sources[0].name}`,
                };
              } else {
                return i;
              }
            });
          }),
        );
      }),
    );

    // assemble menu for entity dropdown
    this.topbarPlugin$ = this.store.pipe(
      select(fromRoute.selectLastPluginUrls),
      ops.map((d) => {
        // construct entity menu
        const items: MenuItem[] = [
          { title: "Explore", link: "/pages/plugins/explore" },
        ];
        if (d.length > 0) {
          items.push({ title: "Recent", disabled: true });
        }
        // max 5 last
        for (const link of d.slice(0, 5)) {
          const broken = link.split("/");
          const eid = broken[broken.length - 1];
          const etype = broken[broken.length - 3];
          items.push({
            title: `${etype}`,
            link: link,
            listItem: true,
            subtitle: `${eid}`,
          });
        }
        return items;
      }),
    );

    // regex patterns for setting page titles
    const titles = [
      { re: new RegExp("^/pages/binaries/explore"), t: () => `Binaries` },
      {
        re: new RegExp("^/pages/binaries/hash_lookup"),
        t: () => `Hash Lookup`,
      },
      { re: new RegExp("^/pages/binaries/tags"), t: () => `Binary Tags` },
      {
        re: new RegExp("^/pages/features/tags"),
        t: () => `Feature Value Tags`,
      },
      { re: new RegExp("^/pages/plugins/explore"), t: () => `Plugins` },
      { re: new RegExp("^/pages/binaries/upload"), t: () => `Upload` },
      {
        re: new RegExp("^/pages/plugins/current/([^/]+)/versions/([^/]+)"),
        t: (d) => `${d[0]} - Plugins`,
      },
      {
        re: new RegExp("^/pages/binaries/current/([^/]+)"),
        t: (d) => `${d[0]}`,
      },
      { re: new RegExp("^/pages/sources/explore"), t: () => `Sources` },
      {
        re: new RegExp("^/pages/sources/current/([^/]+)"),
        t: (d) => `${d[0]} - Source`,
      },
      { re: new RegExp("^/pages/features/explore"), t: () => `Features` },
      {
        re: new RegExp("^/pages/features/current/([^/]+)"),
        t: (d) => `${d[0]} - Feature`,
      },
    ];

    // set page title
    this.store.pipe(select(fromRoute.selectLastUrl)).subscribe((d) => {
      // In PWA mode, Azul is automatically appended, but in a regular
      // web browser it isn't.
      const labelInTitle =
        ("standalone" in navigator && navigator.standalone) ||
        window.matchMedia("(display-mode: standalone)").matches;

      const deploymentTitle = config?.deployment_title || "Azul";

      let title = labelInTitle ? "" : deploymentTitle;
      for (const opt of titles) {
        const rx = opt.re.exec(d);
        if (!rx) {
          continue;
        }
        title = opt.t(rx.slice(1));
        if (!labelInTitle) {
          title += " - " + deploymentTitle;
        }
        break;
      }
      this.title.setTitle(title);
    });
  }
}
