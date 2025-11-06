import { routerNavigatedAction, ROUTER_NAVIGATED } from "@ngrx/router-store";
import { createReducer, on } from "@ngrx/store";

const TRIM_LENGTH = 200;
const MAX_HISTORY_LENGTH = TRIM_LENGTH + 50;

const getHistory = (): string[] => {
  return JSON.parse(localStorage.getItem(ROUTER_NAVIGATED) || "[]");
};
/**save history to local storage*/
const setHistory = (urls: string[]) => {
  localStorage.setItem(ROUTER_NAVIGATED, JSON.stringify(urls));
};

export interface AppRouterState {
  urls: string[];
}

const initialState: AppRouterState = {
  urls: getHistory(),
};

export const routerReducer = createReducer(
  initialState,
  on(routerNavigatedAction, (state, payload) => {
    const url = payload.payload.routerState.url;
    const urlList = getHistory();
    if (urlList.length > MAX_HISTORY_LENGTH) {
      let newUrlList = [];
      const tmp = new Set<string>();
      for (let i = urlList.length - 1; i >= 0; i--) {
        if (tmp.has(urlList[i])) {
          continue;
        }
        newUrlList.push(urlList[i]);
        tmp.add(urlList[i]);
      }
      newUrlList = newUrlList.slice(0, TRIM_LENGTH); // remove oldest entries over cap
      newUrlList = newUrlList.reverse();

      newUrlList.push(url);
      setHistory(newUrlList);
      return { ...state, urls: [...newUrlList] };
    }
    urlList.push(url);
    setHistory(urlList);
    return { ...state, urls: [...urlList] };
  }),
);
