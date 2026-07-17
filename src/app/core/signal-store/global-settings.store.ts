import { effect, inject, InjectionToken } from "@angular/core";
import {
  ColorTheme,
  RelationalGraphLevel,
  SourceViewEnum,
} from "./global-state.types";
import {
  signalStore,
  withState,
  getState,
  withHooks,
  withMethods,
  patchState,
} from "@ngrx/signals";

const GLOBAL_SETTING_STATE = "GLOBAL_SETTING_STATE";

export interface GlobalSettingState {
  IsTableView: boolean;
  BinaryExploreShowEntropy: boolean;
  BinaryExploreShowMimetype: boolean;
  BinaryExploreShowMagic: boolean;
  BinaryExploreShowSources: boolean;
  BinaryExploreShowSourceReferences: boolean;
  bucketSize: number;
  relationalGraphShowCousinsByDefault: RelationalGraphLevel;
  showDebugInfo: boolean;
  debugQueryEditorHeightPx: number;
  theme: ColorTheme;
  enableHexStringSync: boolean;
  defaultSourceView: SourceViewEnum;
}

export const InitialGlobalSettingState: GlobalSettingState = {
  IsTableView: false,
  BinaryExploreShowEntropy: true,
  BinaryExploreShowMimetype: false,
  BinaryExploreShowMagic: true,
  BinaryExploreShowSources: true,
  BinaryExploreShowSourceReferences: true,
  bucketSize: 100,
  relationalGraphShowCousinsByDefault: RelationalGraphLevel.YES,
  showDebugInfo: false,
  debugQueryEditorHeightPx: 300,
  theme: ColorTheme.Dark,
  enableHexStringSync: true,
  defaultSourceView: SourceViewEnum.References,
};

/**load from local storage*/
const loadGlobalSettingState = (): GlobalSettingState => {
  const loadedState = JSON.parse(
    localStorage.getItem(GLOBAL_SETTING_STATE) || "{}",
  );
  if (typeof loadedState?.bucketSize === "number") {
    const defaultAndLoadedState = {
      ...InitialGlobalSettingState,
      ...loadedState,
    };
    return defaultAndLoadedState;
  }
  return InitialGlobalSettingState;
};

/**save to local storage*/
const saveGlobalSettingState = (newState: GlobalSettingState) => {
  localStorage.setItem(GLOBAL_SETTING_STATE, JSON.stringify(newState));
};

const LOADED_INITIAL_STATE = new InjectionToken<GlobalSettingState>(
  "LoadedGlobalSettingStoreState",
  { factory: () => loadGlobalSettingState() },
);

export const GlobalSettingStore = signalStore(
  { providedIn: "root" },
  withState(() => inject(LOADED_INITIAL_STATE)),
  withHooks({
    onInit(store) {
      effect(() => {
        // Collect and save the current store state.
        const currentState = getState(store);
        saveGlobalSettingState(currentState);
      });
    },
  }),
  withMethods((store) => ({
    updateIsTableView(IsTableView: boolean) {
      patchState(store, () => ({
        IsTableView: IsTableView,
      }));
    },
    updateBinaryExploreShowSources(BinaryExploreShowSources: boolean) {
      patchState(store, () => ({
        BinaryExploreShowSources: BinaryExploreShowSources,
      }));
    },
    updateBinaryExploreShowSourceReferences(
      BinaryExploreShowSourceReferences: boolean,
    ) {
      patchState(store, () => ({
        BinaryExploreShowSourceReferences: BinaryExploreShowSourceReferences,
      }));
    },
    updateBinaryExploreShowEntropy(BinaryExploreShowEntropy: boolean) {
      patchState(store, () => ({
        BinaryExploreShowEntropy: BinaryExploreShowEntropy,
      }));
    },
    updateBinaryExploreShowMimetype(BinaryExploreShowMimetype: boolean) {
      patchState(store, () => ({
        BinaryExploreShowMimetype: BinaryExploreShowMimetype,
      }));
    },
    updateBinaryExploreShowMagic(BinaryExploreShowMagic: boolean) {
      patchState(store, () => ({
        BinaryExploreShowMagic: BinaryExploreShowMagic,
      }));
    },
    updateBucketSize(bucketSize: number) {
      patchState(store, () => ({
        bucketSize: bucketSize,
      }));
    },
    updateRelationalGraphShowCousinsByDefault(
      relationalGraphShowCousinsByDefault: RelationalGraphLevel,
    ) {
      patchState(store, () => ({
        relationalGraphShowCousinsByDefault:
          relationalGraphShowCousinsByDefault,
      }));
    },
    updateShowDebugInfo(showDebugInfo: boolean) {
      patchState(store, () => ({
        showDebugInfo: showDebugInfo,
      }));
    },
    updateDebugQueryEditorHeightPx(debugQueryEditorHeightPx: number) {
      patchState(store, () => ({
        debugQueryEditorHeightPx: debugQueryEditorHeightPx,
      }));
    },
    updateTheme(theme: ColorTheme) {
      patchState(store, () => ({
        theme: theme,
      }));
    },
    updateEnableHexStringSync(enableHexStringSync: boolean) {
      patchState(store, () => ({
        enableHexStringSync: enableHexStringSync,
      }));
    },
    updateDefaultSourceView(defaultSourceView: SourceViewEnum) {
      patchState(store, () => ({
        defaultSourceView: defaultSourceView,
      }));
    },
  })),
);
