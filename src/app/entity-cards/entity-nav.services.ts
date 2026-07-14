import { computed, inject, Injectable, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

export enum binaryTabsEnum {
  Overview = "Overview",
  Features = "Features",
  Data = "Data",
  Relations = "Relations",
  Status = "Status",
  Debug = "Debug",
}

export enum RelationsTabs {
  SimilarFeatures = "Features",
  SimilarSsdeep = "Similar ssdeep",
  SimilarTLSH = "Similar TLSH",
  SimilarEntropy = "Similar Entropy",
  Parents = "Parents",
  Children = "Children",
  Sources = "Sources",
}

@Injectable({
  providedIn: "root",
})
export class EntityNavService {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly defaultBinaryRoute = binaryTabsEnum.Overview;
  private readonly defaultRelationsRoute = RelationsTabs.Sources;

  private fragmentSignal: Signal<string> = toSignal(this.route.fragment, {
    initialValue: binaryTabsEnum.Overview,
  });

  activeBinaryTab: Signal<binaryTabsEnum> = computed(() => {
    const activeTab = this.fragmentSignal()?.split("-")[0];
    if (activeTab && Object.keys(binaryTabsEnum).includes(activeTab)) {
      return activeTab as binaryTabsEnum;
    }
    return this.defaultBinaryRoute;
  });

  activateRelationsSubTab: Signal<RelationsTabs> = computed(() => {
    const splitFragment = this.fragmentSignal()?.split("-");
    if (splitFragment.length == 2) {
      const relationsSection = splitFragment[1];
      if (
        Object.values(RelationsTabs).includes(relationsSection as RelationsTabs)
      ) {
        return relationsSection as RelationsTabs;
      }
    }
    return this.defaultRelationsRoute;
  });

  navigateToRelationsSubTab(subTab: RelationsTabs) {
    this.router.navigate([], {
      fragment: `${binaryTabsEnum.Relations}-${subTab}`,
    });
  }
}
