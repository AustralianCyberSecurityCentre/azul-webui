import { createSelector } from "@ngrx/store";
import { AppState } from "./main-store";
import { AppRouterState } from "./route-reducer";

const selectRouterState = (state: AppState) => state.router;

export const selectUrlHistory = createSelector(
  selectRouterState,
  (state: AppRouterState) => state.urls,
);

/**most recent urls accessed for specific binaries*/
export const selectLastEntityUrls = createSelector(
  selectRouterState,
  (state: AppRouterState) => {
    const val = getLasts(state, new RegExp("^/pages/binaries/current/"));
    return val;
  },
);
/**most recent urls accessed for specific features*/
export const selectLastFeatureUrls = createSelector(
  selectRouterState,
  (state: AppRouterState) =>
    getLasts(state, new RegExp("^/pages/features/current/")),
);
/**most recent urls accessed for specific sources*/
export const selectLastSourceUrls = createSelector(
  selectRouterState,
  (state: AppRouterState) =>
    getLasts(state, new RegExp("^/pages/sources/current/")),
);
export const selectLastPluginUrls = createSelector(
  selectRouterState,
  (state: AppRouterState) =>
    getLasts(state, new RegExp("^/pages/plugins/current/")),
);

export const selectLastFragments = createSelector(
  selectRouterState,
  (state: AppRouterState) => {
    if (state.urls?.length == 0) {
      return "";
    }
    return state.urls[state.urls.length - 1].split("#")[1];
  },
);

/**most recent url accessed*/
export const selectLastUrl = createSelector(
  selectRouterState,
  (state: AppRouterState) => {
    if (state.urls?.length == 0) {
      return "";
    }
    return trim(state.urls[state.urls.length - 1]);
  },
);

// Filter functions
/**scan history for last 5 few matches with a regex*/
const getLasts = (state: AppRouterState, regex: RegExp) => {
  const ret = [];
  if (state.urls.length <= 0) {
    return ret;
  }

  for (let i = state.urls.length - 1; i >= 0; i--) {
    const match = regex.exec(state.urls[i]);
    if (!match) {
      continue;
    }
    const partial: string = trim(state.urls[i]);
    if (ret.indexOf(partial) >= 0) {
      continue;
    }
    ret.push(partial);
    if (ret.length >= 5) {
      break;
    }
  }
  return ret;
};

/**remove fragment and url params from history urls*/
const trim = (url: string) => {
  return url.split("#")[0].split("?")[0];
};
