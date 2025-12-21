import { createReducer, on } from "@ngrx/store";
import * as GlobalSettingActions from "./global-actions";
import { ColorTheme } from "./global-state.types";

const GLOBAL_SETTING_STATE = "GLOBAL_SETTING_STATE";

export interface GlobalSettingState {
  BinaryExploreShowEntropy: boolean;
  BinaryExploreShowFileFormatLegacy: boolean;
  BinaryExploreShowMimetype: boolean;
  BinaryExploreShowMagic: boolean;
  bucketSize: number;
  relationalGraphShowCousinsByDefault: boolean;
  showDebugInfo: boolean;
  debugQueryEditorHeightPx: number;
  theme: ColorTheme;
}

export const initialState: GlobalSettingState = {
  BinaryExploreShowEntropy: true,
  BinaryExploreShowFileFormatLegacy: false,
  BinaryExploreShowMimetype: false,
  BinaryExploreShowMagic: true,
  bucketSize: 100,
  relationalGraphShowCousinsByDefault: true,
  showDebugInfo: false,
  debugQueryEditorHeightPx: 300,
  theme: ColorTheme.Dark,
};

/**load from local storage*/
const loadGlobalSettingState = (): GlobalSettingState => {
  const loadedState = JSON.parse(
    localStorage.getItem(GLOBAL_SETTING_STATE) || "{}",
  );
  if (typeof loadedState?.bucketSize === "number") {
    const defaultAndLoadedState = { ...initialState, ...loadedState };
    return defaultAndLoadedState;
  }
  return initialState;
};

/**save to local storage*/
const saveGlobalSettingState = (newState: GlobalSettingState) => {
  localStorage.setItem(GLOBAL_SETTING_STATE, JSON.stringify(newState));
};

export const globalSettingReducer = createReducer(
  loadGlobalSettingState(),
  on(GlobalSettingActions.saveBucketSize, (state, { size }) => {
    const currentState = { ...state, bucketSize: size };
    saveGlobalSettingState(currentState);
    return currentState;
  }),
  on(
    GlobalSettingActions.saveRelationalGraphShowCousinsByDefault,
    (state, { relationalGraphShowCousinsByDefault }) => {
      const currentState = {
        ...state,
        relationalGraphShowCousinsByDefault:
          relationalGraphShowCousinsByDefault,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
  on(GlobalSettingActions.saveShowDebugInfo, (state, { showDebugInfo }) => {
    const currentState = { ...state, showDebugInfo: showDebugInfo };
    saveGlobalSettingState(currentState);
    return currentState;
  }),
  on(
    GlobalSettingActions.saveDebugEditorHeightPx,
    (state, { editorHeightPx }) => {
      const currentState = {
        ...state,
        debugQueryEditorHeightPx: editorHeightPx,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
  on(GlobalSettingActions.setColorTheme, (state, { newColorTheme }) => {
    const currentState = { ...state, theme: newColorTheme };
    saveGlobalSettingState(currentState);
    return currentState;
  }),
  on(
    GlobalSettingActions.saveBinaryExploreShowEntropy,
    (state, { BinaryExploreShowEntropy }) => {
      const currentState = {
        ...state,
        BinaryExploreShowEntropy: BinaryExploreShowEntropy,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
  on(
    GlobalSettingActions.saveBinaryExploreShowFileFormatLegacy,
    (state, { BinaryExploreShowFileFormatLegacy }) => {
      const currentState = {
        ...state,
        BinaryExploreShowFileFormatLegacy: BinaryExploreShowFileFormatLegacy,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
  on(
    GlobalSettingActions.saveBinaryExploreShowMimetype,
    (state, { BinaryExploreShowMimetype }) => {
      const currentState = {
        ...state,
        BinaryExploreShowMimetype: BinaryExploreShowMimetype,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
  on(
    GlobalSettingActions.saveBinaryExploreShowMagic,
    (state, { BinaryExploreShowMagic }) => {
      const currentState = {
        ...state,
        BinaryExploreShowMagic: BinaryExploreShowMagic,
      };
      saveGlobalSettingState(currentState);
      return currentState;
    },
  ),
);
